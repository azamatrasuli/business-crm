using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Compensation;
using YallaBusinessAdmin.Application.Compensation.Dtos;

namespace YallaBusinessAdmin.Api.Controllers;

[ApiController]
[Route("api/compensation")]
[Authorize]
public class CompensationController : ControllerBase
{
    private readonly ICompensationService _compensationService;

    public CompensationController(ICompensationService compensationService)
    {
        _compensationService = compensationService;
    }

    /// <summary>Get compensation settings for a project</summary>
    [HttpGet("projects/{projectId}/settings")]
    public async Task<ActionResult<CompensationSettingsResponse>> GetSettings(
        Guid projectId, 
        CancellationToken cancellationToken)
    {
        try
        {
            var settings = await _compensationService.GetSettingsAsync(projectId, cancellationToken);
            return Ok(settings);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>Update compensation settings for a project</summary>
    [HttpPut("projects/{projectId}/settings")]
    public async Task<ActionResult<CompensationSettingsResponse>> UpdateSettings(
        Guid projectId, 
        [FromBody] UpdateCompensationSettingsRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var settings = await _compensationService.UpdateSettingsAsync(projectId, request, cancellationToken);
            return Ok(settings);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>Get employee's current compensation balance</summary>
    [HttpGet("employees/{employeeId}/balance")]
    public async Task<ActionResult<EmployeeCompensationResponse>> GetEmployeeBalance(
        Guid employeeId,
        CancellationToken cancellationToken)
    {
        try
        {
            var balance = await _compensationService.GetEmployeeBalanceAsync(employeeId, cancellationToken);
            return Ok(balance);
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

    /// <summary>Process a compensation transaction (when employee pays at restaurant)</summary>
    [HttpPost("transactions")]
    public async Task<ActionResult<CompensationTransactionResponse>> ProcessTransaction(
        [FromBody] CreateCompensationTransactionRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var transaction = await _compensationService.ProcessTransactionAsync(request, cancellationToken);
            return Ok(transaction);
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

    /// <summary>Get compensation transactions for an employee</summary>
    [HttpGet("employees/{employeeId}/transactions")]
    public async Task<ActionResult<IEnumerable<CompensationTransactionResponse>>> GetTransactions(
        Guid employeeId,
        [FromQuery] string? fromDate = null,
        [FromQuery] string? toDate = null,
        CancellationToken cancellationToken = default)
    {
        DateOnly? from = null;
        DateOnly? to = null;

        if (!string.IsNullOrEmpty(fromDate) && DateOnly.TryParse(fromDate, out var parsedFrom))
            from = parsedFrom;
        if (!string.IsNullOrEmpty(toDate) && DateOnly.TryParse(toDate, out var parsedTo))
            to = parsedTo;

        var transactions = await _compensationService.GetTransactionsAsync(employeeId, from, to, cancellationToken);
        return Ok(transactions);
    }

    /// <summary>Get daily summary of compensations for a project</summary>
    [HttpGet("projects/{projectId}/daily-summary")]
    public async Task<ActionResult<DailyCompensationSummary>> GetDailySummary(
        Guid projectId,
        [FromQuery] string? date = null,
        CancellationToken cancellationToken = default)
    {
        var targetDate = DateOnly.FromDateTime(DateTime.UtcNow);
        if (!string.IsNullOrEmpty(date) && DateOnly.TryParse(date, out var parsedDate))
            targetDate = parsedDate;

        try
        {
            var summary = await _compensationService.GetDailySummaryAsync(projectId, targetDate, cancellationToken);
            return Ok(summary);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}










