using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Employees;
using YallaBusinessAdmin.Application.Employees.Dtos;
using YallaBusinessAdmin.Application.Export;

namespace YallaBusinessAdmin.Api.Controllers;

[ApiController]
[Route("api/employees")]
[Authorize]
public class EmployeesController : ControllerBase
{
    private readonly IEmployeesService _employeesService;
    private readonly IExportService _exportService;

    public EmployeesController(IEmployeesService employeesService, IExportService exportService)
    {
        _employeesService = employeesService;
        _exportService = exportService;
    }

    /// <summary>
    /// Get all employees for current company with search and filters
    /// </summary>
    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? inviteStatus = null,
        [FromQuery] string? orderStatus = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool sortDesc = true,
        [FromQuery] decimal? minBudget = null,
        [FromQuery] decimal? maxBudget = null,
        [FromQuery] bool? hasSubscription = null,
        [FromQuery] Guid? projectId = null,
        CancellationToken cancellationToken = default)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        var result = await _employeesService.GetAllAsync(
            page, pageSize, search, status, inviteStatus, orderStatus,
            companyId.Value, sortBy, sortDesc, minBudget, maxBudget, hasSubscription, projectId, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Get employee by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<EmployeeResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        try
        {
            var result = await _employeesService.GetByIdAsync(id, companyId.Value, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Create a new employee
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<EmployeeResponse>> Create([FromBody] CreateEmployeeRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        var currentUserId = GetUserId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        try
        {
            var result = await _employeesService.CreateAsync(request, companyId.Value, currentUserId, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Update employee
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<EmployeeResponse>> Update(Guid id, [FromBody] UpdateEmployeeRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        var currentUserId = GetUserId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        try
        {
            var result = await _employeesService.UpdateAsync(id, request, companyId.Value, currentUserId, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Toggle employee activation status
    /// </summary>
    [HttpPatch("{id:guid}/activate")]
    public async Task<ActionResult<EmployeeResponse>> ToggleActivation(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        var currentUserId = GetUserId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        try
        {
            var result = await _employeesService.ToggleActivationAsync(id, companyId.Value, currentUserId, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Delete employee (soft delete)
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        var currentUserId = GetUserId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        try
        {
            await _employeesService.DeleteAsync(id, companyId.Value, currentUserId, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Update employee budget
    /// </summary>
    [HttpPut("{id:guid}/budget")]
    public async Task<ActionResult> UpdateBudget(Guid id, [FromBody] UpdateBudgetRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        var currentUserId = GetUserId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        try
        {
            await _employeesService.UpdateBudgetAsync(id, request, companyId.Value, currentUserId, cancellationToken);
            return Ok(new { message = "Бюджет обновлен" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Batch update budget for multiple employees
    /// </summary>
    [HttpPut("budget/batch")]
    public async Task<ActionResult> BatchUpdateBudget([FromBody] BatchUpdateBudgetRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        var currentUserId = GetUserId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        try
        {
            await _employeesService.BatchUpdateBudgetAsync(request, companyId.Value, currentUserId, cancellationToken);
            return Ok(new { message = "Бюджеты обновлены", count = request.EmployeeIds.Count() });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Get employee order history
    /// </summary>
    [HttpGet("{id:guid}/orders")]
    public async Task<ActionResult> GetOrders(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? dateFrom = null,
        [FromQuery] string? dateTo = null,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        try
        {
            var result = await _employeesService.GetEmployeeOrdersAsync(
                id, page, pageSize, companyId.Value, dateFrom, dateTo, status, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Get available invite statuses
    /// </summary>
    [HttpGet("invite-statuses")]
    public ActionResult<IEnumerable<string>> GetInviteStatuses()
    {
        var statuses = new[] { "Принято", "Ожидает", "Отклонено" };
        return Ok(statuses);
    }

    /// <summary>
    /// Export employees to CSV
    /// </summary>
    [HttpGet("export")]
    public async Task<ActionResult> Export(CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        var csvBytes = await _exportService.ExportEmployeesToCsvAsync(companyId.Value, cancellationToken);
        var fileName = $"employees_{DateTime.UtcNow:yyyy-MM-dd}.csv";
        
        return File(csvBytes, "text/csv; charset=utf-8", fileName);
    }

    private Guid? GetCompanyId()
    {
        var companyIdClaim = User.FindFirst("company_id") ?? User.FindFirst("companyId");
        if (companyIdClaim != null && Guid.TryParse(companyIdClaim.Value, out var companyId))
        {
            return companyId;
        }
        return null;
    }

    private Guid? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst(JwtRegisteredClaimNames.Sub);
        if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return userId;
        }
        return null;
    }
}
