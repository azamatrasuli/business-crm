using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Dashboard.Dtos;

namespace YallaBusinessAdmin.Application.Dashboard;

/// <summary>
/// Service for managing orders (listing, creating, updating).
/// </summary>
public interface IOrderManagementService
{
    /// <summary>
    /// Gets paginated orders with filtering.
    /// </summary>
    /// <param name="companyId">The company identifier.</param>
    /// <param name="page">Page number (1-based).</param>
    /// <param name="pageSize">Items per page.</param>
    /// <param name="search">Optional search term for employee/guest name.</param>
    /// <param name="statusFilter">Optional status filter.</param>
    /// <param name="dateFilter">Optional date filter (yyyy-MM-dd format).</param>
    /// <param name="addressFilter">Optional address/project filter.</param>
    /// <param name="typeFilter">Optional type filter (guest/employee).</param>
    /// <param name="projectId">Optional project identifier.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Paged result of orders.</returns>
    Task<PagedResult<OrderResponse>> GetOrdersAsync(
        Guid companyId,
        int page,
        int pageSize,
        string? search,
        string? statusFilter,
        string? dateFilter,
        string? addressFilter,
        string? typeFilter,
        Guid? projectId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a guest order.
    /// </summary>
    /// <param name="request">The guest order request.</param>
    /// <param name="companyId">The company identifier.</param>
    /// <param name="projectId">Optional project identifier.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Response with created orders.</returns>
    Task<CreateGuestOrderResponse> CreateGuestOrderAsync(
        CreateGuestOrderRequest request,
        Guid companyId,
        Guid? projectId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Assigns meals to employees.
    /// </summary>
    /// <param name="request">The meal assignment request.</param>
    /// <param name="companyId">The company identifier.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Assignment result.</returns>
    Task<MealAssignmentResult> AssignMealsAsync(
        AssignMealsRequest request,
        Guid companyId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Performs bulk actions on orders (pause, resume, cancel, change combo).
    /// </summary>
    /// <param name="request">The bulk action request.</param>
    /// <param name="companyId">The company identifier.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Bulk action result.</returns>
    Task<BulkActionResult> BulkActionAsync(
        BulkActionRequest request,
        Guid companyId,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Result of meal assignment operation.
/// </summary>
public record MealAssignmentResult(
    string Message,
    int Created,
    IReadOnlyList<string> Skipped);

/// <summary>
/// Result of bulk action operation.
/// </summary>
public record BulkActionResult(
    string Message,
    int Updated,
    decimal RefundedAmount,
    IReadOnlyList<string> Skipped);

