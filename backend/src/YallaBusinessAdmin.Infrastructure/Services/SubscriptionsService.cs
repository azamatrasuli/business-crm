using System.Globalization;
using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Common.Errors;
using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Subscriptions;
using YallaBusinessAdmin.Application.Subscriptions.Dtos;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Domain.Helpers;
using YallaBusinessAdmin.Domain.StateMachines;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class SubscriptionsService : ISubscriptionsService
{
    private readonly AppDbContext _context;

    public SubscriptionsService(AppDbContext context)
    {
        _context = context;
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

        var items = subscriptions.Select(MapToResponse);
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

        return MapToResponse(subscription);
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

        return MapToResponse(subscription);
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
        // VALIDATION: Cannot create subscription for past dates
        // ═══════════════════════════════════════════════════════════════
        var today = DateOnly.FromDateTime(DateTime.Today);
        if (request.StartDate.HasValue && request.StartDate.Value < today)
        {
            throw new BusinessRuleException(
                ErrorCodes.SUB_PAST_DATE_NOT_ALLOWED,
                "Нельзя создать подписку на прошедшие даты");
        }

        // ═══════════════════════════════════════════════════════════════
        // VALIDATION: Project must have sufficient budget
        // Calculate required budget based on dates and combo type
        // ═══════════════════════════════════════════════════════════════
        var validationStartDate = request.StartDate ?? today;
        var validationEndDate = request.EndDate ?? validationStartDate.AddMonths(1);
        var validationTotalDays = WorkingDaysHelper.CountWorkingDays(employee.WorkingDays, validationStartDate, validationEndDate);
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
            var reactivateStartDate = request.StartDate ?? DateOnly.FromDateTime(DateTime.Today);
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
            existingSubscription.Status = "Активна";
            existingSubscription.StartDate = reactivateStartDate;
            existingSubscription.EndDate = reactivateEndDate;
            existingSubscription.TotalDays = reactivateTotalDays;
            existingSubscription.TotalPrice = reactivatePrice * reactivateTotalDays;
            existingSubscription.UpdatedAt = DateTime.UtcNow;

            // Create orders for reactivated subscription
            await CreateOrdersForSubscriptionAsync(
                existingSubscription, employee, employee.Project!, cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
            existingSubscription.Employee = employee;
            return MapToResponse(existingSubscription);
        }

        // Calculate total WORKING days and price
        var startDate = request.StartDate ?? DateOnly.FromDateTime(DateTime.Today);
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
            Status = "Активна",
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

        subscription.Employee = employee;

        return MapToResponse(subscription);
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
                var oldPrice = oldComboType switch
                {
                    "Комбо 25" => 25m,
                    "Комбо 35" => 35m,
                    _ => 25m
                };
                
                var newPrice = request.ComboType switch
                {
                    "Комбо 25" => 25m,
                    "Комбо 35" => 35m,
                    _ => 25m
                };
                
                // Get future orders to update (Active or Frozen, today and forward)
                var futureOrders = await _context.Orders
                    .Where(o => o.EmployeeId == subscription.EmployeeId && 
                               (o.Status == OrderStatus.Active || o.Status == OrderStatus.Frozen) &&
                               o.OrderDate >= DateTime.UtcNow.Date)
                    .ToListAsync(cancellationToken);
                
                var futureOrdersCount = futureOrders.Count;
                
                // FIXED: Recalculate subscription price correctly
                // TotalPrice = (completed days * old price) + (remaining days * new price)
                // We can calculate this as: current price - (remaining * old price) + (remaining * new price)
                // Which simplifies to: current price + remaining * (new price - old price)
                if (futureOrdersCount > 0)
                {
                    var priceDifference = (newPrice - oldPrice) * futureOrdersCount;
                    subscription.TotalPrice += priceDifference;
                }
                else if (subscription.TotalDays > 0)
                {
                    // Fallback: if no future orders, recalculate from scratch
                    subscription.TotalPrice = newPrice * subscription.TotalDays;
                }
                
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

        return MapToResponse(subscription);
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
        // SOFT DELETE: Deactivate instead of hard delete
        // ═══════════════════════════════════════════════════════════════
        subscription.Deactivate(); // Uses domain method which sets IsActive=false and Status="Завершена"

        // ═══════════════════════════════════════════════════════════════
        // CANCEL FUTURE ORDERS: Cancel orders from today onwards (Active or Frozen)
        // Orders already Delivered/Completed are not affected (history preserved)
        // ═══════════════════════════════════════════════════════════════
        var today = DateTime.UtcNow.Date;
        var futureOrders = await _context.Orders
            .Where(o => o.EmployeeId == subscription.EmployeeId
                     && (o.Status == OrderStatus.Active || o.Status == OrderStatus.Frozen)
                     && o.OrderDate >= today)
            .ToListAsync(cancellationToken);

        // FIX: Рассчитываем сумму возврата за отменённые заказы
        var refundAmount = futureOrders.Sum(o => o.Price);
        var cancelledCount = futureOrders.Count;

        foreach (var order in futureOrders)
        {
            order.Status = OrderStatus.Cancelled;
            order.UpdatedAt = DateTime.UtcNow;
        }

        // FIX: Возвращаем бюджет в проект
        if (refundAmount > 0 && subscription.Employee?.Project != null)
        {
            subscription.Employee.Project.Budget += refundAmount;
            subscription.Employee.Project.UpdatedAt = DateTime.UtcNow;
        }

        // ═══════════════════════════════════════════════════════════════
        // FIX: Update TotalPrice to reflect actual delivered orders
        // TotalPrice = original - cancelled amount
        // ═══════════════════════════════════════════════════════════════
        subscription.TotalPrice -= refundAmount;
        subscription.TotalDays -= cancelledCount;

        // ═══════════════════════════════════════════════════════════════
        // FIX: Reset Employee.ServiceType since no active lunch subscription
        // This allows employee to switch to COMPENSATION if needed
        // ═══════════════════════════════════════════════════════════════
        if (subscription.Employee != null)
        {
            subscription.Employee.ServiceType = null;
            subscription.Employee.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);
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
            // VALIDATION: Check budget (early validation before date parsing)
            // ═══════════════════════════════════════════════════════════════
            var earlyStartDate = !string.IsNullOrEmpty(request.StartDate)
                ? DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd", CultureInfo.InvariantCulture)
                : DateOnly.FromDateTime(DateTime.Today);
            var earlyEndDate = !string.IsNullOrEmpty(request.EndDate)
                ? DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd", CultureInfo.InvariantCulture)
                : earlyStartDate.AddMonths(1);
            
            int estimatedDays;
            if (request.ScheduleType == "CUSTOM" && request.CustomDays != null && request.CustomDays.Count > 0)
            {
                var today = DateOnly.FromDateTime(DateTime.Today);
                estimatedDays = request.CustomDays.Select(d => DateOnly.Parse(d)).Count(d => d >= today);
            }
            else
            {
                estimatedDays = WorkingDaysHelper.CountWorkingDays(employee.WorkingDays, earlyStartDate, earlyEndDate);
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
            var todayForValidation = DateOnly.FromDateTime(DateTime.Today);
            var startDate = !string.IsNullOrEmpty(request.StartDate)
                ? DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd", CultureInfo.InvariantCulture)
                : todayForValidation;
            var endDate = !string.IsNullOrEmpty(request.EndDate)
                ? DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd", CultureInfo.InvariantCulture)
                : startDate.AddMonths(1);

            // ═══════════════════════════════════════════════════════════════
            // VALIDATION: Cannot create subscription for past dates
            // ═══════════════════════════════════════════════════════════════
            if (startDate < todayForValidation)
            {
                errors.Add(new { employeeId = employee.Id.ToString(), message = $"{employee.FullName} (нельзя создать подписку на прошедшие даты)" });
                continue;
            }

            // Calculate total days based on schedule type
            // CRITICAL FIX: For CUSTOM, use the actual custom days count, not working days!
            int totalDays;
            if (request.ScheduleType == "CUSTOM" && request.CustomDays != null && request.CustomDays.Count > 0)
            {
                // For CUSTOM schedule, total days = number of custom days selected
                // Filter out past dates (same logic as CreateOrdersForCustomDaysAsync)
                var today = DateOnly.FromDateTime(DateTime.Today);
                totalDays = request.CustomDays
                    .Select(d => DateOnly.Parse(d))
                    .Count(d => d >= today);
            }
            else
            {
                // For EVERY_DAY (and converted EVERY_OTHER_DAY), count working days
                totalDays = WorkingDaysHelper.CountWorkingDays(employee.WorkingDays, startDate, endDate);
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
                subscription.Status = "Активна";
                subscription.StartDate = startDate;
                subscription.EndDate = endDate;
                subscription.TotalDays = totalDays;
                subscription.TotalPrice = totalPrice;
                subscription.ScheduleType = request.ScheduleType ?? "EVERY_DAY";
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
                    Status = "Активна",
                    StartDate = startDate,
                    EndDate = endDate,
                    TotalDays = totalDays,
                    TotalPrice = totalPrice,
                    ScheduleType = request.ScheduleType ?? "EVERY_DAY",
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

            createdSubscriptions.Add(MapToResponse(subscription));
        }

            await _context.SaveChangesAsync(cancellationToken);
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
                    var oldPrice = oldComboType switch
                    {
                        "Комбо 25" => 25m,
                        "Комбо 35" => 35m,
                        _ => 25m
                    };
                    
                    var newPrice = request.ComboType switch
                    {
                        "Комбо 25" => 25m,
                        "Комбо 35" => 35m,
                        _ => 25m
                    };
                    
                    var activeOrders = await _context.Orders
                        .Where(o => o.EmployeeId == subscription.EmployeeId && 
                                   (o.Status == OrderStatus.Active || o.Status == OrderStatus.Frozen) &&
                                   o.OrderDate >= DateTime.UtcNow.Date)
                        .ToListAsync(cancellationToken);

                    var futureOrdersCount = activeOrders.Count;

                    foreach (var order in activeOrders)
                    {
                        order.ComboType = request.ComboType;
                        order.Price = newPrice;
                        order.UpdatedAt = DateTime.UtcNow;
                        ordersUpdated++;
                    }

                    // ═══════════════════════════════════════════════════════════════
                    // FIX: Recalculate TotalPrice (consistent with UpdateAsync)
                    // TotalPrice = (completed days * old price) + (remaining days * new price)
                    // ═══════════════════════════════════════════════════════════════
                    if (futureOrdersCount > 0)
                    {
                        var priceDifference = (newPrice - oldPrice) * futureOrdersCount;
                        subscription.TotalPrice += priceDifference;
                    }
                    else if (subscription.TotalDays > 0)
                    {
                        // Fallback: if no future orders, recalculate from scratch
                        subscription.TotalPrice = newPrice * subscription.TotalDays;
                    }
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

        subscription.IsActive = false;
        subscription.Status = "Приостановлена";
        subscription.PausedAt = DateTime.UtcNow;
        subscription.UpdatedAt = DateTime.UtcNow;

        // FIX: Приостановить все будущие активные заказы
        var futureOrders = await _context.Orders
            .Where(o => o.EmployeeId == subscription.EmployeeId && 
                       o.Status == OrderStatus.Active &&
                       o.OrderDate >= DateTime.UtcNow.Date)
            .ToListAsync(cancellationToken);

        foreach (var order in futureOrders)
        {
            order.Status = OrderStatus.Paused;
            order.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return MapToResponse(subscription);
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

        // FIX: Рассчитываем дни паузы и продлеваем подписку
        if (subscription.PausedAt.HasValue && subscription.EndDate.HasValue)
        {
            var pausedDays = (DateTime.UtcNow - subscription.PausedAt.Value).Days;
            subscription.PausedDaysCount += pausedDays;
            subscription.EndDate = subscription.EndDate.Value.AddDays(pausedDays);
        }

        subscription.IsActive = true;
        subscription.Status = "Активна";
        subscription.PausedAt = null;
        subscription.UpdatedAt = DateTime.UtcNow;

        // FIX: Возобновить все приостановленные заказы
        var pausedOrders = await _context.Orders
            .Where(o => o.EmployeeId == subscription.EmployeeId && 
                       o.Status == OrderStatus.Paused &&
                       o.OrderDate >= DateTime.UtcNow.Date)
            .ToListAsync(cancellationToken);

        foreach (var order in pausedOrders)
        {
            order.Status = OrderStatus.Active;
            order.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return MapToResponse(subscription);
    }

    public async Task<object> BulkPauseAsync(IEnumerable<Guid> subscriptionIds, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscriptions = await _context.LunchSubscriptions
            .Where(s => subscriptionIds.Contains(s.Id) && s.CompanyId == companyId && s.IsActive)
            .ToListAsync(cancellationToken);

        var paused = 0;
        var ordersPaused = 0;

        foreach (var subscription in subscriptions)
        {
            subscription.IsActive = false;
            subscription.Status = "Приостановлена";
            subscription.PausedAt = DateTime.UtcNow;
            subscription.UpdatedAt = DateTime.UtcNow;
            paused++;

            // ═══════════════════════════════════════════════════════════════
            // FIX: Also pause all future active orders (consistent with PauseAsync)
            // ═══════════════════════════════════════════════════════════════
            var futureOrders = await _context.Orders
                .Where(o => o.EmployeeId == subscription.EmployeeId && 
                           o.Status == OrderStatus.Active &&
                           o.OrderDate >= DateTime.UtcNow.Date)
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
            .Where(s => subscriptionIds.Contains(s.Id) && s.CompanyId == companyId && !s.IsActive)
            .ToListAsync(cancellationToken);

        var resumed = 0;
        var ordersResumed = 0;

        foreach (var subscription in subscriptions)
        {
            // ═══════════════════════════════════════════════════════════════
            // FIX: Calculate paused days and extend subscription (consistent with ResumeAsync)
            // ═══════════════════════════════════════════════════════════════
            if (subscription.PausedAt.HasValue && subscription.EndDate.HasValue)
            {
                var pausedDays = (DateTime.UtcNow - subscription.PausedAt.Value).Days;
                subscription.PausedDaysCount += pausedDays;
                subscription.EndDate = subscription.EndDate.Value.AddDays(pausedDays);
            }

            subscription.IsActive = true;
            subscription.Status = "Активна";
            subscription.PausedAt = null;
            subscription.UpdatedAt = DateTime.UtcNow;
            resumed++;

            // ═══════════════════════════════════════════════════════════════
            // FIX: Also resume all paused orders (consistent with ResumeAsync)
            // ═══════════════════════════════════════════════════════════════
            var pausedOrders = await _context.Orders
                .Where(o => o.EmployeeId == subscription.EmployeeId && 
                           o.Status == OrderStatus.Paused &&
                           o.OrderDate >= DateTime.UtcNow.Date)
                .ToListAsync(cancellationToken);

            foreach (var order in pausedOrders)
            {
                order.Status = OrderStatus.Active;
                order.UpdatedAt = DateTime.UtcNow;
                ordersResumed++;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new
        {
            message = $"Возобновлено {resumed} подписок и {ordersResumed} заказов",
            resumed,
            ordersResumed
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
        var affectedOrdersCount = await _context.Orders
            .CountAsync(o => o.EmployeeId == subscription.EmployeeId
                          && o.Status == Domain.Enums.OrderStatus.Active
                          && o.OrderDate >= DateTime.Today, cancellationToken);

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

    private static SubscriptionResponse MapToResponse(LunchSubscription subscription)
    {
        // Address comes from Employee's Project (one project = one address)
        return new SubscriptionResponse
        {
            Id = subscription.Id,
            EmployeeId = subscription.EmployeeId,
            EmployeeName = subscription.Employee?.FullName ?? "",
            EmployeePhone = subscription.Employee?.Phone ?? "",
            ComboType = subscription.ComboType,
            DeliveryAddressId = subscription.Employee?.ProjectId,
            DeliveryAddressName = subscription.Employee?.Project?.AddressName,
            IsActive = subscription.IsActive,
            
            // Subscription period & pricing
            StartDate = subscription.StartDate?.ToString("yyyy-MM-dd"),
            EndDate = subscription.EndDate?.ToString("yyyy-MM-dd"),
            TotalDays = subscription.TotalDays,
            TotalPrice = subscription.TotalPrice,
            Status = subscription.Status,
            ScheduleType = subscription.ScheduleType,
            
            // Freeze info
            FrozenDaysCount = subscription.FrozenDaysCount,
            OriginalEndDate = subscription.OriginalEndDate?.ToString("yyyy-MM-dd"),
            
            CreatedAt = subscription.CreatedAt,
            UpdatedAt = subscription.UpdatedAt
        };
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
        var startDate = subscription.StartDate ?? DateOnly.FromDateTime(DateTime.Today);
        var endDate = subscription.EndDate ?? startDate.AddMonths(1);
        var today = DateOnly.FromDateTime(DateTime.Today);

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

        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            // Check if it's a working day for this employee (uses default Mon-Fri if not set)
            if (!WorkingDaysHelper.IsWorkingDay(employee.WorkingDays, date))
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

        foreach (var dayString in customDays)
        {
            var date = DateOnly.Parse(dayString);

            // Skip past dates (except today)
            if (date < DateOnly.FromDateTime(DateTime.Today))
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
