using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Employees;
using YallaBusinessAdmin.Application.Employees.Dtos;
using YallaBusinessAdmin.Application.Export;

namespace YallaBusinessAdmin.Api.Controllers;

/// <summary>
/// Employees management API controller.
/// All exceptions are handled by the global exception handler middleware.
/// Supports API versioning (v1).
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/employees")]
[Route("api/employees")] // Backwards compatibility
[Authorize]
public class EmployeesController : BaseApiController
{
    private readonly IEmployeesService _employeesService;
    private readonly IExportService _exportService;

    /// <summary>
    /// Initializes a new instance of the EmployeesController.
    /// </summary>
    /// <param name="employeesService">The employees service.</param>
    /// <param name="exportService">The export service.</param>
    public EmployeesController(IEmployeesService employeesService, IExportService exportService)
    {
        _employeesService = employeesService ?? throw new ArgumentNullException(nameof(employeesService));
        _exportService = exportService ?? throw new ArgumentNullException(nameof(exportService));
    }

    /// <summary>
    /// Gets all employees for the current company with filtering and pagination.
    /// </summary>
    /// <param name="page">Page number (1-based).</param>
    /// <param name="pageSize">Items per page.</param>
    /// <param name="search">Search term for name, phone, or email.</param>
    /// <param name="status">Status filter: "active" or "inactive".</param>
    /// <param name="inviteStatus">Invite status filter: "Принято", "Ожидает", "Отклонено".</param>
    /// <param name="orderStatus">Order status filter: "Заказан", "Не заказан".</param>
    /// <param name="sortBy">Sort field: "fullname", "phone", "email", "budget", "status".</param>
    /// <param name="sortDesc">Sort descending (default: true).</param>
    /// <param name="minBudget">Minimum budget filter.</param>
    /// <param name="maxBudget">Maximum budget filter.</param>
    /// <param name="hasSubscription">Subscription filter.</param>
    /// <param name="projectId">Project filter.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Paged result of employees.</returns>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
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
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var result = await _employeesService.GetAllAsync(
            page, pageSize, search, status, inviteStatus, orderStatus,
            companyId!.Value, sortBy, sortDesc, minBudget, maxBudget, hasSubscription, projectId, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Gets an employee by ID.
    /// </summary>
    /// <param name="id">Employee ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Employee details.</returns>
    /// <response code="200">Returns the employee.</response>
    /// <response code="401">Unauthorized.</response>
    /// <response code="404">Employee not found.</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(EmployeeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmployeeResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var result = await _employeesService.GetByIdAsync(id, companyId!.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Creates a new employee.
    /// </summary>
    /// <param name="request">Employee creation request.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Created employee.</returns>
    /// <response code="201">Employee created successfully.</response>
    /// <response code="400">Validation error.</response>
    /// <response code="401">Unauthorized.</response>
    /// <response code="409">Phone number already exists.</response>
    [HttpPost]
    [ProducesResponseType(typeof(EmployeeResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<EmployeeResponse>> Create(
        [FromBody] CreateEmployeeRequest request,
        CancellationToken cancellationToken)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var currentUserId = GetUserId();
        var result = await _employeesService.CreateAsync(request, companyId!.Value, currentUserId, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Updates an employee.
    /// </summary>
    /// <param name="id">Employee ID.</param>
    /// <param name="request">Employee update request.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Updated employee.</returns>
    /// <response code="200">Employee updated successfully.</response>
    /// <response code="400">Validation error.</response>
    /// <response code="401">Unauthorized.</response>
    /// <response code="404">Employee not found.</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(EmployeeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmployeeResponse>> Update(
        Guid id,
        [FromBody] UpdateEmployeeRequest request,
        CancellationToken cancellationToken)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var currentUserId = GetUserId();
        var result = await _employeesService.UpdateAsync(id, request, companyId!.Value, currentUserId, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Toggles employee activation status.
    /// </summary>
    /// <param name="id">Employee ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Updated employee with new activation status.</returns>
    /// <response code="200">Activation toggled successfully.</response>
    /// <response code="401">Unauthorized.</response>
    /// <response code="404">Employee not found.</response>
    [HttpPatch("{id:guid}/activate")]
    [ProducesResponseType(typeof(EmployeeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmployeeResponse>> ToggleActivation(Guid id, CancellationToken cancellationToken)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var currentUserId = GetUserId();
        var result = await _employeesService.ToggleActivationAsync(id, companyId!.Value, currentUserId, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Deletes an employee (soft delete).
    /// </summary>
    /// <param name="id">Employee ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>No content on success.</returns>
    /// <response code="204">Employee deleted successfully.</response>
    /// <response code="401">Unauthorized.</response>
    /// <response code="404">Employee not found.</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var currentUserId = GetUserId();
        await _employeesService.DeleteAsync(id, companyId!.Value, currentUserId, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Permanently deletes an employee and all related data from the database.
    /// WARNING: This action is irreversible! Use only for test/fake data cleanup.
    /// </summary>
    /// <param name="id">Employee ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>No content on success.</returns>
    /// <response code="204">Employee permanently deleted.</response>
    /// <response code="401">Unauthorized.</response>
    /// <response code="404">Employee not found.</response>
    [HttpDelete("{id:guid}/permanent")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> HardDelete(Guid id, CancellationToken cancellationToken)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var currentUserId = GetUserId();
        await _employeesService.HardDeleteAsync(id, companyId!.Value, currentUserId, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Updates employee budget.
    /// </summary>
    /// <param name="id">Employee ID.</param>
    /// <param name="request">Budget update request.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Success message.</returns>
    /// <response code="200">Budget updated successfully.</response>
    /// <response code="400">Validation error.</response>
    /// <response code="401">Unauthorized.</response>
    /// <response code="404">Employee not found.</response>
    [HttpPut("{id:guid}/budget")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> UpdateBudget(
        Guid id,
        [FromBody] UpdateBudgetRequest request,
        CancellationToken cancellationToken)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var currentUserId = GetUserId();
        await _employeesService.UpdateBudgetAsync(id, request, companyId!.Value, currentUserId, cancellationToken);
        return Ok(new { success = true, message = "Бюджет обновлен" });
    }

    /// <summary>
    /// Batch updates budget for multiple employees.
    /// </summary>
    /// <param name="request">Batch budget update request.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Success message with count.</returns>
    /// <response code="200">Budgets updated successfully.</response>
    /// <response code="400">Validation error.</response>
    /// <response code="401">Unauthorized.</response>
    [HttpPut("budget/batch")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult> BatchUpdateBudget(
        [FromBody] BatchUpdateBudgetRequest request,
        CancellationToken cancellationToken)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var currentUserId = GetUserId();
        await _employeesService.BatchUpdateBudgetAsync(request, companyId!.Value, currentUserId, cancellationToken);
        return Ok(new { success = true, message = "Бюджеты обновлены", count = request.EmployeeIds.Count() });
    }

    /// <summary>
    /// Gets employee order history.
    /// </summary>
    /// <param name="id">Employee ID.</param>
    /// <param name="page">Page number (1-based).</param>
    /// <param name="pageSize">Items per page.</param>
    /// <param name="dateFrom">Start date filter (yyyy-MM-dd).</param>
    /// <param name="dateTo">End date filter (yyyy-MM-dd).</param>
    /// <param name="status">Status filter.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Paged result of orders.</returns>
    [HttpGet("{id:guid}/orders")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> GetOrders(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? dateFrom = null,
        [FromQuery] string? dateTo = null,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var result = await _employeesService.GetEmployeeOrdersAsync(
            id, page, pageSize, companyId!.Value, dateFrom, dateTo, status, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Gets available invite statuses.
    /// </summary>
    /// <returns>List of invite statuses in Russian.</returns>
    [HttpGet("invite-statuses")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult<IEnumerable<string>> GetInviteStatuses()
    {
        var statuses = new[] { "Принято", "Ожидает", "Отклонено" };
        return Ok(statuses);
    }

    /// <summary>
    /// Exports employees to CSV format.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>CSV file with employees data.</returns>
    /// <response code="200">Returns CSV file.</response>
    /// <response code="401">Unauthorized.</response>
    [HttpGet("export")]
    [ProducesResponseType(typeof(FileResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult> Export(CancellationToken cancellationToken)
    {
        var (companyId, errorResult) = RequireCompanyId();
        if (errorResult != null) return errorResult;

        var csvBytes = await _exportService.ExportEmployeesToCsvAsync(companyId!.Value, cancellationToken);
        var fileName = $"employees_{DateTime.UtcNow:yyyy-MM-dd}.csv";

        return File(csvBytes, "text/csv; charset=utf-8", fileName);
    }
}
