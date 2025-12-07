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
            var updatedCount = await UpdateActiveOrdersComboTypeAsync(
                employeeId, request.ComboType, cancellationToken);

            _logger.LogInformation(
                "Updated {Count} orders for employee {EmployeeId} with combo type {ComboType}",
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

        foreach (var employee in employees)
        {
            if (!string.IsNullOrWhiteSpace(request.ComboType))
            {
                await UpdateActiveOrdersComboTypeAsync(
                    employee.Id, request.ComboType, cancellationToken);
            }

            updated++;
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

