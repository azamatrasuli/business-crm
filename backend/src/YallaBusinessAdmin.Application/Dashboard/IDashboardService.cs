using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Dashboard.Dtos;

namespace YallaBusinessAdmin.Application.Dashboard;

public interface IDashboardService
{
    Task<DashboardResponse> GetDashboardAsync(Guid companyId, Guid? projectId = null, CancellationToken cancellationToken = default);
    
    Task<PagedResult<OrderResponse>> GetOrdersAsync(
        Guid companyId,
        int page,
        int pageSize,
        string? search,
        string? statusFilter,
        string? dateFilter,
        string? addressFilter,
        string? typeFilter, // "employee" or "guest"
        Guid? projectId = null,
        CancellationToken cancellationToken = default);
    
    Task<CreateGuestOrderResponse> CreateGuestOrderAsync(CreateGuestOrderRequest request, Guid companyId, Guid? projectId = null, CancellationToken cancellationToken = default);
    Task<object> AssignMealsAsync(AssignMealsRequest request, Guid companyId, CancellationToken cancellationToken = default);
    Task<object> BulkActionAsync(BulkActionRequest request, Guid companyId, CancellationToken cancellationToken = default);
    Task<object> UpdateSubscriptionAsync(Guid employeeId, UpdateSubscriptionRequest request, Guid companyId, CancellationToken cancellationToken = default);
    Task<object> BulkUpdateSubscriptionAsync(BulkUpdateSubscriptionRequest request, Guid companyId, CancellationToken cancellationToken = default);
    Task<object> GetCutoffTimeAsync(Guid companyId, CancellationToken cancellationToken = default);
    Task<object> UpdateCutoffTimeAsync(Guid companyId, string time, CancellationToken cancellationToken = default);
}
