using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Dashboard;
using YallaBusinessAdmin.Application.Dashboard.Dtos;
using YallaBusinessAdmin.Application.Export;
using YallaBusinessAdmin.Infrastructure.Services.Dashboard;

namespace YallaBusinessAdmin.Api.Controllers;

/// <summary>
/// Dashboard API controller for order management and company metrics.
/// Handles: guest orders, meal assignments, bulk actions, cutoff time settings.
/// All exceptions are handled by the global exception handler middleware.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/home")]
[Route("api/home")] // Backwards compatibility
[Authorize]
public class DashboardController : BaseApiController
{
    private readonly IDashboardService _dashboardService;
    private readonly IExportService _exportService;

    /// <summary>
    /// Initializes a new instance of the DashboardController.
    /// </summary>
    /// <param name="dashboardService">The dashboard service.</param>
    /// <param name="exportService">The export service.</param>
    public DashboardController(IDashboardService dashboardService, IExportService exportService)
    {
        _dashboardService = dashboardService ?? throw new ArgumentNullException(nameof(dashboardService));
        _exportService = exportService ?? throw new ArgumentNullException(nameof(exportService));
    }

    /// <summary>
    /// Gets dashboard metrics including budget, orders, and statistics.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Dashboard response with metrics.</returns>
    /// <response code="200">Returns dashboard metrics.</response>
    /// <response code="401">Unauthorized - invalid or missing token.</response>
    /// <response code="404">Company not found.</response>
    [HttpGet("dashboard")]
    [ProducesResponseType(typeof(DashboardResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DashboardResponse>> GetDashboard(CancellationToken cancellationToken)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var projectId = GetProjectId();
        var result = await _dashboardService.GetDashboardAsync(companyId!.Value, projectId, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Gets paginated list of orders with filtering options.
    /// </summary>
    /// <param name="page">Page number (1-based).</param>
    /// <param name="pageSize">Items per page.</param>
    /// <param name="search">Search term for employee/guest name.</param>
    /// <param name="status">Status filter (Активен, Приостановлен, Заморожен, Отменён, Доставлен).</param>
    /// <param name="date">Date filter (yyyy-MM-dd format).</param>
    /// <param name="address">Address/project filter (project ID).</param>
    /// <param name="type">Type filter: "employee" or "guest".</param>
    /// <param name="serviceType">Service type filter: "LUNCH" or "COMPENSATION".</param>
    /// <param name="comboType">Combo type filter: "Комбо 25" or "Комбо 35".</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Paged result of orders.</returns>
    [HttpGet("orders")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult> GetOrders(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? date = null,
        [FromQuery] string? address = null,
        [FromQuery] string? type = null,
        [FromQuery] string? serviceType = null,
        [FromQuery] string? comboType = null,
        CancellationToken cancellationToken = default)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var projectId = GetProjectId();
        var result = await _dashboardService.GetOrdersAsync(
            companyId!.Value, page, pageSize, search, status, date, address, type, serviceType, comboType, projectId, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Creates guest orders.
    /// Validates cutoff time and budget before creation.
    /// </summary>
    /// <param name="request">Guest order request with quantity and combo type.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Response with created orders and budget status.</returns>
    /// <response code="201">Orders created successfully.</response>
    /// <response code="400">Validation error (insufficient budget, cutoff passed).</response>
    /// <response code="401">Unauthorized.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost("guest-orders")]
    [ProducesResponseType(typeof(CreateGuestOrderResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CreateGuestOrderResponse>> CreateGuestOrder(
        [FromBody] CreateGuestOrderRequest request,
        CancellationToken cancellationToken)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var projectId = GetProjectId();
        var result = await _dashboardService.CreateGuestOrderAsync(request, companyId!.Value, projectId, cancellationToken);
        return Created("/api/home/orders", result);
    }

    /// <summary>
    /// Assigns meals to multiple employees.
    /// Validates employee status, budget, and existing orders.
    /// </summary>
    /// <param name="request">Meal assignment request with employee IDs and combo type.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Assignment result with created count and skipped employees.</returns>
    [HttpPost("assign-meals")]
    [ProducesResponseType(typeof(MealAssignmentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MealAssignmentResult>> AssignMeals(
        [FromBody] AssignMealsRequest request,
        CancellationToken cancellationToken)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var result = await _dashboardService.AssignMealsAsync(request, companyId!.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Performs bulk actions on orders.
    /// Supported actions: pause, resume, changecombo, cancel.
    /// </summary>
    /// <param name="request">Bulk action request with order IDs and action type.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Bulk action result with updated count and refunded amount.</returns>
    [HttpPost("bulk-action")]
    [ProducesResponseType(typeof(BulkActionResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<BulkActionResult>> BulkAction(
        [FromBody] BulkActionRequest request,
        CancellationToken cancellationToken)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var result = await _dashboardService.BulkActionAsync(request, companyId!.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Updates subscription settings for an employee.
    /// </summary>
    /// <param name="employeeId">Employee ID.</param>
    /// <param name="request">Subscription update request.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Update result.</returns>
    [HttpPut("subscriptions/{employeeId:guid}")]
    [ProducesResponseType(typeof(SubscriptionUpdateResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SubscriptionUpdateResult>> UpdateSubscription(
        Guid employeeId,
        [FromBody] UpdateSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var result = await _dashboardService.UpdateSubscriptionAsync(employeeId, request, companyId!.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Bulk updates subscription settings for multiple employees.
    /// </summary>
    /// <param name="request">Bulk subscription update request.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Bulk update result.</returns>
    [HttpPost("subscriptions/bulk")]
    [ProducesResponseType(typeof(BulkSubscriptionUpdateResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<BulkSubscriptionUpdateResult>> BulkUpdateSubscription(
        [FromBody] BulkUpdateSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var result = await _dashboardService.BulkUpdateSubscriptionAsync(request, companyId!.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Gets the current cutoff time for the company.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Cutoff time information.</returns>
    [HttpGet("cutoff-time")]
    [ProducesResponseType(typeof(CutoffTimeInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CutoffTimeInfo>> GetCutoffTime(CancellationToken cancellationToken)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var result = await _dashboardService.GetCutoffTimeAsync(companyId!.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Updates the cutoff time for the company.
    /// </summary>
    /// <param name="request">Cutoff time update request (time in HH:mm format).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Updated cutoff time information.</returns>
    [HttpPut("cutoff-time")]
    [ProducesResponseType(typeof(CutoffTimeInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CutoffTimeInfo>> UpdateCutoffTime(
        [FromBody] UpdateCutoffTimeRequest request,
        CancellationToken cancellationToken)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var result = await _dashboardService.UpdateCutoffTimeAsync(companyId!.Value, request.Time, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Gets available combo types with prices.
    /// </summary>
    /// <returns>List of combo types with prices.</returns>
    [HttpGet("combos")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult GetCombos()
    {
        var combos = ComboPricingConstants.ComboPrices
            .Select(kvp => new { type = kvp.Key, price = kvp.Value })
            .ToArray();
        return Ok(combos);
    }

    /// <summary>
    /// Exports orders to CSV format.
    /// </summary>
    /// <param name="status">Optional status filter.</param>
    /// <param name="date">Optional date filter (yyyy-MM-dd).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>CSV file with orders data.</returns>
    [HttpGet("orders/export")]
    [ProducesResponseType(typeof(FileResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult> ExportOrders(
        [FromQuery] string? status = null,
        [FromQuery] string? date = null,
        CancellationToken cancellationToken = default)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var csvBytes = await _exportService.ExportOrdersToCsvAsync(companyId!.Value, status, date, cancellationToken);
        var fileName = $"orders_{DateTime.UtcNow:yyyy-MM-dd}.csv";

        return File(csvBytes, "text/csv; charset=utf-8", fileName);
    }
}
