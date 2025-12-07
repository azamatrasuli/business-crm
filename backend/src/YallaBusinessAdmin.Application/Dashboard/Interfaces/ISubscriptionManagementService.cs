using YallaBusinessAdmin.Application.Dashboard.Dtos;

namespace YallaBusinessAdmin.Application.Dashboard;

/// <summary>
/// Service for managing employee subscriptions.
/// </summary>
public interface ISubscriptionManagementService
{
    /// <summary>
    /// Updates subscription settings for an employee.
    /// </summary>
    /// <param name="employeeId">The employee identifier.</param>
    /// <param name="request">The update request.</param>
    /// <param name="companyId">The company identifier.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Update result.</returns>
    Task<SubscriptionUpdateResult> UpdateSubscriptionAsync(
        Guid employeeId,
        UpdateSubscriptionRequest request,
        Guid companyId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Bulk updates subscription settings for multiple employees.
    /// </summary>
    /// <param name="request">The bulk update request.</param>
    /// <param name="companyId">The company identifier.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Bulk update result.</returns>
    Task<BulkSubscriptionUpdateResult> BulkUpdateSubscriptionAsync(
        BulkUpdateSubscriptionRequest request,
        Guid companyId,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Result of subscription update operation.
/// </summary>
public record SubscriptionUpdateResult(string Message);

/// <summary>
/// Result of bulk subscription update operation.
/// </summary>
public record BulkSubscriptionUpdateResult(string Message, int Updated);

