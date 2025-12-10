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
        var results = new List<OrderResponse>();

        // Determine which service types to include based on filter
        var includeLunch = string.IsNullOrWhiteSpace(serviceTypeFilter) || 
                           serviceTypeFilter.Equals("LUNCH", StringComparison.OrdinalIgnoreCase);
        var includeCompensation = string.IsNullOrWhiteSpace(serviceTypeFilter) || 
                                   serviceTypeFilter.Equals("COMPENSATION", StringComparison.OrdinalIgnoreCase);

        // Get LUNCH orders (skip if serviceType filter is COMPENSATION only)
        if (includeLunch)
        {
            var lunchOrders = await GetLunchOrdersAsync(
                companyId, projectId, search, statusFilter, dateFilter, addressFilter, typeFilter, comboTypeFilter,
                cancellationToken);
            results.AddRange(lunchOrders);
        }

        // Get COMPENSATION transactions (skip if serviceType is LUNCH only or type is guest)
        if (includeCompensation && typeFilter?.ToLower() != "guest")
        {
            var compTransactions = await GetCompensationTransactionsAsync(
                companyId, projectId, search, dateFilter, cancellationToken);
            results.AddRange(compTransactions);
        }

        // Sort and paginate
        var sortedResults = results
            .OrderByDescending(r => r.Date)
            .ThenBy(r => r.EmployeeName)
            .ToList();

        var total = sortedResults.Count;
        var pagedItems = sortedResults
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

        // Deduct from project budget
        project.Budget -= totalCost;
        project.UpdatedAt = DateTime.UtcNow;

        // Create transaction records
        await CreateGuestOrderTransactionsAsync(orders, companyId, targetProjectId, project.Budget, cancellationToken);

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Created {Count} guest orders for project {ProjectId}, total cost {Cost}",
            request.Quantity, targetProjectId, totalCost);

        return new CreateGuestOrderResponse
        {
            Message = $"Создано {request.Quantity} гостевых заказов",
            TotalCost = totalCost,
            RemainingBudget = project.Budget,
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

    private async Task<IEnumerable<OrderResponse>> GetLunchOrdersAsync(
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
        var query = _context.Orders
            .AsNoTracking()
            .Include(o => o.Employee)
            .Include(o => o.Project)
            .Where(o => o.CompanyId == companyId);

        if (projectId.HasValue)
        {
            query = query.Where(o => o.ProjectId == projectId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(o =>
                (o.Employee != null && o.Employee.FullName.ToLower().Contains(searchLower)) ||
                (o.GuestName != null && o.GuestName.ToLower().Contains(searchLower)));
        }

        if (!string.IsNullOrWhiteSpace(addressFilter) && Guid.TryParse(addressFilter, out var filterProjectId))
        {
            query = query.Where(o => o.ProjectId == filterProjectId);
        }

        if (!string.IsNullOrWhiteSpace(typeFilter))
        {
            query = typeFilter.ToLower() switch
            {
                "guest" => query.Where(o => o.IsGuestOrder),
                "employee" => query.Where(o => !o.IsGuestOrder),
                _ => query
            };
        }

        // Apply combo type filter at DB level
        if (!string.IsNullOrWhiteSpace(comboTypeFilter))
        {
            query = query.Where(o => o.ComboType == comboTypeFilter);
        }

        var allOrders = await query.ToListAsync(cancellationToken);

        // Apply status filter in memory
        if (!string.IsNullOrWhiteSpace(statusFilter))
        {
            var statusEnum = OrderStatusExtensions.FromRussian(statusFilter);
            allOrders = allOrders.Where(o => o.Status == statusEnum).ToList();
        }

        // Apply date filter in memory
        if (!string.IsNullOrWhiteSpace(dateFilter) && DateTime.TryParse(dateFilter, out var filterDate))
        {
            var filterDateUtc = DateTime.SpecifyKind(filterDate.Date, DateTimeKind.Utc);
            allOrders = allOrders.Where(o => o.OrderDate.Date == filterDateUtc.Date).ToList();
        }

        return allOrders.Select(o => new OrderResponse
        {
            Id = o.Id,
            EmployeeId = o.EmployeeId,
            EmployeeName = o.Employee?.FullName ?? o.GuestName ?? "Гость",
            EmployeePhone = o.Employee?.Phone,
            Date = o.OrderDate.ToString("yyyy-MM-dd"),
            Status = o.Status.ToRussian(),
            // Use AddressFullAddress with fallback to AddressName
            Address = !string.IsNullOrEmpty(o.Project?.AddressFullAddress) 
                ? o.Project.AddressFullAddress 
                : (o.Project?.AddressName ?? ""),
            ProjectId = o.ProjectId,
            ProjectName = o.Project?.Name,
            ComboType = o.ComboType,
            Amount = o.Price,
            Type = o.IsGuestOrder ? "Гость" : "Сотрудник",
            ServiceType = "LUNCH"
        });
    }

    private async Task<IEnumerable<OrderResponse>> GetCompensationTransactionsAsync(
        Guid companyId,
        Guid? projectId,
        string? search,
        string? dateFilter,
        CancellationToken cancellationToken)
    {
        var query = _context.Set<CompensationTransaction>()
            .AsNoTracking()
            .Include(ct => ct.Employee)
            .Include(ct => ct.Project)
            .Where(ct => ct.Project != null && ct.Project.CompanyId == companyId);

        if (projectId.HasValue)
        {
            query = query.Where(ct => ct.ProjectId == projectId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(ct =>
                ct.Employee != null && ct.Employee.FullName.ToLower().Contains(searchLower));
        }

        var transactions = await query.ToListAsync(cancellationToken);

        // Apply date filter
        if (!string.IsNullOrWhiteSpace(dateFilter) && DateTime.TryParse(dateFilter, out var filterDate))
        {
            var filterDateOnly = DateOnly.FromDateTime(filterDate);
            transactions = transactions
                .Where(ct => ct.TransactionDate == filterDateOnly)
                .ToList();
        }

        var projectIds = transactions.Select(ct => ct.ProjectId).Distinct().ToList();
        var projects = await _context.Projects
            .Where(p => projectIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.CompensationDailyLimit, cancellationToken);

        return transactions.Select(ct => new OrderResponse
        {
            Id = ct.Id,
            EmployeeId = ct.EmployeeId,
            EmployeeName = ct.Employee?.FullName ?? "Сотрудник",
            EmployeePhone = ct.Employee?.Phone,
            Date = ct.TransactionDate.ToString("yyyy-MM-dd"),
            Status = OrderStatus.Completed.ToRussian(),  // Compensation transactions are always completed
            Address = ct.RestaurantName ?? "",
            ComboType = "",
            Amount = ct.TotalAmount,
            Type = "Сотрудник",
            ServiceType = "COMPENSATION",
            CompensationLimit = projects.GetValueOrDefault(ct.ProjectId, 0),
            CompensationAmount = ct.CompanyPaidAmount,
            RestaurantName = ct.RestaurantName
        });
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
        decimal balanceAfter,
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
                BalanceAfter = balanceAfter,
                Description = $"Гостевой заказ: {order.GuestName}",
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

        if (priceDiff != 0)
        {
            if (order.IsGuestOrder && order.Project != null)
            {
                // Guest order: deduct/refund from Project budget
                // priceDiff > 0 means upgrade (need to charge more), priceDiff < 0 means downgrade (refund)
                order.Project.Budget -= priceDiff;
                order.Project.UpdatedAt = DateTime.UtcNow;
            }
            else if (order.Employee?.Budget != null)
            {
                // Employee order: deduct/refund from Employee budget
                order.Employee.Budget.TotalBudget -= priceDiff;
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

        if (order.IsGuestOrder && order.Project != null)
        {
            // Guest order: refund to Project budget (same source as creation)
            order.Project.Budget += order.Price;
            order.Project.UpdatedAt = DateTime.UtcNow;
            refundAmount = order.Price;

            // Create transaction record for audit trail
            var transaction = new CompanyTransaction
            {
                Id = Guid.NewGuid(),
                CompanyId = order.CompanyId,
                Type = TransactionType.Refund,
                Amount = order.Price,
                DailyOrderId = order.Id,
                BalanceAfter = order.Project.Budget,
                Description = $"Возврат за отмененный гостевой заказ: {order.GuestName}",
                CreatedAt = DateTime.UtcNow
            };
            await _context.CompanyTransactions.AddAsync(transaction, cancellationToken);
        }
        else if (order.Employee?.Budget != null)
        {
            // Employee order: refund to Employee budget
            order.Employee.Budget.TotalBudget += order.Price;
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

