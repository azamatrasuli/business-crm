using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Dashboard;
using YallaBusinessAdmin.Application.Dashboard.Dtos;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class DashboardService : IDashboardService
{
    private readonly AppDbContext _context;

    // Combo prices - only Комбо 25 and Комбо 35 are supported
    private static readonly Dictionary<string, decimal> ComboPrices = new()
    {
        { "Комбо 25", 25.00m },
        { "Комбо 35", 35.00m }
    };

    public DashboardService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<DashboardResponse> GetDashboardAsync(Guid companyId, Guid? projectId = null, CancellationToken cancellationToken = default)
    {
        // If projectId provided, use project data; otherwise fall back to company
        Project? project = null;
        Company? company = null;
        
        if (projectId.HasValue)
        {
            project = await _context.Projects
                .FirstOrDefaultAsync(p => p.Id == projectId.Value && p.CompanyId == companyId, cancellationToken);
            
            if (project == null)
            {
                throw new KeyNotFoundException("Проект не найден");
            }
        }
        else
        {
            company = await _context.Companies
                .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken);

            if (company == null)
            {
                throw new KeyNotFoundException("Компания не найдена");
            }
        }

        // Use project or company data
        var budget = project?.Budget ?? company!.Budget;
        var overdraftLimit = project?.OverdraftLimit ?? company!.OverdraftLimit;
        var timezone = project?.Timezone ?? company!.Timezone ?? "Asia/Dushanbe";
        var cutoffTime = project?.CutoffTime ?? company!.CutoffTime;
        var currencyCode = project?.CurrencyCode ?? company!.CurrencyCode ?? "TJS";

        var ordersQuery = _context.Orders.Where(o => o.CompanyId == companyId);
        
        // Filter by project if specified
        if (projectId.HasValue)
        {
            ordersQuery = ordersQuery.Where(o => o.ProjectId == projectId.Value);
        }
        
        var orders = await ordersQuery.ToListAsync(cancellationToken);

        var activeOrders = orders.Count(o => o.Status == OrderStatus.Active);
        var pausedOrders = orders.Count(o => o.Status == OrderStatus.Paused);
        var guestOrders = orders.Count(o => o.IsGuestOrder);
        var activeGuestOrders = orders.Count(o => o.IsGuestOrder && o.Status == OrderStatus.Active);
        var pausedGuestOrders = orders.Count(o => o.IsGuestOrder && o.Status == OrderStatus.Paused);

        // Calculate forecast (sum of active order prices)
        var forecast = orders
            .Where(o => o.Status == OrderStatus.Active)
            .Sum(o => o.Price);

        // Today vs yesterday comparison
        var today = DateTime.UtcNow.Date;
        var yesterday = today.AddDays(-1);
        var todayOrders = orders.Count(o => o.OrderDate.Date == today);
        var yesterdayOrders = orders.Count(o => o.OrderDate.Date == yesterday);
        var ordersChange = todayOrders - yesterdayOrders;
        var ordersChangePercent = yesterdayOrders > 0 
            ? Math.Round((decimal)ordersChange / yesterdayOrders * 100, 1) 
            : 0;

        // Budget calculations
        var availableBudget = budget + overdraftLimit;
        var totalBudgetWithOverdraft = budget > 0 ? budget : availableBudget;
        var budgetConsumptionPercent = totalBudgetWithOverdraft > 0 
            ? Math.Round(forecast / totalBudgetWithOverdraft * 100, 1) 
            : 0;

        // Low budget warning (warn if less than 20% remaining or negative balance)
        const decimal LowBudgetThreshold = 0.20m;
        var isLowBudget = budget <= 0 || (availableBudget > 0 && budget / availableBudget < LowBudgetThreshold);
        string? lowBudgetWarning = null;
        if (budget <= 0)
        {
            lowBudgetWarning = budget < 0 
                ? $"Бюджет отрицательный: {budget:N0} {currencyCode}. Используется овердрафт." 
                : "Бюджет исчерпан. Пополните счет.";
        }
        else if (isLowBudget)
        {
            lowBudgetWarning = $"Низкий остаток бюджета: {budget:N0} {currencyCode} ({Math.Round(budget / availableBudget * 100)}%)";
        }

        // Cutoff time check
        var now = DateTime.UtcNow;
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(now, GetTimeZoneInfo(timezone));
        var cutoffToday = localNow.Date.Add(cutoffTime.ToTimeSpan());
        var isCutoffPassed = localNow > cutoffToday;

        return new DashboardResponse
        {
            TotalBudget = budget,
            Forecast = forecast,
            TotalOrders = orders.Count,
            ActiveOrders = activeOrders,
            PausedOrders = pausedOrders,
            GuestOrders = guestOrders,
            ActiveGuestOrders = activeGuestOrders,
            PausedGuestOrders = pausedGuestOrders,
            
            // Comparison stats
            TodayOrders = todayOrders,
            YesterdayOrders = yesterdayOrders,
            OrdersChange = ordersChange,
            OrdersChangePercent = ordersChangePercent,
            
            // Budget stats
            BudgetConsumptionPercent = budgetConsumptionPercent,
            OverdraftLimit = overdraftLimit,
            AvailableBudget = availableBudget,
            IsLowBudget = isLowBudget,
            LowBudgetWarning = lowBudgetWarning,
            
            // Cutoff info
            CutoffTime = cutoffTime.ToString("HH:mm"),
            IsCutoffPassed = isCutoffPassed,
            Timezone = timezone
        };
    }

    public async Task<PagedResult<OrderResponse>> GetOrdersAsync(
        Guid companyId,
        int page,
        int pageSize,
        string? search,
        string? statusFilter,
        string? dateFilter,
        string? addressFilter,
        string? typeFilter,
        Guid? projectId = null,
        CancellationToken cancellationToken = default)
    {
        var results = new List<OrderResponse>();
        
        // ═══════════════════════════════════════════════════════════════
        // 1. Get LUNCH orders from orders table
        // Address is derived from Project (one project = one address)
        // ═══════════════════════════════════════════════════════════════
        var ordersQuery = _context.Orders
            .Include(o => o.Employee)
            .Include(o => o.Project)
            .Where(o => o.CompanyId == companyId);
        
        if (projectId.HasValue)
        {
            ordersQuery = ordersQuery.Where(o => o.ProjectId == projectId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            ordersQuery = ordersQuery.Where(o =>
                (o.Employee != null && o.Employee.FullName.ToLower().Contains(searchLower)) ||
                (o.GuestName != null && o.GuestName.ToLower().Contains(searchLower)));
        }

        // Address filter now works with project ID (since address is embedded in project)
        if (!string.IsNullOrWhiteSpace(addressFilter) && Guid.TryParse(addressFilter, out var filterProjectId))
        {
            ordersQuery = ordersQuery.Where(o => o.ProjectId == filterProjectId);
        }

        if (!string.IsNullOrWhiteSpace(typeFilter))
        {
            ordersQuery = typeFilter.ToLower() switch
            {
                "guest" => ordersQuery.Where(o => o.IsGuestOrder),
                "employee" => ordersQuery.Where(o => !o.IsGuestOrder),
                _ => ordersQuery
            };
        }

        var allOrders = await ordersQuery.ToListAsync(cancellationToken);

        // Apply status filter in memory
        if (!string.IsNullOrWhiteSpace(statusFilter))
        {
            var statusEnum = OrderStatusExtensions.FromRussian(statusFilter);
            allOrders = allOrders.Where(o => o.Status == statusEnum).ToList();
        }

        // Apply date filter in memory
        DateTime? filterDateUtc = null;
        if (!string.IsNullOrWhiteSpace(dateFilter) && DateTime.TryParse(dateFilter, out var filterDate))
        {
            filterDateUtc = DateTime.SpecifyKind(filterDate.Date, DateTimeKind.Utc);
            allOrders = allOrders.Where(o => o.OrderDate.Date == filterDateUtc.Value.Date).ToList();
        }

        // Map lunch orders to response
        // Address comes from Project (one project = one address)
        results.AddRange(allOrders.Select(o => new OrderResponse
        {
            Id = o.Id,
            EmployeeId = o.EmployeeId,
            EmployeeName = o.Employee?.FullName ?? o.GuestName ?? "Гость",
            EmployeePhone = o.Employee?.Phone,
            Date = o.OrderDate.ToString("yyyy-MM-dd"),
            Status = o.Status.ToRussian(),
            Address = o.Project?.AddressFullAddress ?? "",
            ProjectId = o.ProjectId,
            ProjectName = o.Project?.Name,
            ComboType = o.ComboType,
            Amount = o.Price,
            Type = o.IsGuestOrder ? "Гость" : "Сотрудник",
            ServiceType = "LUNCH"
        }));

        // ═══════════════════════════════════════════════════════════════
        // 2. Get COMPENSATION transactions
        // ═══════════════════════════════════════════════════════════════
        var compTransQuery = _context.Set<CompensationTransaction>()
            .Include(ct => ct.Employee)
            .Include(ct => ct.Project)
            .Where(ct => ct.Project != null && ct.Project.CompanyId == companyId);

        if (projectId.HasValue)
        {
            compTransQuery = compTransQuery.Where(ct => ct.ProjectId == projectId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            compTransQuery = compTransQuery.Where(ct =>
                ct.Employee != null && ct.Employee.FullName.ToLower().Contains(searchLower));
        }

        // For compensation, we only show employee transactions (no guests, no address filter)
        if (!string.IsNullOrWhiteSpace(typeFilter) && typeFilter.ToLower() == "guest")
        {
            // Skip compensation transactions when filtering for guests only
        }
        else
        {
            var allCompTransactions = await compTransQuery.ToListAsync(cancellationToken);

            // Apply date filter
            if (filterDateUtc.HasValue)
            {
                allCompTransactions = allCompTransactions
                    .Where(ct => ct.TransactionDate == DateOnly.FromDateTime(filterDateUtc.Value))
                    .ToList();
            }

            // Get daily limits from projects
            var projectIds = allCompTransactions.Select(ct => ct.ProjectId).Distinct().ToList();
            var projects = await _context.Projects
                .Where(p => projectIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.CompensationDailyLimit, cancellationToken);

            results.AddRange(allCompTransactions.Select(ct => new OrderResponse
            {
                Id = ct.Id,
                EmployeeId = ct.EmployeeId,
                EmployeeName = ct.Employee?.FullName ?? "Сотрудник",
                EmployeePhone = ct.Employee?.Phone,
                Date = ct.TransactionDate.ToString("yyyy-MM-dd"),
                Status = "Завершен", // Compensation transactions are always completed
                Address = ct.RestaurantName ?? "",
                ComboType = "",
                Amount = ct.TotalAmount,
                Type = "Сотрудник",
                ServiceType = "COMPENSATION",
                CompensationLimit = projects.GetValueOrDefault(ct.ProjectId, 0),
                CompensationAmount = ct.CompanyPaidAmount,
                RestaurantName = ct.RestaurantName
            }));

            // NOTE: Demo data removed - only real compensation transactions are shown
        }

        // ═══════════════════════════════════════════════════════════════
        // 3. Sort combined results and paginate
        // ═══════════════════════════════════════════════════════════════
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

    public async Task<CreateGuestOrderResponse> CreateGuestOrderAsync(CreateGuestOrderRequest request, Guid companyId, Guid? projectId = null, CancellationToken cancellationToken = default)
    {
        // Guest orders require a project (address comes from project)
        var targetProjectId = request.ProjectId != Guid.Empty ? request.ProjectId : projectId;
        
        if (!targetProjectId.HasValue || targetProjectId.Value == Guid.Empty)
        {
            throw new InvalidOperationException("Необходимо указать проект для гостевого заказа");
        }
        
        var project = await _context.Projects
            .FirstOrDefaultAsync(p => p.Id == targetProjectId.Value && p.CompanyId == companyId, cancellationToken);
        
        if (project == null)
        {
            throw new KeyNotFoundException("Проект не найден");
        }
        
        var budget = project.Budget;
        var overdraftLimit = project.OverdraftLimit;
        var timezone = project.Timezone ?? "Asia/Dushanbe";
        var cutoffTime = project.CutoffTime;
        var currencyCode = project.CurrencyCode ?? "TJS";

        // Check cutoff time
        var now = DateTime.UtcNow;
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(now, GetTimeZoneInfo(timezone));
        var cutoffToday = localNow.Date.Add(cutoffTime.ToTimeSpan());
        
        if (localNow > cutoffToday)
        {
            throw new InvalidOperationException($"Время для заказов на сегодня истекло в {cutoffTime}");
        }

        var price = ComboPrices.GetValueOrDefault(request.ComboType, 45.00m);
        var totalCost = price * request.Quantity;

        // Check budget with overdraft limit
        if (budget + overdraftLimit < totalCost)
        {
            throw new InvalidOperationException("Недостаточно бюджета для создания заказов");
        }

        var orderDate = DateTime.TryParse(request.Date, out var parsedDate) 
            ? DateTime.SpecifyKind(parsedDate, DateTimeKind.Utc) 
            : DateTime.UtcNow;
        var orders = new List<Order>();

        for (int i = 0; i < request.Quantity; i++)
        {
            var order = new Order
            {
                Id = Guid.NewGuid(),
                CompanyId = companyId,
                ProjectId = targetProjectId.Value,
                GuestName = request.OrderName,
                ComboType = request.ComboType,
                Price = price,
                CurrencyCode = currencyCode,
                Status = OrderStatus.Active,
                OrderDate = orderDate,
                IsGuestOrder = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            orders.Add(order);
            await _context.Orders.AddAsync(order, cancellationToken);
        }

        // Deduct from project budget
        project.Budget -= totalCost;
        project.UpdatedAt = DateTime.UtcNow;
        budget = project.Budget;

        // Create transaction record for each order
        foreach (var order in orders)
        {
            var transaction = new CompanyTransaction
            {
                Id = Guid.NewGuid(),
                CompanyId = companyId,
                ProjectId = targetProjectId,
                Type = TransactionType.GuestOrder,
                Amount = -order.Price,
                DailyOrderId = order.Id,
                BalanceAfter = budget,
                Description = $"Гостевой заказ: {order.GuestName}",
                CreatedAt = DateTime.UtcNow
            };
            await _context.CompanyTransactions.AddAsync(transaction, cancellationToken);
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new CreateGuestOrderResponse
        {
            Message = $"Создано {request.Quantity} гостевых заказов",
            TotalCost = totalCost,
            RemainingBudget = budget,
            Orders = orders.Select(o => new OrderResponse
            {
                Id = o.Id,
                EmployeeName = o.GuestName ?? "Гость",
                Date = o.OrderDate.ToString("yyyy-MM-dd"),
                Status = o.Status.ToRussian(),
                Address = project.AddressFullAddress,
                ProjectId = project.Id,
                ProjectName = project.Name,
                ComboType = o.ComboType,
                Amount = o.Price,
                Type = "guest"
            })
        };
    }

    public async Task<object> AssignMealsAsync(AssignMealsRequest request, Guid companyId, CancellationToken cancellationToken = default)
    {
        var company = await _context.Companies
            .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken);

        if (company == null)
        {
            throw new KeyNotFoundException("Компания не найдена");
        }

        // Load employees with their projects (address comes from project)
        var employees = await _context.Employees
            .Include(e => e.Budget)
            .Include(e => e.Project)
            .Where(e => request.EmployeeIds.Contains(e.Id) && e.CompanyId == companyId && e.IsActive)
            .ToListAsync(cancellationToken);

        var price = ComboPrices.GetValueOrDefault(request.ComboType, 45.00m);
        var orderDate = DateTime.TryParse(request.Date, out var parsedDate) 
            ? DateTime.SpecifyKind(parsedDate, DateTimeKind.Utc) 
            : DateTime.UtcNow;
        var createdOrders = new List<Order>();
        var skippedEmployees = new List<string>();

        foreach (var employee in employees)
        {
            // Employee must have a project (address comes from project)
            if (employee.Project == null)
            {
                skippedEmployees.Add($"{employee.FullName} (нет проекта)");
                continue;
            }
            
            // Check if employee has budget
            if (employee.Budget == null || employee.Budget.TotalBudget < price)
            {
                skippedEmployees.Add(employee.FullName);
                continue;
            }

            // Check if already has order for this date
            var existingOrder = await _context.Orders
                .AnyAsync(o => o.EmployeeId == employee.Id && o.OrderDate.Date == orderDate.Date, cancellationToken);

            if (existingOrder)
            {
                skippedEmployees.Add($"{employee.FullName} (уже есть заказ)");
                continue;
            }

            var order = new Order
            {
                Id = Guid.NewGuid(),
                CompanyId = companyId,
                ProjectId = employee.ProjectId, // Address comes from project
                EmployeeId = employee.Id,
                ComboType = request.ComboType,
                Price = price,
                CurrencyCode = company.CurrencyCode,
                Status = OrderStatus.Active,
                OrderDate = orderDate,
                IsGuestOrder = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            employee.Budget.TotalBudget -= price;
            createdOrders.Add(order);
            await _context.Orders.AddAsync(order, cancellationToken);
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new
        {
            message = $"Назначено {createdOrders.Count} заказов",
            created = createdOrders.Count,
            skipped = skippedEmployees
        };
    }

    public async Task<object> BulkActionAsync(BulkActionRequest request, Guid companyId, CancellationToken cancellationToken = default)
    {
        var orders = await _context.Orders
            .Include(o => o.Employee)
                .ThenInclude(e => e!.Budget)
            .Where(o => request.OrderIds.Contains(o.Id) && o.CompanyId == companyId)
            .ToListAsync(cancellationToken);

        var company = await _context.Companies
            .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken);

        var updated = 0;
        var refundedAmount = 0m;

        foreach (var order in orders)
        {
            switch (request.Action.ToLower())
            {
                case "pause":
                    if (order.Status == OrderStatus.Active)
                    {
                        order.Status = OrderStatus.Paused;
                        order.UpdatedAt = DateTime.UtcNow;
                        updated++;
                    }
                    break;
                    
                case "resume":
                    if (order.Status == OrderStatus.Paused)
                    {
                        order.Status = OrderStatus.Active;
                        order.UpdatedAt = DateTime.UtcNow;
                        updated++;
                    }
                    break;
                    
                // NOTE: changeaddress action removed - address is immutable per project
                // To change address, employee must be moved to a different project
                    
                case "changecombo":
                    if (!string.IsNullOrWhiteSpace(request.ComboType))
                    {
                        var oldPrice = order.Price;
                        var newPrice = ComboPrices.GetValueOrDefault(request.ComboType, oldPrice);
                        var priceDiff = newPrice - oldPrice;
                        
                        // Update employee budget if price changed
                        if (priceDiff != 0 && order.Employee?.Budget != null && !order.IsGuestOrder)
                        {
                            order.Employee.Budget.TotalBudget -= priceDiff;
                        }
                        
                        order.ComboType = request.ComboType;
                        order.Price = newPrice;
                        order.UpdatedAt = DateTime.UtcNow;
                        updated++;
                    }
                    break;
                    
                case "cancel":
                    if (order.Status != OrderStatus.Completed)
                    {
                        // Refund to employee or company budget
                        if (order.Employee?.Budget != null && !order.IsGuestOrder)
                        {
                            order.Employee.Budget.TotalBudget += order.Price;
                        }
                        else if (order.IsGuestOrder && company != null)
                        {
                            company.Budget += order.Price;
                            refundedAmount += order.Price;
                            
                            // Create refund transaction
                            var transaction = new CompanyTransaction
                            {
                                Id = Guid.NewGuid(),
                                CompanyId = companyId,
                                Type = TransactionType.Refund,
                                Amount = order.Price,
                                DailyOrderId = order.Id,
                                BalanceAfter = company.Budget,
                                Description = $"Возврат за отмененный заказ: {order.GuestName ?? order.Employee?.FullName}",
                                CreatedAt = DateTime.UtcNow
                            };
                            await _context.CompanyTransactions.AddAsync(transaction, cancellationToken);
                        }
                        
                        order.Status = OrderStatus.Completed;
                        order.UpdatedAt = DateTime.UtcNow;
                        updated++;
                    }
                    break;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        var message = request.Action.ToLower() == "cancel" && refundedAmount > 0
            ? $"Отменено {updated} заказов. Возвращено {refundedAmount:N0} TJS"
            : $"Обновлено {updated} заказов";

        return new
        {
            message,
            updated,
            refundedAmount
        };
    }

    public async Task<object> UpdateSubscriptionAsync(Guid employeeId, UpdateSubscriptionRequest request, Guid companyId, CancellationToken cancellationToken = default)
    {
        var employee = await _context.Employees
            .FirstOrDefaultAsync(e => e.Id == employeeId && e.CompanyId == companyId, cancellationToken);

        if (employee == null)
        {
            throw new KeyNotFoundException("Сотрудник не найден");
        }

        // NOTE: Address cannot be changed - it comes from employee's project
        // To change address, employee must be moved to a different project

        // Update active orders for this employee (only comboType can be changed)
        if (!string.IsNullOrWhiteSpace(request.ComboType))
        {
            var activeOrders = await _context.Orders
                .Where(o => o.EmployeeId == employeeId && o.Status == OrderStatus.Active)
                .ToListAsync(cancellationToken);

            foreach (var order in activeOrders)
            {
                order.ComboType = request.ComboType;
                order.Price = ComboPrices.GetValueOrDefault(request.ComboType, order.Price);
                order.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new { message = "Подписка обновлена" };
    }

    public async Task<object> BulkUpdateSubscriptionAsync(BulkUpdateSubscriptionRequest request, Guid companyId, CancellationToken cancellationToken = default)
    {
        var employees = await _context.Employees
            .Where(e => request.EmployeeIds.Contains(e.Id) && e.CompanyId == companyId)
            .ToListAsync(cancellationToken);

        var updated = 0;

        // NOTE: Address cannot be changed - it comes from employee's project
        // To change address, employee must be moved to a different project

        foreach (var employee in employees)
        {
            // Update active orders (only comboType can be changed)
            if (!string.IsNullOrWhiteSpace(request.ComboType))
            {
                var activeOrders = await _context.Orders
                    .Where(o => o.EmployeeId == employee.Id && o.Status == OrderStatus.Active)
                    .ToListAsync(cancellationToken);

                foreach (var order in activeOrders)
                {
                    order.ComboType = request.ComboType;
                    order.Price = ComboPrices.GetValueOrDefault(request.ComboType, order.Price);
                    order.UpdatedAt = DateTime.UtcNow;
                }
            }

            updated++;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new
        {
            message = $"Обновлено {updated} подписок",
            updated
        };
    }

    public async Task<object> GetCutoffTimeAsync(Guid companyId, CancellationToken cancellationToken = default)
    {
        var company = await _context.Companies
            .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken);

        if (company == null)
        {
            throw new KeyNotFoundException("Компания не найдена");
        }

        return new { time = company.CutoffTime.ToString("HH:mm") };
    }

    public async Task<object> UpdateCutoffTimeAsync(Guid companyId, string time, CancellationToken cancellationToken = default)
    {
        var company = await _context.Companies
            .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken);

        if (company == null)
        {
            throw new KeyNotFoundException("Компания не найдена");
        }

        if (TimeOnly.TryParse(time, out var parsedTime))
        {
            company.CutoffTime = parsedTime;
            company.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
        }
        else
        {
            throw new ArgumentException("Неверный формат времени");
        }

        return new { message = "Время отсечки обновлено", time = company.CutoffTime.ToString("HH:mm") };
    }

    private static TimeZoneInfo GetTimeZoneInfo(string timezone)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timezone);
        }
        catch
        {
            // Fallback to UTC if timezone not found
            return TimeZoneInfo.Utc;
        }
    }

}
