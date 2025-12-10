using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Dashboard;
using YallaBusinessAdmin.Application.Dashboard.Dtos;

namespace YallaBusinessAdmin.Infrastructure.Services;

/// <summary>
/// Facade service for dashboard operations.
/// Delegates to specialized services for specific functionality.
/// </summary>
/// <remarks>
/// This class implements the Facade pattern, composing multiple specialized services:
/// - IDashboardMetricsService: Metrics and statistics
/// - IOrderManagementService: Order CRUD operations
/// - ISubscriptionManagementService: Subscription management
/// - ICutoffTimeService: Cutoff time settings
/// </remarks>
public sealed class DashboardService : IDashboardService
{
    private readonly IDashboardMetricsService _metricsService;
    private readonly IOrderManagementService _orderService;
    private readonly ISubscriptionManagementService _subscriptionService;
    private readonly ICutoffTimeService _cutoffService;

    /// <summary>
    /// Initializes a new instance of the DashboardService facade.
    /// </summary>
    public DashboardService(
        IDashboardMetricsService metricsService,
        IOrderManagementService orderService,
        ISubscriptionManagementService subscriptionService,
        ICutoffTimeService cutoffService)
    {
        _metricsService = metricsService ?? throw new ArgumentNullException(nameof(metricsService));
        _orderService = orderService ?? throw new ArgumentNullException(nameof(orderService));
        _subscriptionService = subscriptionService ?? throw new ArgumentNullException(nameof(subscriptionService));
        _cutoffService = cutoffService ?? throw new ArgumentNullException(nameof(cutoffService));
    }

    #region IDashboardMetricsService

    /// <inheritdoc />
    public Task<DashboardResponse> GetDashboardAsync(
        Guid companyId,
        Guid? projectId = null,
        DateOnly? filterDate = null,
        CancellationToken cancellationToken = default)
    {
        return _metricsService.GetDashboardAsync(companyId, projectId, filterDate, cancellationToken);
    }

    #endregion

    #region IOrderManagementService

    /// <inheritdoc />
    public Task<PagedResult<OrderResponse>> GetOrdersAsync(
        Guid companyId,
        int page,
        int pageSize,
        string? search,
        string? statusFilter,
        string? dateFilter,
        string? addressFilter,
        string? typeFilter,
        string? serviceTypeFilter = null,
        string? comboTypeFilter = null,
        Guid? projectId = null,
        CancellationToken cancellationToken = default)
    {
        return _orderService.GetOrdersAsync(
            companyId, page, pageSize, search, statusFilter, dateFilter, addressFilter, typeFilter,
            serviceTypeFilter, comboTypeFilter, projectId, cancellationToken);
    }

    /// <inheritdoc />
    public Task<CreateGuestOrderResponse> CreateGuestOrderAsync(
        CreateGuestOrderRequest request,
        Guid companyId,
        Guid? projectId = null,
        CancellationToken cancellationToken = default)
    {
        return _orderService.CreateGuestOrderAsync(request, companyId, projectId, cancellationToken);
    }

    /// <inheritdoc />
    public Task<MealAssignmentResult> AssignMealsAsync(
        AssignMealsRequest request,
        Guid companyId,
        CancellationToken cancellationToken = default)
    {
        return _orderService.AssignMealsAsync(request, companyId, cancellationToken);
    }

    /// <inheritdoc />
    public Task<BulkActionResult> BulkActionAsync(
        BulkActionRequest request,
        Guid companyId,
        CancellationToken cancellationToken = default)
    {
        return _orderService.BulkActionAsync(request, companyId, cancellationToken);
    }

    #endregion

    #region ISubscriptionManagementService

    /// <inheritdoc />
    public Task<SubscriptionUpdateResult> UpdateSubscriptionAsync(
        Guid employeeId,
        UpdateSubscriptionRequest request,
        Guid companyId,
        CancellationToken cancellationToken = default)
    {
        return _subscriptionService.UpdateSubscriptionAsync(employeeId, request, companyId, cancellationToken);
    }

    /// <inheritdoc />
    public Task<BulkSubscriptionUpdateResult> BulkUpdateSubscriptionAsync(
        BulkUpdateSubscriptionRequest request,
        Guid companyId,
        CancellationToken cancellationToken = default)
    {
        return _subscriptionService.BulkUpdateSubscriptionAsync(request, companyId, cancellationToken);
    }

    #endregion

    #region ICutoffTimeService

    /// <inheritdoc />
    public Task<CutoffTimeInfo> GetCutoffTimeAsync(
        Guid companyId,
        CancellationToken cancellationToken = default)
    {
        return _cutoffService.GetCutoffTimeAsync(companyId, cancellationToken);
    }

    /// <inheritdoc />
    public Task<CutoffTimeInfo> UpdateCutoffTimeAsync(
        Guid companyId,
        string time,
        CancellationToken cancellationToken = default)
    {
        return _cutoffService.UpdateCutoffTimeAsync(companyId, time, cancellationToken);
    }

    #endregion
}
