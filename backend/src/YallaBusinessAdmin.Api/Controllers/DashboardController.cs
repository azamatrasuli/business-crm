using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Dashboard;
using YallaBusinessAdmin.Application.Dashboard.Dtos;
using YallaBusinessAdmin.Application.Export;

namespace YallaBusinessAdmin.Api.Controllers;

/// <summary>
/// Dashboard - all exceptions handled by global exception handler
/// Critical for: guest orders, meal assignments, freeze/unfreeze, cutoff time
/// </summary>
[ApiController]
[Route("api/home")]
[Authorize]
public class DashboardController : BaseApiController
{
    private readonly IDashboardService _dashboardService;
    private readonly IExportService _exportService;

    public DashboardController(IDashboardService dashboardService, IExportService exportService)
    {
        _dashboardService = dashboardService;
        _exportService = exportService;
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<DashboardResponse>> GetDashboard(CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var projectId = GetProjectId();
        var result = await _dashboardService.GetDashboardAsync(companyId.Value, projectId, cancellationToken);
        return Ok(result);
    }

    [HttpGet("orders")]
    public async Task<ActionResult> GetOrders(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? date = null,
        [FromQuery] string? address = null,
        [FromQuery] string? type = null,
        CancellationToken cancellationToken = default)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var projectId = GetProjectId();
        var result = await _dashboardService.GetOrdersAsync(
            companyId.Value, page, pageSize, search, status, date, address, type, projectId, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Create guest orders - validates cutoff time, budget
    /// </summary>
    [HttpPost("guest-orders")]
    public async Task<ActionResult<CreateGuestOrderResponse>> CreateGuestOrder([FromBody] CreateGuestOrderRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var projectId = GetProjectId();
        var result = await _dashboardService.CreateGuestOrderAsync(request, companyId.Value, projectId, cancellationToken);
        return Created("/api/home/orders", result);
    }

    /// <summary>
    /// Assign meals to employees - validates employees exist, budget
    /// </summary>
    [HttpPost("assign-meals")]
    public async Task<ActionResult> AssignMeals([FromBody] AssignMealsRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _dashboardService.AssignMealsAsync(request, companyId.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Bulk action on orders (pause, resume, changeAddress)
    /// </summary>
    [HttpPost("bulk-action")]
    public async Task<ActionResult> BulkAction([FromBody] BulkActionRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _dashboardService.BulkActionAsync(request, companyId.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Update employee subscription - validates employee exists
    /// </summary>
    [HttpPut("subscriptions/{employeeId:guid}")]
    public async Task<ActionResult> UpdateSubscription(Guid employeeId, [FromBody] UpdateSubscriptionRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _dashboardService.UpdateSubscriptionAsync(employeeId, request, companyId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpPost("subscriptions/bulk")]
    public async Task<ActionResult> BulkUpdateSubscription([FromBody] BulkUpdateSubscriptionRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _dashboardService.BulkUpdateSubscriptionAsync(request, companyId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpGet("cutoff-time")]
    public async Task<ActionResult> GetCutoffTime(CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _dashboardService.GetCutoffTimeAsync(companyId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpPut("cutoff-time")]
    public async Task<ActionResult> UpdateCutoffTime([FromBody] UpdateCutoffTimeRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _dashboardService.UpdateCutoffTimeAsync(companyId.Value, request.Time, cancellationToken);
        return Ok(result);
    }

    [HttpGet("combos")]
    public ActionResult GetCombos()
    {
        var combos = new[]
        {
            new { type = "Комбо 25", price = 25.00m },
            new { type = "Комбо 35", price = 35.00m }
        };
        return Ok(combos);
    }

    [HttpGet("orders/export")]
    public async Task<ActionResult> ExportOrders(
        [FromQuery] string? status = null,
        [FromQuery] string? date = null,
        CancellationToken cancellationToken = default)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var csvBytes = await _exportService.ExportOrdersToCsvAsync(companyId.Value, status, date, cancellationToken);
        var fileName = $"orders_{DateTime.UtcNow:yyyy-MM-dd}.csv";
        
        return File(csvBytes, "text/csv; charset=utf-8", fileName);
    }
}
