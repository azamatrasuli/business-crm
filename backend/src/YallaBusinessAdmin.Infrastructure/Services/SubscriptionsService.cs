using System.Globalization;
using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Common.Errors;
using YallaBusinessAdmin.Application.Common.Interfaces;
using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Subscriptions;
using YallaBusinessAdmin.Application.Subscriptions.Dtos;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Domain.Helpers;
using YallaBusinessAdmin.Domain.StateMachines;
using YallaBusinessAdmin.Infrastructure.Persistence;
using YallaBusinessAdmin.Infrastructure.Services.Dashboard;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class SubscriptionsService : ISubscriptionsService
{
    private readonly AppDbContext _context;
    private readonly IBusinessConfigService _configService;

    public SubscriptionsService(AppDbContext context, IBusinessConfigService configService)
    {
        _context = context;
        _configService = configService;
    }

    public async Task<PagedResult<SubscriptionResponse>> GetAllAsync(
        Guid companyId,
        int page,
        int pageSize,
        string? search,
        bool? isActive,
        CancellationToken cancellationToken = default)
    {
        // NOTE: Address is now derived from Employee's Project (one project = one address)
        var query = _context.LunchSubscriptions
            .Include(s => s.Employee)
                .ThenInclude(e => e!.Project)
            .Where(s => s.CompanyId == companyId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(s =>
                s.Employee!.FullName.ToLower().Contains(searchLower) ||
                s.Employee.Phone.Contains(searchLower));
        }

        if (isActive.HasValue)
        {
            query = query.Where(s => s.IsActive == isActive.Value);
        }

        var total = await query.CountAsync(cancellationToken);
        var subscriptions = await query
            .OrderByDescending(s => s.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        // Calculate dynamic TotalDays and TotalPrice for each subscription
        var items = new List<SubscriptionResponse>();
        foreach (var sub in subscriptions)
        {
            var totalDays = await CalculateDynamicTotalDaysAsync(sub.EmployeeId, sub.StartDate, sub.EndDate, cancellationToken);
            var totalPrice = await CalculateDynamicTotalPriceAsync(sub.EmployeeId, cancellationToken);
            items.Add(MapToResponse(sub, totalDays, totalPrice));
        }
        return PagedResult<SubscriptionResponse>.Create(items, total, page, pageSize);
    }

    public async Task<SubscriptionResponse> GetByIdAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscription = await _context.LunchSubscriptions
            .Include(s => s.Employee)
                .ThenInclude(e => e!.Project)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == companyId, cancellationToken);

        if (subscription == null)
        {
            throw new KeyNotFoundException("Подписка не найдена");
        }

        var totalDays = await CalculateDynamicTotalDaysAsync(subscription.EmployeeId, subscription.StartDate, subscription.EndDate, cancellationToken);
        var totalPrice = await CalculateDynamicTotalPriceAsync(subscription.EmployeeId, cancellationToken);
        return MapToResponse(subscription, totalDays, totalPrice);
    }

    public async Task<SubscriptionResponse> GetByEmployeeIdAsync(Guid employeeId, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscription = await _context.LunchSubscriptions
            .Include(s => s.Employee)
                .ThenInclude(e => e!.Project)
            .FirstOrDefaultAsync(s => s.EmployeeId == employeeId && s.CompanyId == companyId, cancellationToken);

        if (subscription == null)
        {
            throw new KeyNotFoundException("Подписка не найдена");
        }

        var totalDays = await CalculateDynamicTotalDaysAsync(subscription.EmployeeId, subscription.StartDate, subscription.EndDate, cancellationToken);
        var totalPrice = await CalculateDynamicTotalPriceAsync(subscription.EmployeeId, cancellationToken);
        return MapToResponse(subscription, totalDays, totalPrice);
    }

    public async Task<SubscriptionResponse> CreateAsync(CreateSubscriptionRequest request, Guid companyId, CancellationToken cancellationToken = default)
    {
        // Check if employee exists and belongs to company
        var employee = await _context.Employees
            .Include(e => e.Project)
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId && e.CompanyId == companyId, cancellationToken);

        if (employee == null)
        {
            throw new KeyNotFoundException("Сотрудник не найден");
        }

        // ═══════════════════════════════════════════════════════════════
        // VALIDATION: Employee must not be deleted
        // ═══════════════════════════════════════════════════════════════
        if (employee.DeletedAt.HasValue)
        {
            throw new InvalidOperationException("Невозможно создать подписку для удалённого сотрудника");
        }

        // ═══════════════════════════════════════════════════════════════
        // VALIDATION: Employee must be active
        // ═══════════════════════════════════════════════════════════════
        if (!employee.IsActive)
        {
            throw new InvalidOperationException("Невозможно создать подписку для неактивного сотрудника. Сначала активируйте сотрудника.");
        }

        // ═══════════════════════════════════════════════════════════════
        // VALIDATION: ServiceType must be LUNCH (or null)
        // ═══════════════════════════════════════════════════════════════
        if (employee.ServiceType == ServiceType.Compensation)
        {
            throw new InvalidOperationException("Невозможно создать подписку на обеды для сотрудника с типом услуги 'Компенсация'. Сначала измените тип услуги на 'Обеды'.");
        }

        // ═══════════════════════════════════════════════════════════════
        // VALIDATION: Employee must have a project
        // ═══════════════════════════════════════════════════════════════
        if (employee.Project == null)
        {
            throw new InvalidOperationException("Невозможно создать подписку: сотрудник не привязан к проекту");
        }

        // ═══════════════════════════════════════════════════════════════
        // VALIDATION: Project must have a delivery address
        // ═══════════════════════════════════════════════════════════════
        if (string.IsNullOrWhiteSpace(employee.Project.AddressFullAddress))
        {
            throw new InvalidOperationException(
                $"Невозможно создать подписку: у проекта '{employee.Project.Name}' не указан адрес доставки. " +
                $"Пожалуйста, укажите полный адрес в настройках проекта.");
        }

        // ═══════════════════════════════════════════════════════════════
        // VALIDATION: Cannot create subscription for past dates
        // IMPORTANT: Use project's timezone for "today" comparison!
        // ═══════════════════════════════════════════════════════════════
        var projectTimezone = employee.Project?.Timezone;
        var today = TimezoneHelper.GetLocalTodayDate(projectTimezone);
        if (request.StartDate.HasValue && request.StartDate.Value < today)
        {
            throw new BusinessRuleException(
                ErrorCodes.SUB_PAST_DATE_NOT_ALLOWED,
                "Нельзя создать подписку на прошедшие даты");
        }

        // ═══════════════════════════════════════════════════════════════
        // CUTOFF VALIDATION: Cannot create subscription starting today after cutoff
        // Business rule: If StartDate is today and cutoff has passed,
        // the subscription should start tomorrow or user should be warned
        // ═══════════════════════════════════════════════════════════════
        var effectiveStartDate = request.StartDate ?? today;
        if (effectiveStartDate == today && employee.Project != null)
        {
            if (TimezoneHelper.IsCutoffPassed(employee.Project.CutoffTime, employee.Project.Timezone))
            {
                throw new BusinessRuleException(
                    ErrorCodes.ORDER_CUTOFF_PASSED,
                    $"Время для заказов на сегодня истекло в {employee.Project.CutoffTime}. " +
                    $"Подписка будет начата с завтрашнего дня. Пожалуйста, выберите дату начала с завтрашнего дня.");
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // VALIDATION: Minimum subscription days (from business config)
        // ═══════════════════════════════════════════════════════════════
        var validationStartDate = request.StartDate ?? today;
        var validationEndDate = request.EndDate ?? validationStartDate.AddMonths(1);
        var validationTotalDays = WorkingDaysHelper.CountWorkingDays(employee.WorkingDays, validationStartDate, validationEndDate);
        
        var minDays = await _configService.GetIntAsync(ConfigKeys.SubscriptionMinDays, 5, cancellationToken);
        if (validationTotalDays < minDays)
        {
            throw new BusinessRuleException(
                ErrorCodes.SUB_MIN_DAYS_REQUIRED,
                $"Минимальный период подписки — {minDays} рабочих дней. Выбрано: {validationTotalDays}");
        }

        // ═══════════════════════════════════════════════════════════════
        // VALIDATION: Project must have sufficient budget
        // Calculate required budget based on dates and combo type
        // ═══════════════════════════════════════════════════════════════
        var validationPrice = request.ComboType switch
        {
            "Комбо 25" => 25m,
            "Комбо 35" => 35m,
            _ => 25m
        };
        var requiredBudget = validationPrice * validationTotalDays;
        var availableBudget = employee.Project.Budget + employee.Project.OverdraftLimit;
        
        if (requiredBudget > availableBudget)
        {
            throw new InvalidOperationException(
                $"Недостаточно бюджета для создания подписки. " +
                $"Требуется: {requiredBudget:N0} TJS, доступно: {availableBudget:N0} TJS");
        }

        // ═══════════════════════════════════════════════════════════════
        // TRANSACTION: All subscription creation operations must be atomic
        // - Create/reactivate subscription
        // - Update employee service type
        // - Create orders
        // ═══════════════════════════════════════════════════════════════
        var strategy = _context.Database.CreateExecutionStrategy();
        
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
            
            try
            {
                // Check if subscription already exists (including soft-deleted)
                var existingSubscription = await _context.LunchSubscriptions
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(s => s.EmployeeId == request.EmployeeId, cancellationToken);

                if (existingSubscription != null)
                {
                    if (existingSubscription.IsActive)
                    {
                        throw new InvalidOperationException("Сотрудник уже имеет активную подписку на обеды");
                    }
                    
                    // Calculate total WORKING days and price for reactivation
                    // NOTE: 'today' is already calculated using project timezone above
                    var reactivateStartDate = request.StartDate ?? today;
                    var reactivateEndDate = request.EndDate ?? reactivateStartDate.AddMonths(1);
                    var reactivateTotalDays = WorkingDaysHelper.CountWorkingDays(employee.WorkingDays, reactivateStartDate, reactivateEndDate);
                    var reactivatePrice = request.ComboType switch
                    {
                        "Комбо 25" => 25m,
                        "Комбо 35" => 35m,
                        _ => 25m
                    };
                    
                    // Reactivate existing subscription instead of creating new
                    existingSubscription.IsActive = true;
                    existingSubscription.ComboType = request.ComboType;
                    existingSubscription.ProjectId = employee.ProjectId;
                    existingSubscription.Status = SubscriptionStatus.Active;
                    existingSubscription.StartDate = reactivateStartDate;
                    existingSubscription.EndDate = reactivateEndDate;
                    existingSubscription.TotalDays = reactivateTotalDays;
                    existingSubscription.TotalPrice = reactivatePrice * reactivateTotalDays;
                    existingSubscription.UpdatedAt = DateTime.UtcNow;

                    // Create orders for reactivated subscription
                    await CreateOrdersForSubscriptionAsync(
                        existingSubscription, employee, employee.Project!, cancellationToken);

                    await _context.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    
                    existingSubscription.Employee = employee;
                    var reactivatedTotalDays = await CalculateDynamicTotalDaysAsync(existingSubscription.EmployeeId, existingSubscription.StartDate, existingSubscription.EndDate, cancellationToken);
                    var reactivatedTotalPrice = await CalculateDynamicTotalPriceAsync(existingSubscription.EmployeeId, cancellationToken);
                    return MapToResponse(existingSubscription, reactivatedTotalDays, reactivatedTotalPrice);
                }

                // Calculate total WORKING days and price
                // NOTE: 'today' is already calculated using project timezone above
                var startDate = request.StartDate ?? today;
                var endDate = request.EndDate ?? startDate.AddMonths(1);
                var totalDays = WorkingDaysHelper.CountWorkingDays(employee.WorkingDays, startDate, endDate);
                var price = request.ComboType switch
                {
                    "Комбо 25" => 25m,
                    "Комбо 35" => 35m,
                    _ => 25m
                };
                var totalPrice = price * totalDays;

                // NOTE: Address is derived from employee's Project (one project = one address)
                var subscription = new LunchSubscription
                {
                    Id = Guid.NewGuid(),
                    EmployeeId = request.EmployeeId,
                    CompanyId = companyId,
                    ProjectId = employee.ProjectId,
                    ComboType = request.ComboType,
                    IsActive = true,
                    Status = SubscriptionStatus.Active,
                    StartDate = startDate,
                    EndDate = endDate,
                    TotalDays = totalDays,
                    TotalPrice = totalPrice,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                // Update employee's ServiceType to LUNCH if not set
                if (employee.ServiceType == null)
                {
                    employee.ServiceType = ServiceType.Lunch;
                    employee.UpdatedAt = DateTime.UtcNow;
                }

                await _context.LunchSubscriptions.AddAsync(subscription, cancellationToken);

                // ═══════════════════════════════════════════════════════════════
                // CREATE ORDERS for subscription period
                // ═══════════════════════════════════════════════════════════════
                var ordersCreated = await CreateOrdersForSubscriptionAsync(
                    subscription, employee, employee.Project!, cancellationToken);

                await _context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                subscription.Employee = employee;

                var createdTotalDays = await CalculateDynamicTotalDaysAsync(subscription.EmployeeId, subscription.StartDate, subscription.EndDate, cancellationToken);
                var createdTotalPrice = await CalculateDynamicTotalPriceAsync(subscription.EmployeeId, cancellationToken);
                return MapToResponse(subscription, createdTotalDays, createdTotalPrice);
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        });
    }

    public async Task<SubscriptionResponse> UpdateAsync(Guid id, UpdateSubscriptionDetailsRequest request, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscription = await _context.LunchSubscriptions
            .Include(s => s.Employee)
                .ThenInclude(e => e!.Project)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == companyId, cancellationToken);

        if (subscription == null)
        {
            throw new KeyNotFoundException("Подписка не найдена");
        }

        if (!string.IsNullOrWhiteSpace(request.ComboType))
        {
            var oldComboType = subscription.ComboType;
            subscription.ComboType = request.ComboType;
            
            // CRITICAL FIX: Also update active orders to use new combo type
            // Otherwise existing orders would have wrong combo after update
            if (oldComboType != request.ComboType)
            {
                var newPrice = request.ComboType switch
                {
                    "Комбо 25" => 25m,
                    "Комбо 35" => 35m,
                    _ => 25m
                };
                
                // Get future orders to update (Active or Frozen, today and forward)
                // IMPORTANT: Use project's timezone for "today" comparison!
                var updateTimezone = subscription.Employee?.Project?.Timezone;
                var updateLocalToday = TimezoneHelper.GetLocalToday(updateTimezone);
                var futureOrders = await _context.Orders
                    .Where(o => o.EmployeeId == subscription.EmployeeId && 
                               (o.Status == OrderStatus.Active || o.Status == OrderStatus.Frozen) &&
                               o.OrderDate >= updateLocalToday)
                    .ToListAsync(cancellationToken);
                
                // NOTE: TotalPrice is calculated dynamically - no manual update needed
                
                // Update future orders with new combo and price
                foreach (var order in futureOrders)
                {
                    order.ComboType = request.ComboType;
                    order.Price = newPrice;
                    order.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        // NOTE: Address cannot be changed here - it comes from employee's project
        // To change address, move employee to a different project

        if (request.IsActive.HasValue)
        {
            subscription.IsActive = request.IsActive.Value;
        }

        subscription.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        var updatedTotalDays = await CalculateDynamicTotalDaysAsync(subscription.EmployeeId, subscription.StartDate, subscription.EndDate, cancellationToken);
        var updatedTotalPrice = await CalculateDynamicTotalPriceAsync(subscription.EmployeeId, cancellationToken);
        return MapToResponse(subscription, updatedTotalDays, updatedTotalPrice);
    }

    public async Task DeleteAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscription = await _context.LunchSubscriptions
            .Include(s => s.Employee)
                .ThenInclude(e => e!.Project)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == companyId, cancellationToken);

        if (subscription == null)
        {
            throw new KeyNotFoundException("Подписка не найдена");
        }

        // ═══════════════════════════════════════════════════════════════
        // TRANSACTION: Delete subscription with all related updates atomically
        // - Deactivate subscription
        // - Cancel future orders
        // - Refund budget
        // - Reset employee service type
        // ═══════════════════════════════════════════════════════════════
        var strategy = _context.Database.CreateExecutionStrategy();
        
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
            
            try
            {
                // SOFT DELETE: Deactivate instead of hard delete
                subscription.Deactivate(); // Uses domain method which sets IsActive=false and Status=Completed

                // CANCEL FUTURE ORDERS: Cancel orders from today onwards (Active or Frozen)
                // Orders already Delivered/Completed are not affected (history preserved)
                // IMPORTANT: Use project's timezone for "today" comparison!
                var deleteTimezone = subscription.Employee?.Project?.Timezone;
                var deleteLocalToday = TimezoneHelper.GetLocalToday(deleteTimezone);
                var futureOrders = await _context.Orders
                    .Where(o => o.EmployeeId == subscription.EmployeeId
                             && (o.Status == OrderStatus.Active || o.Status == OrderStatus.Frozen)
                             && o.OrderDate >= deleteLocalToday)
                    .ToListAsync(cancellationToken);

                // Calculate refund amount for cancelled orders
                var refundAmount = futureOrders.Sum(o => o.Price);

                foreach (var order in futureOrders)
                {
                    order.Status = OrderStatus.Cancelled;
                    order.UpdatedAt = DateTime.UtcNow;
                }

                // Refund budget to project
                if (refundAmount > 0 && subscription.Employee?.Project != null)
                {
                    subscription.Employee.Project.Budget += refundAmount;
                    subscription.Employee.Project.UpdatedAt = DateTime.UtcNow;
                }

                // Reset Employee.ServiceType only if it was LUNCH
                // COMPENSATION employees should keep their service type
                // This allows LUNCH employees to switch to COMPENSATION if needed
                if (subscription.Employee != null && subscription.Employee.ServiceType == ServiceType.Lunch)
                {
                    subscription.Employee.ServiceType = null;
                    subscription.Employee.UpdatedAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        });
    }

    public async Task<object> BulkCreateAsync(BulkCreateSubscriptionRequest request, Guid companyId, CancellationToken cancellationToken = default)
    {
        // ═══════════════════════════════════════════════════════════════
        // Use execution strategy for transaction (required for NpgsqlRetryingExecutionStrategy)
        // ═══════════════════════════════════════════════════════════════
        var strategy = _context.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
        {
            using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

            try
            {
            // ═══════════════════════════════════════════════════════════════
            // Load employees including deleted to report properly
            // ═══════════════════════════════════════════════════════════════
            var employees = await _context.Employees
                .IgnoreQueryFilters()
                .Include(e => e.Project)
                .Where(e => request.EmployeeIds.Contains(e.Id) && e.CompanyId == companyId)
                .ToListAsync(cancellationToken);

            // Load ALL subscriptions (active and inactive) to handle reactivation
            var existingSubscriptions = await _context.LunchSubscriptions
                .Where(s => request.EmployeeIds.Contains(s.EmployeeId))
                .ToListAsync(cancellationToken);

            var createdSubscriptions = new List<object>();
            var createdSubscriptionsList = new List<LunchSubscription>();
            var errors = new List<object>();

            foreach (var employee in employees)
        {
            // ═══════════════════════════════════════════════════════════════
            // VALIDATION: Check deleted
            // ═══════════════════════════════════════════════════════════════
            if (employee.DeletedAt.HasValue)
            {
                errors.Add(new { employeeId = employee.Id.ToString(), message = $"{employee.FullName} (удалён)" });
                continue;
            }

            // ═══════════════════════════════════════════════════════════════
            // VALIDATION: Check active
            // ═══════════════════════════════════════════════════════════════
            if (!employee.IsActive)
            {
                errors.Add(new { employeeId = employee.Id.ToString(), message = $"{employee.FullName} (неактивен)" });
                continue;
            }

            // ═══════════════════════════════════════════════════════════════
            // VALIDATION: Check ServiceType
            // ═══════════════════════════════════════════════════════════════
            if (employee.ServiceType == ServiceType.Compensation)
            {
                errors.Add(new { employeeId = employee.Id.ToString(), message = $"{employee.FullName} (тип услуги: Компенсация)" });
                continue;
            }

            // ═══════════════════════════════════════════════════════════════
            // VALIDATION: Check existing subscription
            // ═══════════════════════════════════════════════════════════════
            var existingSub = existingSubscriptions.FirstOrDefault(s => s.EmployeeId == employee.Id);
            if (existingSub != null && existingSub.IsActive)
            {
                errors.Add(new { employeeId = employee.Id.ToString(), message = $"{employee.FullName} (уже имеет активную подписку)" });
                continue;
            }

            // ═══════════════════════════════════════════════════════════════
            // VALIDATION: Check project
            // ═══════════════════════════════════════════════════════════════
            if (employee.Project == null)
            {
                errors.Add(new { employeeId = employee.Id.ToString(), message = $"{employee.FullName} (нет проекта)" });
                continue;
            }

            // ═══════════════════════════════════════════════════════════════
            // VALIDATION: Check project address
            // ═══════════════════════════════════════════════════════════════
            if (string.IsNullOrWhiteSpace(employee.Project.AddressFullAddress))
            {
                errors.Add(new { employeeId = employee.Id.ToString(), message = $"{employee.FullName} (у проекта '{employee.Project.Name}' не указан адрес доставки)" });
                continue;
            }

            // ═══════════════════════════════════════════════════════════════
            // VALIDATION: Check budget (early validation before date parsing)
            // IMPORTANT: Use project's timezone for "today" comparison!
            // ═══════════════════════════════════════════════════════════════
            var bulkTimezone = employee.Project?.Timezone;
            var bulkLocalToday = TimezoneHelper.GetLocalTodayDate(bulkTimezone);
            var earlyStartDate = !string.IsNullOrEmpty(request.StartDate)
                ? DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd", CultureInfo.InvariantCulture)
                : bulkLocalToday;
            var earlyEndDate = !string.IsNullOrEmpty(request.EndDate)
                ? DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd", CultureInfo.InvariantCulture)
                : earlyStartDate.AddMonths(1);
            
            int estimatedDays;
            if (request.ScheduleType == "CUSTOM" && request.CustomDays != null && request.CustomDays.Count > 0)
            {
                estimatedDays = request.CustomDays.Select(d => DateOnly.Parse(d)).Count(d => d >= bulkLocalToday);
            }
            else
            {
                // Count days based on schedule type: EVERY_DAY or EVERY_OTHER_DAY
                estimatedDays = WorkingDaysHelper.CountOrderDays(request.ScheduleType, employee.WorkingDays, earlyStartDate, earlyEndDate);
            }
            
            var comboPrice = request.ComboType switch
            {
                "Комбо 25" => 25m,
                "Комбо 35" => 35m,
                _ => 25m
            };
            var requiredBudget = comboPrice * estimatedDays;
            var availableBudget = employee.Project.Budget + employee.Project.OverdraftLimit;
            
            if (requiredBudget > availableBudget)
            {
                errors.Add(new { employeeId = employee.Id.ToString(), message = $"{employee.FullName} (недостаточно бюджета: требуется {requiredBudget:N0}, доступно {availableBudget:N0} TJS)" });
                continue;
            }

            // Parse dates from request (ISO format: YYYY-MM-DD)
            // NOTE: bulkLocalToday already calculated with project timezone above
            var startDate = !string.IsNullOrEmpty(request.StartDate)
                ? DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd", CultureInfo.InvariantCulture)
                : bulkLocalToday;
            var endDate = !string.IsNullOrEmpty(request.EndDate)
                ? DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd", CultureInfo.InvariantCulture)
                : startDate.AddMonths(1);

            // ═══════════════════════════════════════════════════════════════
            // VALIDATION: Cannot create subscription for past dates
            // ═══════════════════════════════════════════════════════════════
            if (startDate < bulkLocalToday)
            {
                errors.Add(new { employeeId = employee.Id.ToString(), message = $"{employee.FullName} (нельзя создать подписку на прошедшие даты)" });
                continue;
            }

            // ═══════════════════════════════════════════════════════════════
            // CUTOFF VALIDATION: Cannot create subscription starting today after cutoff
            // ═══════════════════════════════════════════════════════════════
            if (startDate == bulkLocalToday && employee.Project != null)
            {
                if (TimezoneHelper.IsCutoffPassed(employee.Project.CutoffTime, employee.Project.Timezone))
                {
                    errors.Add(new { employeeId = employee.Id.ToString(), message = $"{employee.FullName} (время заказа на сегодня истекло в {employee.Project.CutoffTime})" });
                    continue;
                }
            }

            // Calculate total days based on schedule type
            // CUSTOM: explicit dates, EVERY_DAY: all working days, EVERY_OTHER_DAY: Mon/Wed/Fri
            // NOTE: bulkLocalToday already calculated with project timezone above
            int totalDays;
            if (request.ScheduleType == "CUSTOM" && request.CustomDays != null && request.CustomDays.Count > 0)
            {
                // For CUSTOM schedule, total days = number of custom days selected
                // Filter out past dates (same logic as CreateOrdersForCustomDaysAsync)
                totalDays = request.CustomDays
                    .Select(d => DateOnly.Parse(d))
                    .Count(d => d >= bulkLocalToday);
            }
            else
            {
                // For EVERY_DAY or EVERY_OTHER_DAY, count appropriate days
                totalDays = WorkingDaysHelper.CountOrderDays(request.ScheduleType, employee.WorkingDays, startDate, endDate);
            }

            // ═══════════════════════════════════════════════════════════════
            // VALIDATION: Minimum subscription days (from business config)
            // Same validation as in CreateAsync
            // ═══════════════════════════════════════════════════════════════
            var minDays = await _configService.GetIntAsync(ConfigKeys.SubscriptionMinDays, 5, cancellationToken);
            if (totalDays < minDays)
            {
                errors.Add(new { employeeId = employee.Id.ToString(), message = $"{employee.FullName} (минимальный период подписки — {minDays} рабочих дней, выбрано: {totalDays})" });
                continue;
            }
            
            var price = request.ComboType switch
            {
                "Комбо 25" => 25m,
                "Комбо 35" => 35m,
                _ => 25m
            };
            var totalPrice = price * totalDays;

            LunchSubscription subscription;

            // ═══════════════════════════════════════════════════════════════
            // REACTIVATE existing inactive subscription OR create new one
            // ═══════════════════════════════════════════════════════════════
            if (existingSub != null)
            {
                // Reactivate existing subscription with new parameters
                subscription = existingSub;
                subscription.ComboType = request.ComboType;
                subscription.IsActive = true;
                subscription.Status = SubscriptionStatus.Active;
                subscription.StartDate = startDate;
                subscription.EndDate = endDate;
                subscription.TotalDays = totalDays;
                subscription.TotalPrice = totalPrice;
                subscription.ScheduleType = ScheduleTypeHelper.Normalize(request.ScheduleType);
                subscription.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                // Create new subscription
                subscription = new LunchSubscription
                {
                    Id = Guid.NewGuid(),
                    EmployeeId = employee.Id,
                    CompanyId = companyId,
                    ProjectId = employee.ProjectId,
                    ComboType = request.ComboType,
                    IsActive = true,
                    Status = SubscriptionStatus.Active,
                    StartDate = startDate,
                    EndDate = endDate,
                    TotalDays = totalDays,
                    TotalPrice = totalPrice,
                    ScheduleType = ScheduleTypeHelper.Normalize(request.ScheduleType),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                await _context.LunchSubscriptions.AddAsync(subscription, cancellationToken);
            }

            // Update employee's ServiceType to LUNCH if not set
            if (employee.ServiceType == null)
            {
                employee.ServiceType = ServiceType.Lunch;
                employee.UpdatedAt = DateTime.UtcNow;
            }

            // Create orders for the subscription period
            int ordersCreated;
            if (request.ScheduleType == "CUSTOM" && request.CustomDays != null && request.CustomDays.Count > 0)
            {
                // Create orders only for custom days
                ordersCreated = await CreateOrdersForCustomDaysAsync(subscription, employee, employee.Project!, request.CustomDays, cancellationToken);
            }
            else
            {
                // Create orders for all working days in period
                ordersCreated = await CreateOrdersForSubscriptionAsync(subscription, employee, employee.Project!, cancellationToken);
            }

            // CRITICAL: If no orders created, subscription is useless - rollback
            if (ordersCreated == 0)
            {
                _context.LunchSubscriptions.Remove(subscription);
                errors.Add(new { employeeId = employee.Id.ToString(), message = $"{employee.FullName} (не удалось создать заказы - проверьте рабочие дни)" });
                continue;
            }

            // Store subscription for later mapping (after SaveChanges)
            createdSubscriptionsList.Add(subscription);
        }

            await _context.SaveChangesAsync(cancellationToken);

            // Now calculate dynamic TotalDays and TotalPrice for each created subscription
            foreach (var sub in createdSubscriptionsList)
            {
                var totalDays = await CalculateDynamicTotalDaysAsync(sub.EmployeeId, sub.StartDate, sub.EndDate, cancellationToken);
                var totalPrice = await CalculateDynamicTotalPriceAsync(sub.EmployeeId, cancellationToken);
                createdSubscriptions.Add(MapToResponse(sub, totalDays, totalPrice));
            }

            await transaction.CommitAsync(cancellationToken);

            // Final validation: if no subscriptions created, return error
            if (createdSubscriptions.Count == 0 && errors.Count > 0)
            {
                return new
                {
                    success = false,
                    subscriptions = createdSubscriptions,
                    errors = errors
                };
            }

            return new
            {
                success = true,
                subscriptions = createdSubscriptions,
                errors = errors
            };
            }
            catch (Exception)
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        });
    }

    public async Task<object> BulkUpdateAsync(BulkUpdateSubscriptionRequest request, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscriptions = await _context.LunchSubscriptions
            .Where(s => request.SubscriptionIds.Contains(s.Id) && s.CompanyId == companyId)
            .ToListAsync(cancellationToken);

        var updated = 0;
        var ordersUpdated = 0;

        foreach (var subscription in subscriptions)
        {
            if (!string.IsNullOrWhiteSpace(request.ComboType))
            {
                var oldComboType = subscription.ComboType;
                subscription.ComboType = request.ComboType;
                
                // FIX: Также обновляем активные заказы (как в UpdateAsync)
                if (oldComboType != request.ComboType)
                {
                    var newPrice = request.ComboType switch
                    {
                        "Комбо 25" => 25m,
                        "Комбо 35" => 35m,
                        _ => 25m
                    };
                    
                    // IMPORTANT: Use project's timezone for "today" comparison!
                    var bulkUpdateTimezone = subscription.Employee?.Project?.Timezone;
                    var bulkUpdateLocalToday = TimezoneHelper.GetLocalToday(bulkUpdateTimezone);
                    var activeOrders = await _context.Orders
                        .Where(o => o.EmployeeId == subscription.EmployeeId && 
                                   (o.Status == OrderStatus.Active || o.Status == OrderStatus.Frozen) &&
                                   o.OrderDate >= bulkUpdateLocalToday)
                        .ToListAsync(cancellationToken);

                    foreach (var order in activeOrders)
                    {
                        order.ComboType = request.ComboType;
                        order.Price = newPrice;
                        order.UpdatedAt = DateTime.UtcNow;
                        ordersUpdated++;
                    }

                    // NOTE: TotalPrice is calculated dynamically - no manual update needed
                }
            }

            // NOTE: Address cannot be changed - it comes from employee's project

            subscription.UpdatedAt = DateTime.UtcNow;
            updated++;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new
        {
            message = $"Обновлено {updated} подписок и {ordersUpdated} заказов",
            updated,
            ordersUpdated
        };
    }

    public async Task<SubscriptionResponse> PauseAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscription = await _context.LunchSubscriptions
            .Include(s => s.Employee)
                .ThenInclude(e => e!.Project)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == companyId, cancellationToken);

        if (subscription == null)
        {
            throw new KeyNotFoundException("Подписка не найдена");
        }

        if (!subscription.IsActive)
        {
            throw new InvalidOperationException("Подписка уже приостановлена");
        }

        // ═══════════════════════════════════════════════════════════════
        // TRANSACTION: Pause subscription and all future orders atomically
        // ═══════════════════════════════════════════════════════════════
        var strategy = _context.Database.CreateExecutionStrategy();
        
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
            
            try
            {
                subscription.IsActive = false;
                subscription.Status = SubscriptionStatus.Paused;
                subscription.PausedAt = DateTime.UtcNow;
                subscription.UpdatedAt = DateTime.UtcNow;

                // Use project's timezone for "today" comparison
                var timezone = subscription.Employee?.Project?.Timezone;
                var localToday = TimezoneHelper.GetLocalToday(timezone);
                
                // Pause all future active orders (today and forward in local timezone)
                var futureOrders = await _context.Orders
                    .Where(o => o.EmployeeId == subscription.EmployeeId && 
                               o.Status == OrderStatus.Active &&
                               o.OrderDate >= localToday)
                    .ToListAsync(cancellationToken);

                foreach (var order in futureOrders)
                {
                    order.Status = OrderStatus.Paused;
                    order.UpdatedAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                var pausedTotalDays = await CalculateDynamicTotalDaysAsync(subscription.EmployeeId, subscription.StartDate, subscription.EndDate, cancellationToken);
                var pausedTotalPrice = await CalculateDynamicTotalPriceAsync(subscription.EmployeeId, cancellationToken);
                return MapToResponse(subscription, pausedTotalDays, pausedTotalPrice);
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        });
    }

    public async Task<SubscriptionResponse> ResumeAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscription = await _context.LunchSubscriptions
            .Include(s => s.Employee)
                .ThenInclude(e => e!.Project)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == companyId, cancellationToken);

        if (subscription == null)
        {
            throw new KeyNotFoundException("Подписка не найдена");
        }

        if (subscription.IsActive)
        {
            throw new InvalidOperationException("Подписка уже активна");
        }

        // ═══════════════════════════════════════════════════════════════
        // TRANSACTION: Resume subscription with all related updates atomically
        // - Update subscription status and extend end date
        // - Resume paused orders
        // - Create orders for extended period
        // ═══════════════════════════════════════════════════════════════
        var strategy = _context.Database.CreateExecutionStrategy();
        
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
            
            try
            {
                var employee = subscription.Employee;
                var project = employee?.Project;
                
                // Use project's timezone for date calculations
                var timezone = project?.Timezone;
                var localToday = TimezoneHelper.GetLocalToday(timezone);
                
                // Remember old EndDate before extending
                var oldEndDate = subscription.EndDate;

                // Calculate paused days and extend subscription
                int pausedDays = 0;
                if (subscription.PausedAt.HasValue && subscription.EndDate.HasValue)
                {
                    pausedDays = (DateTime.UtcNow - subscription.PausedAt.Value).Days;
                    subscription.PausedDaysCount += pausedDays;
                    subscription.EndDate = subscription.EndDate.Value.AddDays(pausedDays);
                }

                subscription.IsActive = true;
                subscription.Status = SubscriptionStatus.Active;
                subscription.PausedAt = null;
                subscription.UpdatedAt = DateTime.UtcNow;

                // Resume all paused orders (using local timezone)
                var pausedOrders = await _context.Orders
                    .Where(o => o.EmployeeId == subscription.EmployeeId && 
                               o.Status == OrderStatus.Paused &&
                               o.OrderDate >= localToday)
                    .ToListAsync(cancellationToken);

                foreach (var order in pausedOrders)
                {
                    order.Status = OrderStatus.Active;
                    order.UpdatedAt = DateTime.UtcNow;
                }

                // Create orders for the extended period
                // When subscription is resumed, EndDate is extended by pausedDays.
                int newOrdersCreated = 0;
                if (pausedDays > 0 && oldEndDate.HasValue && employee != null && project != null)
                {
                    // Create orders from day after old EndDate to new EndDate
                    var extensionStartDate = oldEndDate.Value.AddDays(1);
                    var extensionEndDate = subscription.EndDate!.Value;
                    
                    newOrdersCreated = await CreateOrdersForExtendedPeriodAsync(
                        subscription, employee, project, 
                        extensionStartDate, extensionEndDate, 
                        cancellationToken);
                }

                await _context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                var resumedTotalDays = await CalculateDynamicTotalDaysAsync(subscription.EmployeeId, subscription.StartDate, subscription.EndDate, cancellationToken);
                var resumedTotalPrice = await CalculateDynamicTotalPriceAsync(subscription.EmployeeId, cancellationToken);
                return MapToResponse(subscription, resumedTotalDays, resumedTotalPrice);
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        });
    }

    public async Task<object> BulkPauseAsync(IEnumerable<Guid> subscriptionIds, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscriptions = await _context.LunchSubscriptions
            .Include(s => s.Employee)
                .ThenInclude(e => e!.Project)
            .Where(s => subscriptionIds.Contains(s.Id) && s.CompanyId == companyId && s.IsActive)
            .ToListAsync(cancellationToken);

        var paused = 0;
        var ordersPaused = 0;

        foreach (var subscription in subscriptions)
        {
            subscription.IsActive = false;
            subscription.Status = SubscriptionStatus.Paused;
            subscription.PausedAt = DateTime.UtcNow;
            subscription.UpdatedAt = DateTime.UtcNow;
            paused++;

            // ═══════════════════════════════════════════════════════════════
            // FIX: Use project's timezone for "today" comparison
            // ═══════════════════════════════════════════════════════════════
            var timezone = subscription.Employee?.Project?.Timezone;
            var localToday = TimezoneHelper.GetLocalToday(timezone);
            
            var futureOrders = await _context.Orders
                .Where(o => o.EmployeeId == subscription.EmployeeId && 
                           o.Status == OrderStatus.Active &&
                           o.OrderDate >= localToday)
                .ToListAsync(cancellationToken);

            foreach (var order in futureOrders)
            {
                order.Status = OrderStatus.Paused;
                order.UpdatedAt = DateTime.UtcNow;
                ordersPaused++;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new
        {
            message = $"Приостановлено {paused} подписок и {ordersPaused} заказов",
            paused,
            ordersPaused
        };
    }

    public async Task<object> BulkResumeAsync(IEnumerable<Guid> subscriptionIds, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscriptions = await _context.LunchSubscriptions
            .Include(s => s.Employee)
                .ThenInclude(e => e!.Project)
            .Where(s => subscriptionIds.Contains(s.Id) && s.CompanyId == companyId && !s.IsActive)
            .ToListAsync(cancellationToken);

        var resumed = 0;
        var ordersResumed = 0;
        var newOrdersCreated = 0;

        foreach (var subscription in subscriptions)
        {
            var employee = subscription.Employee;
            var project = employee?.Project;
            
            // ═══════════════════════════════════════════════════════════════
            // FIX: Use project's timezone for "today" comparison
            // ═══════════════════════════════════════════════════════════════
            var timezone = project?.Timezone;
            var localToday = TimezoneHelper.GetLocalToday(timezone);
            
            // Remember old EndDate before extending
            var oldEndDate = subscription.EndDate;
            
            // Calculate paused days and extend subscription
            int pausedDays = 0;
            if (subscription.PausedAt.HasValue && subscription.EndDate.HasValue)
            {
                pausedDays = (DateTime.UtcNow - subscription.PausedAt.Value).Days;
                subscription.PausedDaysCount += pausedDays;
                subscription.EndDate = subscription.EndDate.Value.AddDays(pausedDays);
            }

            subscription.IsActive = true;
            subscription.Status = SubscriptionStatus.Active;
            subscription.PausedAt = null;
            subscription.UpdatedAt = DateTime.UtcNow;
            resumed++;

            // ═══════════════════════════════════════════════════════════════
            // FIX: Resume all paused orders (using local timezone)
            // ═══════════════════════════════════════════════════════════════
            var pausedOrders = await _context.Orders
                .Where(o => o.EmployeeId == subscription.EmployeeId && 
                           o.Status == OrderStatus.Paused &&
                           o.OrderDate >= localToday)
                .ToListAsync(cancellationToken);

            foreach (var order in pausedOrders)
            {
                order.Status = OrderStatus.Active;
                order.UpdatedAt = DateTime.UtcNow;
                ordersResumed++;
            }
            
            // ═══════════════════════════════════════════════════════════════
            // CRITICAL FIX: Create orders for the extended period!
            // ═══════════════════════════════════════════════════════════════
            if (pausedDays > 0 && oldEndDate.HasValue && employee != null && project != null)
            {
                var extensionStartDate = oldEndDate.Value.AddDays(1);
                var extensionEndDate = subscription.EndDate!.Value;
                
                var created = await CreateOrdersForExtendedPeriodAsync(
                    subscription, employee, project, 
                    extensionStartDate, extensionEndDate, 
                    cancellationToken);
                newOrdersCreated += created;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new
        {
            message = $"Возобновлено {resumed} подписок, {ordersResumed} заказов и создано {newOrdersCreated} новых заказов",
            resumed,
            ordersResumed,
            newOrdersCreated
        };
    }

    public async Task<PricePreviewResponse> GetPricePreviewAsync(Guid id, string newComboType, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscription = await _context.LunchSubscriptions
            .Include(s => s.Employee)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == companyId, cancellationToken);

        if (subscription == null)
        {
            throw new KeyNotFoundException("Подписка не найдена");
        }

        // Combo prices - only Комбо 25 and Комбо 35 are supported
        var comboPrices = new Dictionary<string, decimal>
        {
            { "Комбо 25", 25.00m },
            { "Комбо 35", 35.00m }
        };

        var currentPrice = comboPrices.GetValueOrDefault(subscription.ComboType, 35.00m);
        var newPrice = comboPrices.GetValueOrDefault(newComboType, 35.00m);
        var priceDifference = newPrice - currentPrice;

        // Count affected active orders
        // IMPORTANT: Use project's timezone for "today" comparison!
        var previewTimezone = subscription.Employee?.Project?.Timezone;
        var previewLocalToday = TimezoneHelper.GetLocalToday(previewTimezone);
        var affectedOrdersCount = await _context.Orders
            .CountAsync(o => o.EmployeeId == subscription.EmployeeId
                          && o.Status == Domain.Enums.OrderStatus.Active
                          && o.OrderDate >= previewLocalToday, cancellationToken);

        var totalImpact = priceDifference * affectedOrdersCount;

        var priceChangeDescription = priceDifference switch
        {
            > 0 => $"Увеличение на {priceDifference:N0} TJS за заказ",
            < 0 => $"Экономия {Math.Abs(priceDifference):N0} TJS за заказ",
            _ => "Цена не изменится"
        };

        return new PricePreviewResponse
        {
            CurrentComboType = subscription.ComboType,
            CurrentPrice = currentPrice,
            NewComboType = newComboType,
            NewPrice = newPrice,
            PriceDifference = priceDifference,
            PriceChangeDescription = priceChangeDescription,
            AffectedOrdersCount = affectedOrdersCount,
            TotalImpact = totalImpact
        };
    }

    /// <summary>
    /// Maps subscription to response DTO.
    /// TotalDays and TotalPrice are passed separately to allow dynamic calculation.
    /// </summary>
    private static SubscriptionResponse MapToResponse(LunchSubscription subscription, int calculatedTotalDays, decimal calculatedTotalPrice)
    {
        // Address comes from Employee's Project (one project = one address)
        var project = subscription.Employee?.Project;
        return new SubscriptionResponse
        {
            Id = subscription.Id,
            EmployeeId = subscription.EmployeeId,
            EmployeeName = subscription.Employee?.FullName ?? "",
            EmployeePhone = subscription.Employee?.Phone ?? "",
            ComboType = subscription.ComboType,
            
            // Address derived from Project (delivery_address_id is deprecated)
            ProjectId = project?.Id,
            ProjectName = project?.Name,
            DeliveryAddress = !string.IsNullOrEmpty(project?.AddressFullAddress) 
                ? project.AddressFullAddress 
                : project?.AddressName,
            
            IsActive = subscription.IsActive,
            
            // Subscription period & pricing
            StartDate = subscription.StartDate?.ToString("yyyy-MM-dd"),
            EndDate = subscription.EndDate?.ToString("yyyy-MM-dd"),
            // ═══════════════════════════════════════════════════════════════
            // DYNAMIC TOTAL DAYS: Always reflects actual count of orders
            // ═══════════════════════════════════════════════════════════════
            TotalDays = calculatedTotalDays,
            // ═══════════════════════════════════════════════════════════════
            // DYNAMIC TOTAL PRICE: Always reflects actual sum of future orders
            // ═══════════════════════════════════════════════════════════════
            TotalPrice = calculatedTotalPrice,
            Status = subscription.Status.ToRussian(),
            // Normalize legacy WEEKDAYS → EVERY_DAY
            ScheduleType = ScheduleTypeHelper.Normalize(subscription.ScheduleType),
            
            // Freeze info
            FrozenDaysCount = subscription.FrozenDaysCount,
            OriginalEndDate = subscription.OriginalEndDate?.ToString("yyyy-MM-dd"),
            
            CreatedAt = subscription.CreatedAt,
            UpdatedAt = subscription.UpdatedAt
        };
    }

    /// <summary>
    /// Calculates actual TotalPrice as sum of future order prices (Active/Frozen status, today and forward).
    /// This is always accurate regardless of order modifications.
    /// NOTE: Uses UTC for simplicity in aggregate calculations - acceptable for totals.
    /// </summary>
    private async Task<decimal> CalculateDynamicTotalPriceAsync(Guid employeeId, CancellationToken cancellationToken)
    {
        // NOTE: Using UTC here is acceptable for aggregate calculations
        // The slight timezone boundary difference won't significantly impact total sums
        var today = DateTime.UtcNow.Date;
        return await _context.Orders
            .Where(o => o.EmployeeId == employeeId &&
                       (o.Status == Domain.Enums.OrderStatus.Active || o.Status == Domain.Enums.OrderStatus.Frozen) &&
                       o.OrderDate.Date >= today)
            .SumAsync(o => o.Price, cancellationToken);
    }

    /// <summary>
    /// Calculates actual TotalDays as count of all orders in subscription period.
    /// Includes: Active, Frozen (future) + Delivered, Completed (past).
    /// This is always accurate regardless of when subscription was created.
    /// </summary>
    private async Task<int> CalculateDynamicTotalDaysAsync(Guid employeeId, DateOnly? startDate, DateOnly? endDate, CancellationToken cancellationToken)
    {
        if (!startDate.HasValue || !endDate.HasValue)
            return 0;

        var startDateTime = startDate.Value.ToDateTime(TimeOnly.MinValue);
        var endDateTime = endDate.Value.ToDateTime(TimeOnly.MaxValue);

        // Count ALL orders in subscription period (not cancelled)
        // This includes: Active, Frozen, Paused, Delivered, Completed
        return await _context.Orders
            .Where(o => o.EmployeeId == employeeId &&
                       o.Status != Domain.Enums.OrderStatus.Cancelled &&
                       o.OrderDate >= startDateTime &&
                       o.OrderDate <= endDateTime)
            .CountAsync(cancellationToken);
    }

    /// <summary>
    /// Creates orders for all days in subscription period (from start date to end date).
    /// Respects employee's working days schedule.
    /// </summary>
    private async Task<int> CreateOrdersForSubscriptionAsync(
        LunchSubscription subscription,
        Employee employee,
        Project project,
        CancellationToken cancellationToken)
    {
        // IMPORTANT: Use project's timezone for "today" comparison!
        var createOrdersTimezone = project?.Timezone;
        var today = TimezoneHelper.GetLocalTodayDate(createOrdersTimezone);
        var startDate = subscription.StartDate ?? today;
        var endDate = subscription.EndDate ?? startDate.AddMonths(1);

        // Don't create orders for past dates (except today)
        if (startDate < today)
            startDate = today;

        if (endDate < startDate)
            return 0;

        var price = subscription.ComboType switch
        {
            "Комбо 25" => 25m,
            "Комбо 35" => 35m,
            _ => 25m
        };

        var ordersCreated = 0;

        // ═══════════════════════════════════════════════════════════════
        // CUTOFF CHECK: Determine if we should skip today due to cutoff
        // ═══════════════════════════════════════════════════════════════
        var skipToday = project != null && TimezoneHelper.IsCutoffPassed(project.CutoffTime, project.Timezone);

        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            // Skip today if cutoff has passed
            if (skipToday && date == today)
                continue;

            // Check if order should be created based on schedule type and working days
            // EVERY_DAY: all working days (Mon-Fri or employee's schedule)
            // EVERY_OTHER_DAY: Mon, Wed, Fri only (if they're working days)
            if (!WorkingDaysHelper.ShouldCreateOrderForDate(subscription.ScheduleType, employee.WorkingDays, date))
                continue;

            // Check if ACTIVE order already exists (exclude cancelled orders)
            var dayStartUtc = DateTime.SpecifyKind(date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
            var dayEndUtc = dayStartUtc.AddDays(1);
            var orderExists = await _context.Orders
                .AnyAsync(o =>
                    o.EmployeeId == employee.Id &&
                    o.OrderDate >= dayStartUtc &&
                    o.OrderDate < dayEndUtc &&
                    o.Status != OrderStatus.Cancelled,
                    cancellationToken);

            if (orderExists)
                continue;

            var order = new Order
            {
                Id = Guid.NewGuid(),
                CompanyId = project.CompanyId,
                ProjectId = project.Id,
                EmployeeId = employee.Id,
                ComboType = subscription.ComboType,
                Price = price,
                CurrencyCode = project.CurrencyCode,
                Status = OrderStatus.Active,
                OrderDate = DateTime.SpecifyKind(date.ToDateTime(TimeOnly.Parse("12:00")), DateTimeKind.Utc),
                IsGuestOrder = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Orders.Add(order);
            ordersCreated++;
        }

        return ordersCreated;
    }

    /// <summary>
    /// Create orders for an extended period (used when resuming paused subscriptions).
    /// Creates orders from startDate to endDate for working days only.
    /// </summary>
    private async Task<int> CreateOrdersForExtendedPeriodAsync(
        LunchSubscription subscription,
        Employee employee,
        Project project,
        DateOnly startDate,
        DateOnly endDate,
        CancellationToken cancellationToken)
    {
        if (endDate < startDate)
            return 0;

        var price = subscription.ComboType switch
        {
            "Комбо 25" => 25m,
            "Комбо 35" => 35m,
            _ => 25m
        };

        var ordersCreated = 0;

        // ═══════════════════════════════════════════════════════════════
        // CUTOFF CHECK: Determine if we should skip today due to cutoff
        // ═══════════════════════════════════════════════════════════════
        var extendTimezone = project?.Timezone;
        var extendToday = TimezoneHelper.GetLocalTodayDate(extendTimezone);
        var skipToday = project != null && TimezoneHelper.IsCutoffPassed(project.CutoffTime, project.Timezone);

        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            // Skip today if cutoff has passed
            if (skipToday && date == extendToday)
                continue;

            // Check if order should be created based on schedule type and working days
            // EVERY_DAY: all working days, EVERY_OTHER_DAY: Mon, Wed, Fri only
            if (!WorkingDaysHelper.ShouldCreateOrderForDate(subscription.ScheduleType, employee.WorkingDays, date))
                continue;

            // Check if order already exists for this date
            var dayStartUtc = DateTime.SpecifyKind(date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
            var dayEndUtc = dayStartUtc.AddDays(1);
            var orderExists = await _context.Orders
                .AnyAsync(o =>
                    o.EmployeeId == employee.Id &&
                    o.OrderDate >= dayStartUtc &&
                    o.OrderDate < dayEndUtc &&
                    o.Status != OrderStatus.Cancelled,
                    cancellationToken);

            if (orderExists)
                continue;

            var order = new Order
            {
                Id = Guid.NewGuid(),
                CompanyId = project.CompanyId,
                ProjectId = project.Id,
                EmployeeId = employee.Id,
                ComboType = subscription.ComboType,
                Price = price,
                CurrencyCode = project.CurrencyCode,
                Status = OrderStatus.Active,
                OrderDate = DateTime.SpecifyKind(date.ToDateTime(TimeOnly.Parse("12:00")), DateTimeKind.Utc),
                IsGuestOrder = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Orders.Add(order);
            ordersCreated++;
        }

        return ordersCreated;
    }

    /// <summary>
    /// Create orders for specific custom days (CUSTOM schedule type)
    /// </summary>
    private async Task<int> CreateOrdersForCustomDaysAsync(
        LunchSubscription subscription,
        Employee employee,
        Project project,
        List<string> customDays,
        CancellationToken cancellationToken)
    {
        var price = subscription.ComboType switch
        {
            "Комбо 25" => 25m,
            "Комбо 35" => 35m,
            _ => 25m
        };

        var ordersCreated = 0;

        // IMPORTANT: Use project's timezone for "today" comparison!
        var customDaysTimezone = project?.Timezone;
        var customDaysToday = TimezoneHelper.GetLocalTodayDate(customDaysTimezone);

        // ═══════════════════════════════════════════════════════════════
        // CUTOFF CHECK: Determine if we should skip today due to cutoff
        // ═══════════════════════════════════════════════════════════════
        var skipToday = project != null && TimezoneHelper.IsCutoffPassed(project.CutoffTime, project.Timezone);

        foreach (var dayString in customDays)
        {
            var date = DateOnly.Parse(dayString);

            // Skip past dates (except today)
            if (date < customDaysToday)
                continue;

            // Skip today if cutoff has passed
            if (skipToday && date == customDaysToday)
                continue;

            // Check if ACTIVE order already exists (exclude cancelled orders)
            var dayStartUtc = DateTime.SpecifyKind(date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
            var dayEndUtc = dayStartUtc.AddDays(1);
            var orderExists = await _context.Orders
                .AnyAsync(o =>
                    o.EmployeeId == employee.Id &&
                    o.OrderDate >= dayStartUtc &&
                    o.OrderDate < dayEndUtc &&
                    o.Status != OrderStatus.Cancelled,
                    cancellationToken);

            if (orderExists)
                continue;

            var order = new Order
            {
                Id = Guid.NewGuid(),
                CompanyId = project.CompanyId,
                ProjectId = project.Id,
                EmployeeId = employee.Id,
                ComboType = subscription.ComboType,
                Price = price,
                CurrencyCode = project.CurrencyCode,
                Status = OrderStatus.Active,
                OrderDate = DateTime.SpecifyKind(date.ToDateTime(TimeOnly.Parse("12:00")), DateTimeKind.Utc),
                IsGuestOrder = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Orders.Add(order);
            ordersCreated++;
        }

        return ordersCreated;
    }
}
