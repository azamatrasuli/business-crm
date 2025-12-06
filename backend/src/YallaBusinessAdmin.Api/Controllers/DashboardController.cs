using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Dashboard;
using YallaBusinessAdmin.Application.Dashboard.Dtos;
using YallaBusinessAdmin.Application.Export;

namespace YallaBusinessAdmin.Api.Controllers;

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

    /// <summary>
    /// Get dashboard summary
    /// </summary>
    [HttpGet("dashboard")]
    public async Task<ActionResult<DashboardResponse>> GetDashboard(CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        var projectId = GetProjectId();
        var result = await _dashboardService.GetDashboardAsync(companyId.Value, projectId, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Get orders with filtering
    /// </summary>
    [HttpGet("orders")]
    public async Task<ActionResult> GetOrders(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? date = null,
        [FromQuery] string? address = null,
        [FromQuery] string? type = null, // "employee" or "guest"
        CancellationToken cancellationToken = default)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        var projectId = GetProjectId();
        var result = await _dashboardService.GetOrdersAsync(
            companyId.Value, page, pageSize, search, status, date, address, type, projectId, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Create guest orders
    /// </summary>
    [HttpPost("guest-orders")]
    public async Task<ActionResult<CreateGuestOrderResponse>> CreateGuestOrder([FromBody] CreateGuestOrderRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        try
        {
            var projectId = GetProjectId();
            var result = await _dashboardService.CreateGuestOrderAsync(request, companyId.Value, projectId, cancellationToken);
            return Created("/api/dashboard/orders", result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Assign meals to employees
    /// </summary>
    [HttpPost("assign-meals")]
    public async Task<ActionResult> AssignMeals([FromBody] AssignMealsRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        try
        {
            var result = await _dashboardService.AssignMealsAsync(request, companyId.Value, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Bulk action on orders (pause, resume, changeAddress)
    /// </summary>
    [HttpPost("bulk-action")]
    public async Task<ActionResult> BulkAction([FromBody] BulkActionRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        var result = await _dashboardService.BulkActionAsync(request, companyId.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Update employee subscription
    /// </summary>
    [HttpPut("subscriptions/{employeeId:guid}")]
    public async Task<ActionResult> UpdateSubscription(Guid employeeId, [FromBody] UpdateSubscriptionRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        try
        {
            var result = await _dashboardService.UpdateSubscriptionAsync(employeeId, request, companyId.Value, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Bulk update employee subscriptions
    /// </summary>
    [HttpPost("subscriptions/bulk")]
    public async Task<ActionResult> BulkUpdateSubscription([FromBody] BulkUpdateSubscriptionRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        var result = await _dashboardService.BulkUpdateSubscriptionAsync(request, companyId.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Get cutoff time for the company
    /// </summary>
    [HttpGet("cutoff-time")]
    public async Task<ActionResult> GetCutoffTime(CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        try
        {
            var result = await _dashboardService.GetCutoffTimeAsync(companyId.Value, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Update cutoff time for the company
    /// </summary>
    [HttpPut("cutoff-time")]
    public async Task<ActionResult> UpdateCutoffTime([FromBody] UpdateCutoffTimeRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        try
        {
            var result = await _dashboardService.UpdateCutoffTimeAsync(companyId.Value, request.Time, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Get combo types
    /// </summary>
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

    /// <summary>
    /// Export orders to CSV
    /// </summary>
    [HttpGet("orders/export")]
    public async Task<ActionResult> ExportOrders(
        [FromQuery] string? status = null,
        [FromQuery] string? date = null,
        CancellationToken cancellationToken = default)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        var csvBytes = await _exportService.ExportOrdersToCsvAsync(companyId.Value, status, date, cancellationToken);
        var fileName = $"orders_{DateTime.UtcNow:yyyy-MM-dd}.csv";
        
        return File(csvBytes, "text/csv; charset=utf-8", fileName);
    }

}
