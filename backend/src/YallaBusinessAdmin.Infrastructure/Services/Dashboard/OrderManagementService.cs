using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using YallaBusinessAdmin.Application.Common.Errors;
using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Dashboard;
using YallaBusinessAdmin.Application.Dashboard.Dtos;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Domain.StateMachines;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services.Dashboard;

/// <summary>
/// Service for managing orders (listing, creating, updating).
/// </summary>
public sealed class OrderManagementService : IOrderManagementService
{
    private readonly AppDbContext _context;
    private readonly ILogger<OrderManagementService> _logger;

    public OrderManagementService(
        AppDbContext context,
        ILogger<OrderManagementService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc />
    public async Task<PagedResult<OrderResponse>> GetOrdersAsync(
        Guid companyId,
        int page,
        int pageSize,
        string? search,
        string? statusFilter,
        string? dateFilter,
        string? addressFilter,
        string? typeFilter,
        string? serviceTypeFilter = null,
        string? comboTypeFilter = null,
        Guid? projectId = null,
        CancellationToken cancellationToken = default)
    {
        // ═══════════════════════════════════════════════════════════════
        // ОПТИМИЗАЦИЯ: Определяем какие типы сервисов включать
        // ═══════════════════════════════════════════════════════════════
        var includeLunch = string.IsNullOrWhiteSpace(serviceTypeFilter) ||
                           serviceTypeFilter.Equals("LUNCH", StringComparison.OrdinalIgnoreCase);
        var includeCompensation = string.IsNullOrWhiteSpace(serviceTypeFilter) ||
                                   serviceTypeFilter.Equals("COMPENSATION", StringComparison.OrdinalIgnoreCase);

        // ═══════════════════════════════════════════════════════════════
        // FAST PATH: Только LUNCH заказы - полная SQL пагинация
        // Это самый частый сценарий, оптимизируем его максимально
        // ═══════════════════════════════════════════════════════════════
        if (includeLunch && (!includeCompensation || typeFilter?.ToLower() == "guest"))
        {
            return await GetLunchOrdersWithPaginationAsync(
                companyId, projectId, search, statusFilter, dateFilter,
                addressFilter, typeFilter, comboTypeFilter, page, pageSize,
                cancellationToken);
        }

        // ═══════════════════════════════════════════════════════════════
        // MIXED PATH: LUNCH + COMPENSATION - объединяем результаты
        // NOTE: Выполняем последовательно, т.к. DbContext не потокобезопасен
        // ═══════════════════════════════════════════════════════════════
        var results = new List<OrderResponse>();

        if (includeLunch)
        {
            var lunchOrders = await GetLunchOrdersOptimizedAsync(
                companyId, projectId, search, statusFilter, dateFilter,
                addressFilter, typeFilter, comboTypeFilter, cancellationToken);
            results.AddRange(lunchOrders);
        }

        if (includeCompensation && typeFilter?.ToLower() != "guest")
        {
            var compOrders = await GetCompensationTransactionsOptimizedAsync(
                companyId, projectId, search, dateFilter, cancellationToken);
            results.AddRange(compOrders);
        }

        results = results
            .OrderByDescending(r => r.Date)
            .ThenBy(r => r.EmployeeName)
            .ToList();

        var total = results.Count;
        var pagedItems = results
            .Skip((page - 1) * pageSize)
            .Take(pageSize);

        return PagedResult<OrderResponse>.Create(pagedItems, total, page, pageSize);
    }

    /// <inheritdoc />
    public async Task<CreateGuestOrderResponse> CreateGuestOrderAsync(
        CreateGuestOrderRequest request,
        Guid companyId,
        Guid? projectId = null,
        CancellationToken cancellationToken = default)
    {
        var targetProjectId = request.ProjectId != Guid.Empty ? request.ProjectId : projectId;

        if (!targetProjectId.HasValue || targetProjectId.Value == Guid.Empty)
        {
            throw new InvalidOperationException("Необходимо указать проект для гостевого заказа");
        }

        var project = await _context.Projects
            .FirstOrDefaultAsync(p => p.Id == targetProjectId.Value && p.CompanyId == companyId, cancellationToken)
            ?? throw new KeyNotFoundException("Проект не найден");

        var price = ComboPricingConstants.GetPrice(request.ComboType);
        var totalCost = price * request.Quantity;

        ValidateBudget(project.Budget, project.OverdraftLimit, totalCost);

        var orderDate = ParseOrderDate(request.Date);

        // ═══════════════════════════════════════════════════════════════
        // DATE VALIDATION: Cannot create orders for past dates
        // ═══════════════════════════════════════════════════════════════
        if (TimezoneHelper.IsPastDate(orderDate, project.Timezone))
        {
            throw new InvalidOperationException("Нельзя создать заказ на прошедшую дату");
        }

        // ═══════════════════════════════════════════════════════════════
        // CUTOFF VALIDATION: Only check cutoff if order is for today
        // Business rule: Cannot create orders for today after cutoff time
        // Future dates are always allowed
        // ═══════════════════════════════════════════════════════════════
        if (TimezoneHelper.IsToday(orderDate, project.Timezone))
        {
            ValidateCutoffTime(project.CutoffTime, project.Timezone);
        }
        var orders = CreateGuestOrders(request, companyId, targetProjectId.Value, price, orderDate, project.CurrencyCode);

        foreach (var order in orders)
        {
            await _context.Orders.AddAsync(order, cancellationToken);
        }

        // ═══════════════════════════════════════════════════════════════
        // NOTE: Бюджет НЕ списывается при создании гостевых заказов!
        // Списание происходит в конце дня через DailySettlementJob
        // когда заказы переводятся из Active в Completed.
        // Транзакция также создаётся при списании.
        // ═══════════════════════════════════════════════════════════════

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Created {Count} guest orders for project {ProjectId}, pending settlement {Cost}",
            request.Quantity, targetProjectId, totalCost);

        return new CreateGuestOrderResponse
        {
            Message = $"Создано {request.Quantity} гостевых заказов",
            TotalCost = totalCost,
            RemainingBudget = project.Budget, // Показываем текущий баланс (ещё не списано)
            Orders = orders.Select(o => MapToOrderResponse(o, project))
        };
    }

    /// <inheritdoc />
    public async Task<MealAssignmentResult> AssignMealsAsync(
        AssignMealsRequest request,
        Guid companyId,
        CancellationToken cancellationToken = default)
    {
        var company = await _context.Companies
            .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken)
            ?? throw new KeyNotFoundException("Компания не найдена");

        var employees = await _context.Employees
            .IgnoreQueryFilters()
            .Include(e => e.Budget)
            .Include(e => e.Project)
            .Where(e => request.EmployeeIds.Contains(e.Id) && e.CompanyId == companyId)
            .ToListAsync(cancellationToken);

        var price = ComboPricingConstants.GetPrice(request.ComboType);
        var orderDate = ParseOrderDate(request.Date);
        var createdOrders = new List<Order>();
        var skippedEmployees = new List<string>();

        // ═══════════════════════════════════════════════════════════════
        // CUTOFF VALIDATION: Check if assigning meals for today after cutoff
        // Business rule: Cannot create orders for today after cutoff time
        // IMPORTANT: Must check cutoff for each employee's project timezone!
        // ═══════════════════════════════════════════════════════════════

        foreach (var employee in employees)
        {
            var validationResult = ValidateEmployeeForMealAssignment(employee, price, orderDate);
            if (!validationResult.IsValid)
            {
                skippedEmployees.Add($"{employee.FullName} ({validationResult.Reason})");
                continue;
            }

            // ═══════════════════════════════════════════════════════════════
            // CUTOFF VALIDATION: Check cutoff for this employee's project
            // ═══════════════════════════════════════════════════════════════
            if (employee.Project != null && TimezoneHelper.IsToday(orderDate, employee.Project.Timezone))
            {
                if (TimezoneHelper.IsCutoffPassed(employee.Project.CutoffTime, employee.Project.Timezone))
                {
                    skippedEmployees.Add($"{employee.FullName} (время заказа на сегодня истекло в {employee.Project.CutoffTime})");
                    continue;
                }
            }

            var existingOrder = await _context.Orders
                .AnyAsync(o => o.EmployeeId == employee.Id && o.OrderDate.Date == orderDate.Date, cancellationToken);

            if (existingOrder)
            {
                skippedEmployees.Add($"{employee.FullName} (уже есть заказ)");
                continue;
            }

            var order = CreateEmployeeOrder(employee, companyId, request.ComboType, price, orderDate, company.CurrencyCode);
            employee.Budget!.TotalBudget -= price;
            createdOrders.Add(order);
            await _context.Orders.AddAsync(order, cancellationToken);
        }

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Assigned meals to {Count} employees, skipped {SkippedCount}",
            createdOrders.Count, skippedEmployees.Count);

        return new MealAssignmentResult(
            $"Назначено {createdOrders.Count} заказов",
            createdOrders.Count,
            skippedEmployees
        );
    }

    /// <inheritdoc />
    public async Task<BulkActionResult> BulkActionAsync(
        BulkActionRequest request,
        Guid companyId,
        CancellationToken cancellationToken = default)
    {
        var orders = await _context.Orders
            .Include(o => o.Employee)
                .ThenInclude(e => e!.Budget)
            .Include(o => o.Project) // Need project for cutoff check
            .Where(o => request.OrderIds.Contains(o.Id) && o.CompanyId == companyId)
            .ToListAsync(cancellationToken);

        var company = await _context.Companies
            .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken);

        // ═══════════════════════════════════════════════════════════════
        // CUTOFF VALIDATION: Check cutoff time for actions on today's orders
        // Business rule: Cannot cancel/pause/modify orders after cutoff time
        // IMPORTANT: Use project's timezone for "today" comparison!
        // ═══════════════════════════════════════════════════════════════
        var actionLower = request.Action.ToLower();
        if (actionLower is "cancel" or "pause" or "changecombo")
        {
            // Check each order against its project's timezone and cutoff
            foreach (var order in orders)
            {
                if (order.Project != null && TimezoneHelper.IsToday(order.OrderDate, order.Project.Timezone))
                {
                    if (TimezoneHelper.IsCutoffPassed(order.Project.CutoffTime, order.Project.Timezone))
                    {
                        throw new BusinessRuleException(
                            ErrorCodes.ORDER_CUTOFF_PASSED,
                            $"Время для изменения заказов на сегодня истекло в {order.Project.CutoffTime}. " +
                            $"Заказы на завтра и далее можно изменять.");
                    }
                }
            }
        }

        var updated = 0;
        var refundedAmount = 0m;
        var skipped = new List<string>();

        foreach (var order in orders)
        {
            var result = await ProcessBulkActionAsync(order, request, company, cancellationToken);
            if (result.Success)
            {
                updated++;
                refundedAmount += result.RefundAmount;
            }
            else
            {
                skipped.Add(result.SkipReason!);
            }
        }

        // NOTE: TotalPrice is calculated dynamically when reading subscription data
        // No manual update needed here - this simplifies code and prevents inconsistencies

        await _context.SaveChangesAsync(cancellationToken);

        var message = BuildBulkActionMessage(request.Action, updated, refundedAmount, skipped.Count);

        return new BulkActionResult(message, updated, refundedAmount, skipped);
    }

    #region Private Helper Methods

    // ═══════════════════════════════════════════════════════════════════════════
    // ОПТИМИЗИРОВАННЫЕ МЕТОДЫ - Фильтрация и пагинация на уровне SQL
    // ═══════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// FAST PATH: Получение LUNCH заказов с полной SQL пагинацией.
    /// Используется когда нужны только LUNCH заказы (самый частый сценарий).
    /// </summary>
    private async Task<PagedResult<OrderResponse>> GetLunchOrdersWithPaginationAsync(
        Guid companyId,
        Guid? projectId,
        string? search,
        string? statusFilter,
        string? dateFilter,
        string? addressFilter,
        string? typeFilter,
        string? comboTypeFilter,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var query = BuildLunchOrdersQuery(companyId, projectId, search, statusFilter,
            dateFilter, addressFilter, typeFilter, comboTypeFilter);

        // Получаем общее количество (один COUNT запрос)
        var total = await query.CountAsync(cancellationToken);

        // Применяем сортировку и пагинацию на уровне SQL
        var pagedOrders = await query
            .OrderByDescending(o => o.OrderDate)
            .ThenBy(o => o.Employee != null ? o.Employee.FullName : o.GuestName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            // Проекция - только нужные поля (избегаем полной загрузки сущностей)
            .Select(o => new OrderResponse
            {
                Id = o.Id,
                EmployeeId = o.EmployeeId,
                EmployeeName = o.Employee != null ? o.Employee.FullName : (o.GuestName ?? "Гость"),
                EmployeePhone = o.Employee != null ? o.Employee.Phone : null,
                Date = o.OrderDate.ToString("yyyy-MM-dd"),
                Status = o.Status.ToRussian(),
                Address = o.Project != null
                    ? (!string.IsNullOrEmpty(o.Project.AddressFullAddress)
                        ? o.Project.AddressFullAddress
                        : (o.Project.AddressName ?? ""))
                    : "",
                ProjectId = o.ProjectId,
                ProjectName = o.Project != null ? o.Project.Name : null,
                ComboType = o.ComboType,
                Amount = o.Price,
                Type = o.IsGuestOrder ? "Гость" : "Сотрудник",
                ServiceType = "LUNCH"
            })
            .ToListAsync(cancellationToken);

        return PagedResult<OrderResponse>.Create(pagedOrders, total, page, pageSize);
    }

    /// <summary>
    /// Получение LUNCH заказов без пагинации (для смешанного режима LUNCH+COMPENSATION).
    /// </summary>
    private async Task<IEnumerable<OrderResponse>> GetLunchOrdersOptimizedAsync(
        Guid companyId,
        Guid? projectId,
        string? search,
        string? statusFilter,
        string? dateFilter,
        string? addressFilter,
        string? typeFilter,
        string? comboTypeFilter,
        CancellationToken cancellationToken)
    {
        var query = BuildLunchOrdersQuery(companyId, projectId, search, statusFilter,
            dateFilter, addressFilter, typeFilter, comboTypeFilter);

        // Проекция - только нужные поля
        return await query
            .Select(o => new OrderResponse
            {
                Id = o.Id,
                EmployeeId = o.EmployeeId,
                EmployeeName = o.Employee != null ? o.Employee.FullName : (o.GuestName ?? "Гость"),
                EmployeePhone = o.Employee != null ? o.Employee.Phone : null,
                Date = o.OrderDate.ToString("yyyy-MM-dd"),
                Status = o.Status.ToRussian(),
                Address = o.Project != null
                    ? (!string.IsNullOrEmpty(o.Project.AddressFullAddress)
                        ? o.Project.AddressFullAddress
                        : (o.Project.AddressName ?? ""))
                    : "",
                ProjectId = o.ProjectId,
                ProjectName = o.Project != null ? o.Project.Name : null,
                ComboType = o.ComboType,
                Amount = o.Price,
                Type = o.IsGuestOrder ? "Гость" : "Сотрудник",
                ServiceType = "LUNCH"
            })
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    /// Строит базовый запрос для LUNCH заказов со всеми фильтрами на уровне SQL.
    /// </summary>
    private IQueryable<Order> BuildLunchOrdersQuery(
        Guid companyId,
        Guid? projectId,
        string? search,
        string? statusFilter,
        string? dateFilter,
        string? addressFilter,
        string? typeFilter,
        string? comboTypeFilter)
    {
        var query = _context.Orders
            .AsNoTracking()
            .Where(o => o.CompanyId == companyId);

        // Фильтр по проекту
        if (projectId.HasValue)
        {
            query = query.Where(o => o.ProjectId == projectId.Value);
        }

        // Фильтр по адресу (projectId)
        if (!string.IsNullOrWhiteSpace(addressFilter) && Guid.TryParse(addressFilter, out var filterProjectId))
        {
            query = query.Where(o => o.ProjectId == filterProjectId);
        }

        // ═══════════════════════════════════════════════════════════════
        // ОПТИМИЗАЦИЯ: Фильтр по статусу НА УРОВНЕ SQL
        // Конвертируем русский статус в enum, затем обратно в строку для БД
        // ═══════════════════════════════════════════════════════════════
        if (!string.IsNullOrWhiteSpace(statusFilter))
        {
            var statusEnum = OrderStatusExtensions.FromRussian(statusFilter);
            query = query.Where(o => o.Status == statusEnum);
        }

        // ═══════════════════════════════════════════════════════════════
        // ОПТИМИЗАЦИЯ: Фильтр по дате НА УРОВНЕ SQL
        // Используем диапазон дат для корректной работы с timezone
        // ═══════════════════════════════════════════════════════════════
        if (!string.IsNullOrWhiteSpace(dateFilter) && DateOnly.TryParse(dateFilter, out var parsedDate))
        {
            var targetDateStart = parsedDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var targetDateEnd = parsedDate.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(o => o.OrderDate >= targetDateStart && o.OrderDate < targetDateEnd);
        }

        // Фильтр по типу (гость/сотрудник)
        if (!string.IsNullOrWhiteSpace(typeFilter))
        {
            query = typeFilter.ToLower() switch
            {
                "guest" => query.Where(o => o.IsGuestOrder),
                "employee" => query.Where(o => !o.IsGuestOrder),
                _ => query
            };
        }

        // Фильтр по типу комбо
        if (!string.IsNullOrWhiteSpace(comboTypeFilter))
        {
            query = query.Where(o => o.ComboType == comboTypeFilter);
        }

        // Поиск по имени (employee или guest)
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(o =>
                (o.Employee != null && o.Employee.FullName.ToLower().Contains(searchLower)) ||
                (o.GuestName != null && o.GuestName.ToLower().Contains(searchLower)));
        }

        return query;
    }

    /// <summary>
    /// ОПТИМИЗИРОВАННАЯ версия: Получение компенсационных транзакций с фильтрацией на уровне SQL.
    /// </summary>
    private async Task<IEnumerable<OrderResponse>> GetCompensationTransactionsOptimizedAsync(
        Guid companyId,
        Guid? projectId,
        string? search,
        string? dateFilter,
        CancellationToken cancellationToken)
    {
        var query = _context.Set<CompensationTransaction>()
            .AsNoTracking()
            .Where(ct => ct.Project != null && ct.Project.CompanyId == companyId);

        // Фильтр по проекту
        if (projectId.HasValue)
        {
            query = query.Where(ct => ct.ProjectId == projectId.Value);
        }

        // ═══════════════════════════════════════════════════════════════
        // ОПТИМИЗАЦИЯ: Фильтр по дате НА УРОВНЕ SQL
        // ═══════════════════════════════════════════════════════════════
        if (!string.IsNullOrWhiteSpace(dateFilter) && DateOnly.TryParse(dateFilter, out var filterDateOnly))
        {
            query = query.Where(ct => ct.TransactionDate == filterDateOnly);
        }

        // Поиск по имени сотрудника
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(ct =>
                ct.Employee != null && ct.Employee.FullName.ToLower().Contains(searchLower));
        }

        // ═══════════════════════════════════════════════════════════════
        // ОПТИМИЗАЦИЯ: Используем проекцию с JOIN для получения лимита
        // Избегаем дополнительного запроса к Projects
        // ═══════════════════════════════════════════════════════════════
        return await query
            .Select(ct => new OrderResponse
            {
                Id = ct.Id,
                EmployeeId = ct.EmployeeId,
                EmployeeName = ct.Employee != null ? ct.Employee.FullName : "Сотрудник",
                EmployeePhone = ct.Employee != null ? ct.Employee.Phone : null,
                Date = ct.TransactionDate.ToString("yyyy-MM-dd"),
                Status = OrderStatus.Completed.ToRussian(),  // Compensation transactions are always completed
                Address = ct.RestaurantName ?? "",
                ComboType = "",
                Amount = ct.TotalAmount,
                Type = "Сотрудник",
                ServiceType = "COMPENSATION",
                CompensationLimit = ct.Project != null ? ct.Project.CompensationDailyLimit : 0,
                CompensationAmount = ct.CompanyPaidAmount,
                RestaurantName = ct.RestaurantName
            })
            .ToListAsync(cancellationToken);
    }

    private static void ValidateCutoffTime(TimeOnly cutoffTime, string? timezone)
    {
        if (TimezoneHelper.IsCutoffPassed(cutoffTime, timezone))
        {
            throw new InvalidOperationException($"Время для заказов на сегодня истекло в {cutoffTime}");
        }
    }

    private static void ValidateBudget(decimal budget, decimal overdraftLimit, decimal requiredAmount)
    {
        if (budget + overdraftLimit < requiredAmount)
        {
            throw new InvalidOperationException("Недостаточно бюджета для создания заказов");
        }
    }

    private static DateTime ParseOrderDate(string dateString)
    {
        return DateTime.TryParse(dateString, out var parsedDate)
            ? DateTime.SpecifyKind(parsedDate, DateTimeKind.Utc)
            : DateTime.UtcNow;
    }

    private static List<Order> CreateGuestOrders(
        CreateGuestOrderRequest request,
        Guid companyId,
        Guid projectId,
        decimal price,
        DateTime orderDate,
        string? currencyCode)
    {
        var orders = new List<Order>();
        for (int i = 0; i < request.Quantity; i++)
        {
            orders.Add(new Order
            {
                Id = Guid.NewGuid(),
                CompanyId = companyId,
                ProjectId = projectId,
                GuestName = request.OrderName,
                ComboType = request.ComboType,
                Price = price,
                CurrencyCode = currencyCode ?? "TJS",
                Status = OrderStatus.Active,
                OrderDate = orderDate,
                IsGuestOrder = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }
        return orders;
    }

    private async Task CreateGuestOrderTransactionsAsync(
        List<Order> orders,
        Guid companyId,
        Guid? projectId,
        CancellationToken cancellationToken)
    {
        foreach (var order in orders)
        {
            var transaction = new CompanyTransaction
            {
                Id = Guid.NewGuid(),
                CompanyId = companyId,
                ProjectId = projectId,
                Type = TransactionType.GuestOrder,
                Amount = -order.Price,
                DailyOrderId = order.Id,
                Description = order.GuestName ?? "Гость",
                CreatedAt = DateTime.UtcNow
            };
            await _context.CompanyTransactions.AddAsync(transaction, cancellationToken);
        }
    }

    private static OrderResponse MapToOrderResponse(Order order, Project project)
    {
        return new OrderResponse
        {
            Id = order.Id,
            EmployeeName = order.GuestName ?? "Гость",
            Date = order.OrderDate.ToString("yyyy-MM-dd"),
            Status = order.Status.ToRussian(),
            Address = project.AddressFullAddress,
            ProjectId = project.Id,
            ProjectName = project.Name,
            ComboType = order.ComboType,
            Amount = order.Price,
            Type = "guest"
        };
    }

    private static (bool IsValid, string? Reason) ValidateEmployeeForMealAssignment(
        Employee employee, decimal price, DateTime orderDate)
    {
        if (employee.DeletedAt.HasValue)
            return (false, "удалён");

        if (!employee.IsActive)
            return (false, "неактивен");

        if (employee.ServiceType == ServiceType.Compensation)
            return (false, "тип услуги: Компенсация");

        if (employee.Project == null)
            return (false, "нет проекта");

        if (employee.Budget == null || employee.Budget.TotalBudget < price)
            return (false, "недостаточно бюджета");

        return (true, null);
    }

    private static Order CreateEmployeeOrder(
        Employee employee,
        Guid companyId,
        string comboType,
        decimal price,
        DateTime orderDate,
        string? currencyCode)
    {
        return new Order
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            ProjectId = employee.ProjectId,
            EmployeeId = employee.Id,
            ComboType = comboType,
            Price = price,
            CurrencyCode = currencyCode ?? "TJS",
            Status = OrderStatus.Active,
            OrderDate = orderDate,
            IsGuestOrder = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private async Task<(bool Success, decimal RefundAmount, string? SkipReason)> ProcessBulkActionAsync(
        Order order,
        BulkActionRequest request,
        Company? company,
        CancellationToken cancellationToken)
    {
        try
        {
            return request.Action.ToLower() switch
            {
                "pause" => ProcessPauseAction(order),
                "resume" => ProcessResumeAction(order),
                "changecombo" => ProcessChangeComboAction(order, request.ComboType),
                "cancel" => await ProcessCancelActionAsync(order, company, cancellationToken),
                _ => (false, 0, $"Неизвестное действие: {request.Action}")
            };
        }
        catch (InvalidOperationException ex)
        {
            return (false, 0, $"{order.GuestName ?? order.Employee?.FullName}: {ex.Message}");
        }
    }

    private static (bool Success, decimal RefundAmount, string? SkipReason) ProcessPauseAction(Order order)
    {
        if (OrderStateMachine.CanTransition(order.Status, OrderStatus.Paused))
        {
            order.Status = OrderStatus.Paused;
            order.UpdatedAt = DateTime.UtcNow;
            return (true, 0, null);
        }
        return (false, 0, $"{order.GuestName ?? order.Employee?.FullName}: {OrderStateMachine.GetAllowedTransitions(order.Status)}");
    }

    private static (bool Success, decimal RefundAmount, string? SkipReason) ProcessResumeAction(Order order)
    {
        if (OrderStateMachine.CanTransition(order.Status, OrderStatus.Active))
        {
            order.Status = OrderStatus.Active;
            order.UpdatedAt = DateTime.UtcNow;
            return (true, 0, null);
        }
        return (false, 0, $"{order.GuestName ?? order.Employee?.FullName}: невозможно возобновить");
    }

    private static (bool Success, decimal RefundAmount, string? SkipReason) ProcessChangeComboAction(Order order, string? newComboType)
    {
        if (string.IsNullOrWhiteSpace(newComboType) || !order.CanBeModified)
        {
            return (false, 0, $"{order.GuestName ?? order.Employee?.FullName}: нельзя изменить");
        }

        var oldPrice = order.Price;
        var newPrice = ComboPricingConstants.GetPrice(newComboType);
        var priceDiff = newPrice - oldPrice;

        // ═══════════════════════════════════════════════════════════════
        // BUDGET CORRECTION: Только для Completed заказов!
        // Active/Paused заказы ещё не списаны - корректировка не нужна.
        // Completed заказы уже списаны - нужно доплатить/вернуть разницу.
        // ═══════════════════════════════════════════════════════════════
        var needsBudgetCorrection = order.Status == OrderStatus.Completed && priceDiff != 0;

        if (needsBudgetCorrection)
        {
            var isCompensationOrder = !order.IsGuestOrder &&
                                       order.Employee?.ServiceType == ServiceType.Compensation;

            if (isCompensationOrder && order.Employee?.Budget != null)
            {
                // Compensation order: deduct/refund from Employee budget
                order.Employee.Budget.TotalBudget -= priceDiff;
            }
            else if (order.Project != null)
            {
                // Guest order or LUNCH order: deduct/refund from Project budget
                // priceDiff > 0 means upgrade (charge more), priceDiff < 0 means downgrade (refund)
                order.Project.Budget -= priceDiff;
                order.Project.UpdatedAt = DateTime.UtcNow;
            }
        }

        order.ChangeComboType(newComboType);
        order.Price = newPrice;
        return (true, 0, null);
    }

    private async Task<(bool Success, decimal RefundAmount, string? SkipReason)> ProcessCancelActionAsync(
        Order order,
        Company? company,
        CancellationToken cancellationToken)
    {
        if (!order.CanBeCancelled)
        {
            return (false, 0, $"{order.GuestName ?? order.Employee?.FullName}: нельзя отменить");
        }

        decimal refundAmount = 0;

        // ═══════════════════════════════════════════════════════════════
        // REFUND LOGIC: Возврат только для COMPLETED заказов!
        // Active/Paused заказы ещё не списаны - возврата не требуется.
        // Completed заказы уже списаны через DailySettlementJob - нужен возврат.
        // ═══════════════════════════════════════════════════════════════
        var needsRefund = order.Status == OrderStatus.Completed;

        if (needsRefund)
        {
            var isCompensationOrder = !order.IsGuestOrder &&
                                       order.Employee?.ServiceType == ServiceType.Compensation;

            if (isCompensationOrder && order.Employee?.Budget != null)
            {
                // Compensation order: refund to Employee budget
                order.Employee.Budget.TotalBudget += order.Price;
                refundAmount = order.Price;
            }
            else if (order.Project != null)
            {
                // Guest order or LUNCH order: refund to Project budget
                order.Project.Budget += order.Price;
                order.Project.UpdatedAt = DateTime.UtcNow;
                refundAmount = order.Price;

                // Create transaction record for audit trail
                // Description = только уникальная инфа (имя), дата/сумма есть в других колонках
                var employeeName = order.IsGuestOrder
                    ? order.GuestName ?? "Гость"
                    : order.Employee?.FullName ?? "Сотрудник";
                var transaction = new CompanyTransaction
                {
                    Id = Guid.NewGuid(),
                    CompanyId = order.CompanyId,
                    ProjectId = order.ProjectId,
                    Type = TransactionType.Refund,
                    Amount = order.Price,
                    DailyOrderId = order.Id,
                    Description = $"Отмена заказа: {employeeName}",
                    CreatedAt = DateTime.UtcNow
                };
                await _context.CompanyTransactions.AddAsync(transaction, cancellationToken);
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // BUSINESS RULE: Если отменяется заказ сотрудника на БУДУЩЕЕ и у сотрудника
        // НЕТ активной подписки — УДАЛЯЕМ заказ (нет смысла хранить)
        // Если есть активная подписка или заказ на сегодня/прошлое — меняем статус
        // ═══════════════════════════════════════════════════════════════
        var isFutureOrder = order.OrderDate.Date > DateTime.UtcNow.Date;
        var hasActiveSubscription = false;

        if (!order.IsGuestOrder && order.EmployeeId.HasValue)
        {
            hasActiveSubscription = await _context.LunchSubscriptions
                .AnyAsync(s => s.EmployeeId == order.EmployeeId && s.IsActive, cancellationToken);
        }

        if (!order.IsGuestOrder && isFutureOrder && !hasActiveSubscription)
        {
            // Удаляем заказ полностью — нет смысла хранить отменённый будущий заказ без подписки
            _context.Orders.Remove(order);
        }
        else
        {
            // Стандартное поведение: меняем статус на "Отменён"
            order.Cancel();
        }

        return (true, refundAmount, null);
    }

    private static string BuildBulkActionMessage(string action, int updated, decimal refundedAmount, int skippedCount)
    {
        var message = action.ToLower() == "cancel" && refundedAmount > 0
            ? $"Отменено {updated} заказов. Возвращено {refundedAmount:N0} TJS"
            : $"Обновлено {updated} заказов";

        if (skippedCount > 0)
        {
            message += $" (пропущено: {skippedCount})";
        }

        return message;
    }

    #endregion
}

