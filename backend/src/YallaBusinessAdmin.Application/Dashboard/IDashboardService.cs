using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Dashboard.Dtos;

namespace YallaBusinessAdmin.Application.Dashboard;

/// <summary>
/// Facade service for dashboard operations.
/// Composes IDashboardMetricsService, IOrderManagementService, ISubscriptionManagementService, and ICutoffTimeService.
/// This interface is kept for backwards compatibility - prefer using the specialized interfaces for new code.
/// </summary>
public interface IDashboardService :
    IDashboardMetricsService,
    IOrderManagementService,
    ISubscriptionManagementService,
    ICutoffTimeService
{
    // All methods are inherited from composed interfaces.
    // This pattern follows Interface Segregation Principle (ISP) while maintaining backwards compatibility.
}
