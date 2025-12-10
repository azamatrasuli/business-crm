using YallaBusinessAdmin.Application.Dashboard.Dtos;

namespace YallaBusinessAdmin.Application.Dashboard;

/// <summary>
/// Service for retrieving dashboard metrics and statistics.
/// </summary>
public interface IDashboardMetricsService
{
    /// <summary>
    /// Gets dashboard metrics for a company.
    /// </summary>
    /// <param name="companyId">The company identifier.</param>
    /// <param name="projectId">Optional project identifier to filter metrics.</param>
    /// <param name="filterDate">Optional date to filter statistics. If provided, only orders for this date are counted.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Dashboard response with metrics.</returns>
    Task<DashboardResponse> GetDashboardAsync(
        Guid companyId,
        Guid? projectId = null,
        DateOnly? filterDate = null,
        CancellationToken cancellationToken = default);
}

