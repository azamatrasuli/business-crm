using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using YallaBusinessAdmin.Application.Common.Errors;
using YallaBusinessAdmin.Application.Common.Interfaces;
using YallaBusinessAdmin.Application.Orders;
using YallaBusinessAdmin.Application.Orders.Dtos;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;
using YallaBusinessAdmin.Infrastructure.Services.Dashboard;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class OrderFreezeService : IOrderFreezeService
{
    private readonly AppDbContext _context;
    private readonly ILogger<OrderFreezeService> _logger;
    private readonly IBusinessConfigService _configService;

    public OrderFreezeService(
        AppDbContext context, 
        ILogger<OrderFreezeService> logger,
        IBusinessConfigService configService)
    {
        _context = context;
        _logger = logger;
        _configService = configService;
    }

    public async Task<FreezeOrderResponse> FreezeOrderAsync(
        Guid orderId,
        FreezeOrderRequest request,
        Guid companyId,
        CancellationToken cancellationToken = default)
    {
        var order = await _context.Orders
            .Include(o => o.Employee)
            .Include(o => o.Project) // Need project for cutoff check
            .FirstOrDefaultAsync(o => o.Id == orderId && o.CompanyId == companyId, cancellationToken);

        if (order == null)
            throw new KeyNotFoundException("Заказ не найден");

        if (order.EmployeeId == null)
            throw new InvalidOperationException("Гостевые заказы нельзя замораживать");

        if (!order.CanBeFrozen)
            throw new InvalidOperationException("Этот заказ нельзя заморозить. Можно замораживать только активные заказы на текущий или будущий день.");

        // ═══════════════════════════════════════════════════════════════
        // CUTOFF VALIDATION: Cannot freeze today's order after cutoff time
        // ═══════════════════════════════════════════════════════════════
        if (order.OrderDate.Date == DateTime.UtcNow.Date && order.Project != null)
        {
            if (TimezoneHelper.IsCutoffPassed(order.Project.CutoffTime, order.Project.Timezone))
            {
                throw new BusinessRuleException(
                    ErrorCodes.ORDER_CUTOFF_PASSED,
                    $"Время для заморозки заказов на сегодня истекло в {order.Project.CutoffTime}. " +
                    $"Заказы на завтра и далее можно заморозить.");
            }
        }

        // Check freeze limit (from business config)
        var orderDate = DateOnly.FromDateTime(order.OrderDate);
        var maxFreezesPerWeek = await _configService.GetIntAsync(ConfigKeys.SubscriptionMaxFreezesPerWeek, 2, cancellationToken);
        if (!await ValidateFreezeLimitAsync(order.EmployeeId.Value, orderDate, maxFreezesPerWeek, cancellationToken))
        {
            throw new BusinessRuleException(
                ErrorCodes.FREEZE_LIMIT_EXCEEDED,
                $"Превышен лимит заморозок ({maxFreezesPerWeek} в неделю). Попробуйте на следующей неделе.");
        }

        // Get employee's subscription
        // NOTE: Using only IsActive check (Status is derived from IsActive)
        var subscription = await _context.LunchSubscriptions
            .Where(s => s.EmployeeId == order.EmployeeId && s.IsActive)
            .FirstOrDefaultAsync(cancellationToken);

        if (subscription == null)
            throw new InvalidOperationException("У сотрудника нет активной подписки");

        // Freeze the order
        order.Freeze(request.Reason);

        // Extend subscription by 1 day
        subscription.ExtendByFrozenOrder();

        // Create replacement order at the end of subscription
        var replacementOrder = await CreateReplacementOrderAsync(order, subscription, cancellationToken);
        order.ReplacementOrderId = replacementOrder.Id;

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Order {OrderId} frozen for employee {EmployeeId}. Subscription extended to {NewEndDate}. Replacement order {ReplacementId} created.",
            order.Id, order.EmployeeId, subscription.EndDate, replacementOrder.Id);

        return new FreezeOrderResponse
        {
            Order = MapToResponse(order),
            ReplacementOrder = MapToResponse(replacementOrder),
            Subscription = MapToSubscriptionInfo(subscription)
        };
    }

    public async Task<FreezeOrderResponse> UnfreezeOrderAsync(
        Guid orderId,
        Guid companyId,
        CancellationToken cancellationToken = default)
    {
        var order = await _context.Orders
            .Include(o => o.Employee)
            .Include(o => o.ReplacementOrder)
            .Include(o => o.Project) // Need project for cutoff check
            .FirstOrDefaultAsync(o => o.Id == orderId && o.CompanyId == companyId, cancellationToken);

        if (order == null)
            throw new KeyNotFoundException("Заказ не найден");

        if (order.EmployeeId == null)
            throw new InvalidOperationException("Гостевые заказы нельзя размораживать");

        if (!order.CanBeUnfrozen)
            throw new InvalidOperationException("Этот заказ нельзя разморозить. Можно размораживать только замороженные заказы на текущий или будущий день.");

        // ═══════════════════════════════════════════════════════════════
        // CUTOFF VALIDATION: Cannot unfreeze today's order after cutoff time
        // ═══════════════════════════════════════════════════════════════
        if (order.OrderDate.Date == DateTime.UtcNow.Date && order.Project != null)
        {
            if (TimezoneHelper.IsCutoffPassed(order.Project.CutoffTime, order.Project.Timezone))
            {
                throw new BusinessRuleException(
                    ErrorCodes.ORDER_CUTOFF_PASSED,
                    $"Время для разморозки заказов на сегодня истекло в {order.Project.CutoffTime}. " +
                    $"Заказы на завтра и далее можно разморозить.");
            }
        }

        // Get employee's subscription
        var subscription = await _context.LunchSubscriptions
            .Where(s => s.EmployeeId == order.EmployeeId && s.IsActive)
            .FirstOrDefaultAsync(cancellationToken);

        if (subscription == null)
            throw new InvalidOperationException("У сотрудника нет активной подписки");

        // Delete replacement order if exists
        if (order.ReplacementOrderId.HasValue)
        {
            var replacementOrder = await _context.Orders
                .FirstOrDefaultAsync(o => o.Id == order.ReplacementOrderId, cancellationToken);
            
            if (replacementOrder != null)
            {
                _context.Orders.Remove(replacementOrder);
            }
        }

        // Unfreeze the order
        order.Unfreeze();
        order.ReplacementOrderId = null;

        // Shrink subscription by 1 day
        subscription.ShrinkByUnfrozenOrder();

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Order {OrderId} unfrozen for employee {EmployeeId}. Subscription shrunk to {NewEndDate}.",
            order.Id, order.EmployeeId, subscription.EndDate);

        return new FreezeOrderResponse
        {
            Order = MapToResponse(order),
            ReplacementOrder = null,
            Subscription = MapToSubscriptionInfo(subscription)
        };
    }

    public async Task<FreezePeriodResponse> FreezePeriodAsync(
        FreezePeriodRequest request,
        Guid companyId,
        CancellationToken cancellationToken = default)
    {
        var employee = await _context.Employees
            .Include(e => e.Project) // Need project for cutoff check
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId && e.CompanyId == companyId, cancellationToken);

        if (employee == null)
            throw new KeyNotFoundException("Сотрудник не найден");

        // ═══════════════════════════════════════════════════════════════
        // CUTOFF VALIDATION: Check if cutoff passed for today's orders
        // We'll skip today's orders in the loop if cutoff has passed
        // ═══════════════════════════════════════════════════════════════
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var cutoffPassedForToday = false;
        if (request.StartDate <= today && employee.Project != null)
        {
            cutoffPassedForToday = TimezoneHelper.IsCutoffPassed(employee.Project.CutoffTime, employee.Project.Timezone);
            if (cutoffPassedForToday)
            {
                _logger.LogInformation(
                    "Cutoff passed, today's orders will be skipped for employee {EmployeeId}",
                    request.EmployeeId);
            }
        }

        // Get all orders in the period
        var ordersInPeriod = await _context.Orders
            .Include(o => o.Project) // Need project for individual cutoff checks
            .Where(o => o.EmployeeId == request.EmployeeId && 
                        o.CompanyId == companyId &&
                        o.Status == OrderStatus.Active &&
                        DateOnly.FromDateTime(o.OrderDate) >= request.StartDate &&
                        DateOnly.FromDateTime(o.OrderDate) <= request.EndDate)
            .ToListAsync(cancellationToken);

        if (!ordersInPeriod.Any())
            throw new InvalidOperationException("Нет активных заказов в указанном периоде");

        // Get subscription
        // NOTE: Using only IsActive check (Status is derived from IsActive)
        var subscription = await _context.LunchSubscriptions
            .Where(s => s.EmployeeId == request.EmployeeId && s.IsActive)
            .FirstOrDefaultAsync(cancellationToken);

        if (subscription == null)
            throw new InvalidOperationException("У сотрудника нет активной подписки");

        // Get freeze limit from business config
        var maxFreezesPerWeek = await _configService.GetIntAsync(ConfigKeys.SubscriptionMaxFreezesPerWeek, 2, cancellationToken);

        var frozenOrders = new List<Order>();
        var replacementOrders = new List<Order>();

        foreach (var order in ordersInPeriod)
        {
            var orderDate = DateOnly.FromDateTime(order.OrderDate);
            
            // ═══════════════════════════════════════════════════════════════
            // CUTOFF VALIDATION: Skip today's orders if cutoff passed
            // ═══════════════════════════════════════════════════════════════
            if (order.OrderDate.Date == DateTime.UtcNow.Date && order.Project != null)
            {
                if (TimezoneHelper.IsCutoffPassed(order.Project.CutoffTime, order.Project.Timezone))
                {
                    _logger.LogWarning(
                        "Skipping order {OrderId} - cutoff time passed for today's order",
                        order.Id);
                    continue;
                }
            }
            
            // Check freeze limit for this week
            if (!await ValidateFreezeLimitAsync(request.EmployeeId, orderDate, maxFreezesPerWeek, cancellationToken))
            {
                _logger.LogWarning(
                    "Freeze limit reached for employee {EmployeeId} on {Date}. Stopping period freeze.",
                    request.EmployeeId, orderDate);
                break;
            }

            if (!order.CanBeFrozen)
                continue;

            // Freeze the order
            order.Freeze(request.Reason);

            // Extend subscription
            subscription.ExtendByFrozenOrder();

            // Create replacement order
            var replacementOrder = await CreateReplacementOrderAsync(order, subscription, cancellationToken);
            order.ReplacementOrderId = replacementOrder.Id;

            frozenOrders.Add(order);
            replacementOrders.Add(replacementOrder);
        }

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Period freeze completed for employee {EmployeeId}. {Count} orders frozen. New end date: {EndDate}",
            request.EmployeeId, frozenOrders.Count, subscription.EndDate);

        return new FreezePeriodResponse
        {
            FrozenOrders = frozenOrders.Select(MapToResponse).ToList(),
            ReplacementOrders = replacementOrders.Select(MapToResponse).ToList(),
            Subscription = MapToSubscriptionInfo(subscription),
            FrozenDaysCount = frozenOrders.Count
        };
    }

    public async Task<EmployeeFreezeInfoResponse> GetEmployeeFreezeInfoAsync(
        Guid employeeId,
        Guid companyId,
        CancellationToken cancellationToken = default)
    {
        var employee = await _context.Employees
            .FirstOrDefaultAsync(e => e.Id == employeeId && e.CompanyId == companyId, cancellationToken);

        if (employee == null)
            throw new KeyNotFoundException("Сотрудник не найден");

        // Get current week bounds
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var weekStart = today.AddDays(-(int)today.DayOfWeek + (int)DayOfWeek.Monday);
        if (today.DayOfWeek == DayOfWeek.Sunday)
            weekStart = weekStart.AddDays(-7);
        var weekEnd = weekStart.AddDays(6);

        // Count freezes this week
        var freezesThisWeek = await _context.Orders
            .Where(o => o.EmployeeId == employeeId &&
                        o.Status == OrderStatus.Frozen &&
                        o.FrozenAt.HasValue &&
                        DateOnly.FromDateTime(o.FrozenAt.Value) >= weekStart &&
                        DateOnly.FromDateTime(o.FrozenAt.Value) <= weekEnd)
            .CountAsync(cancellationToken);

        // Get frozen orders
        var frozenOrders = await _context.Orders
            .Where(o => o.EmployeeId == employeeId && o.Status == OrderStatus.Frozen)
            .OrderByDescending(o => o.OrderDate)
            .Take(10)
            .ToListAsync(cancellationToken);

        // Get subscription
        var subscription = await _context.LunchSubscriptions
            .Where(s => s.EmployeeId == employeeId && s.IsActive)
            .FirstOrDefaultAsync(cancellationToken);

        // Get freeze limit from business config
        var maxFreezesPerWeek = await _configService.GetIntAsync(ConfigKeys.SubscriptionMaxFreezesPerWeek, 2, cancellationToken);
        var remainingFreezes = Math.Max(0, maxFreezesPerWeek - freezesThisWeek);

        return new EmployeeFreezeInfoResponse
        {
            EmployeeId = employeeId,
            EmployeeName = employee.FullName,
            FreezesThisWeek = freezesThisWeek,
            MaxFreezesPerWeek = maxFreezesPerWeek,
            CanFreeze = remainingFreezes > 0,
            RemainingFreezes = remainingFreezes,
            FrozenOrders = frozenOrders.Select(MapToResponse).ToList(),
            Subscription = subscription != null ? MapToSubscriptionInfo(subscription) : null,
            WeekStart = weekStart,
            WeekEnd = weekEnd
        };
    }

    public async Task<List<OrderResponse>> GetEmployeeOrdersAsync(
        Guid employeeId,
        DateOnly? startDate,
        DateOnly? endDate,
        Guid companyId,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Orders
            .Include(o => o.ReplacementOrder)
            .Where(o => o.EmployeeId == employeeId && o.CompanyId == companyId);

        if (startDate.HasValue)
            query = query.Where(o => DateOnly.FromDateTime(o.OrderDate) >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(o => DateOnly.FromDateTime(o.OrderDate) <= endDate.Value);

        var orders = await query
            .OrderByDescending(o => o.OrderDate)
            .ToListAsync(cancellationToken);

        return orders.Select(MapToResponse).ToList();
    }

    /// <summary>
    /// Validate if employee can freeze more orders this week.
    /// </summary>
    /// <param name="employeeId">Employee ID</param>
    /// <param name="date">Date to check freeze limit for</param>
    /// <param name="maxFreezesPerWeek">Maximum allowed freezes per week (from config)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if employee can freeze more orders</returns>
    public async Task<bool> ValidateFreezeLimitAsync(
        Guid employeeId,
        DateOnly date,
        int maxFreezesPerWeek,
        CancellationToken cancellationToken = default)
    {
        // Get week bounds for the given date
        var weekStart = date.AddDays(-(int)date.DayOfWeek + (int)DayOfWeek.Monday);
        if (date.DayOfWeek == DayOfWeek.Sunday)
            weekStart = weekStart.AddDays(-7);
        var weekEnd = weekStart.AddDays(6);

        // Count freezes this week
        var freezesThisWeek = await _context.Orders
            .Where(o => o.EmployeeId == employeeId &&
                        o.Status == OrderStatus.Frozen &&
                        o.FrozenAt.HasValue &&
                        DateOnly.FromDateTime(o.FrozenAt.Value) >= weekStart &&
                        DateOnly.FromDateTime(o.FrozenAt.Value) <= weekEnd)
            .CountAsync(cancellationToken);

        return freezesThisWeek < maxFreezesPerWeek;
    }

    private async Task<Order> CreateReplacementOrderAsync(
        Order originalOrder,
        LunchSubscription subscription,
        CancellationToken cancellationToken)
    {
        // Find the next available working day after the current subscription end date
        var employee = await _context.Employees
            .Include(e => e.Project)
            .FirstOrDefaultAsync(e => e.Id == originalOrder.EmployeeId, cancellationToken);

        if (employee == null)
            throw new InvalidOperationException("Сотрудник не найден");

        // Replacement order date is the new end date of subscription
        var replacementDate = subscription.EndDate!.Value;
        
        // Create the replacement order
        var replacementOrder = new Order
        {
            Id = Guid.NewGuid(),
            CompanyId = originalOrder.CompanyId,
            ProjectId = originalOrder.ProjectId,
            EmployeeId = originalOrder.EmployeeId,
            ComboType = originalOrder.ComboType,
            Price = originalOrder.Price,
            CurrencyCode = originalOrder.CurrencyCode,
            Status = OrderStatus.Active,
            OrderDate = DateTime.SpecifyKind(replacementDate.ToDateTime(TimeOnly.Parse("12:00")), DateTimeKind.Utc),
            IsGuestOrder = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Orders.Add(replacementOrder);

        return replacementOrder;
    }

    private static OrderResponse MapToResponse(Order order)
    {
        return new OrderResponse
        {
            Id = order.Id,
            CompanyId = order.CompanyId,
            ProjectId = order.ProjectId,
            EmployeeId = order.EmployeeId,
            EmployeeName = order.Employee?.FullName,
            GuestName = order.GuestName,
            IsGuestOrder = order.IsGuestOrder,
            ComboType = order.ComboType,
            Price = order.Price,
            CurrencyCode = order.CurrencyCode,
            Status = order.Status.ToRussian(),
            OrderDate = order.OrderDate,
            FrozenAt = order.FrozenAt,
            FrozenReason = order.FrozenReason,
            ReplacementOrderId = order.ReplacementOrderId,
            ReplacementOrder = order.ReplacementOrder != null ? MapToResponse(order.ReplacementOrder) : null,
            CreatedAt = order.CreatedAt,
            UpdatedAt = order.UpdatedAt
        };
    }

    private static SubscriptionInfo MapToSubscriptionInfo(LunchSubscription subscription)
    {
        return new SubscriptionInfo
        {
            Id = subscription.Id,
            OriginalEndDate = subscription.OriginalEndDate,
            EndDate = subscription.EndDate,
            FrozenDaysCount = subscription.FrozenDaysCount,
            TotalDays = subscription.TotalDays
        };
    }
}

