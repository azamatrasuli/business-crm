using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using YallaBusinessAdmin.Application.Dashboard;
using YallaBusinessAdmin.Application.Dashboard.Dtos;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services.Dashboard;

/// <summary>
/// Service for managing employee subscriptions.
/// </summary>
public sealed class SubscriptionManagementService : ISubscriptionManagementService
{
    private readonly AppDbContext _context;
    private readonly ILogger<SubscriptionManagementService> _logger;

    public SubscriptionManagementService(
        AppDbContext context,
        ILogger<SubscriptionManagementService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc />
    public async Task<SubscriptionUpdateResult> UpdateSubscriptionAsync(
        Guid employeeId,
        UpdateSubscriptionRequest request,
        Guid companyId,
        CancellationToken cancellationToken = default)
    {
        var employee = await _context.Employees
            .FirstOrDefaultAsync(e => e.Id == employeeId && e.CompanyId == companyId, cancellationToken)
            ?? throw new KeyNotFoundException("Сотрудник не найден");

        // NOTE: Address cannot be changed - it comes from employee's project
        // To change address, employee must be moved to a different project

        if (!string.IsNullOrWhiteSpace(request.ComboType))
        {
            // CRITICAL FIX: Update BOTH active orders AND the subscription itself
            // Otherwise new auto-generated orders will use old combo type!
            
            // 1. Update active orders
            var updatedCount = await UpdateActiveOrdersComboTypeAsync(
                employeeId, request.ComboType, cancellationToken);

            // 2. Update the subscription too!
            var subscription = await _context.LunchSubscriptions
                .FirstOrDefaultAsync(s => s.EmployeeId == employeeId && s.IsActive, cancellationToken);
            
            if (subscription != null)
            {
                var newPrice = ComboPricingConstants.GetPrice(request.ComboType);
                
                subscription.ComboType = request.ComboType;
                
                // FIX: Пересчитываем TotalPrice на основе количества оставшихся заказов
                // Это более точно чем деление TotalPrice
                var futureOrdersCount = await _context.Orders
                    .CountAsync(o => o.EmployeeId == employeeId && 
                                    (o.Status == OrderStatus.Active || o.Status == OrderStatus.Frozen) &&
                                    o.OrderDate >= DateTime.UtcNow.Date, cancellationToken);
                
                if (futureOrdersCount > 0)
                {
                    subscription.TotalPrice = futureOrdersCount * newPrice;
                }
                subscription.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "Updated {Count} orders and subscription for employee {EmployeeId} with combo type {ComboType}",
                updatedCount, employeeId, request.ComboType);
        }

        return new SubscriptionUpdateResult("Подписка обновлена");
    }

    /// <inheritdoc />
    public async Task<BulkSubscriptionUpdateResult> BulkUpdateSubscriptionAsync(
        BulkUpdateSubscriptionRequest request,
        Guid companyId,
        CancellationToken cancellationToken = default)
    {
        var employees = await _context.Employees
            .Where(e => request.EmployeeIds.Contains(e.Id) && e.CompanyId == companyId)
            .ToListAsync(cancellationToken);

        var updated = 0;

        // NOTE: Address cannot be changed - it comes from employee's project
        // To change address, employee must be moved to a different project

        if (!string.IsNullOrWhiteSpace(request.ComboType))
        {
            // CRITICAL FIX: Update BOTH active orders AND subscriptions
            // Otherwise new auto-generated orders will use old combo type!
            
            var employeeIds = employees.Select(e => e.Id).ToList();
            
            // 1. Update all active orders for these employees
            var activeOrders = await _context.Orders
                .Where(o => employeeIds.Contains(o.EmployeeId!.Value) && o.Status == OrderStatus.Active)
                .ToListAsync(cancellationToken);

            foreach (var order in activeOrders)
            {
                order.ComboType = request.ComboType;
                order.Price = ComboPricingConstants.GetPrice(request.ComboType);
                order.UpdatedAt = DateTime.UtcNow;
            }

            // 2. Update all subscriptions for these employees
            var subscriptions = await _context.LunchSubscriptions
                .Where(s => employeeIds.Contains(s.EmployeeId) && s.IsActive)
                .ToListAsync(cancellationToken);

            var newPrice = ComboPricingConstants.GetPrice(request.ComboType);
            
            foreach (var subscription in subscriptions)
            {
                subscription.ComboType = request.ComboType;
                
                // FIX: Пересчитываем TotalPrice на основе количества оставшихся заказов
                var futureOrdersCount = await _context.Orders
                    .CountAsync(o => o.EmployeeId == subscription.EmployeeId && 
                                    (o.Status == OrderStatus.Active || o.Status == OrderStatus.Frozen) &&
                                    o.OrderDate >= DateTime.UtcNow.Date, cancellationToken);
                
                if (futureOrdersCount > 0)
                {
                    subscription.TotalPrice = futureOrdersCount * newPrice;
                }
                subscription.UpdatedAt = DateTime.UtcNow;
            }

            updated = employees.Count;
        }

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Bulk updated subscriptions for {Count} employees",
            updated);

        return new BulkSubscriptionUpdateResult(
            $"Обновлено {updated} подписок",
            updated
        );
    }

    private async Task<int> UpdateActiveOrdersComboTypeAsync(
        Guid employeeId,
        string comboType,
        CancellationToken cancellationToken)
    {
        var activeOrders = await _context.Orders
            .Where(o => o.EmployeeId == employeeId && o.Status == OrderStatus.Active)
            .ToListAsync(cancellationToken);

        foreach (var order in activeOrders)
        {
            order.ComboType = comboType;
            order.Price = ComboPricingConstants.GetPrice(comboType);
            order.UpdatedAt = DateTime.UtcNow;
        }

        return activeOrders.Count;
    }
}

