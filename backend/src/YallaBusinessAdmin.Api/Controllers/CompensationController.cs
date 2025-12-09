using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Compensation;
using YallaBusinessAdmin.Application.Compensation.Dtos;
using YallaBusinessAdmin.Infrastructure.Services.Dashboard;

namespace YallaBusinessAdmin.Api.Controllers;

/// <summary>
/// Compensation (Phase 2) - all exceptions handled by global exception handler
/// </summary>
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

    [HttpGet("projects/{projectId}/settings")]
    public async Task<ActionResult<CompensationSettingsResponse>> GetSettings(
        Guid projectId, 
        CancellationToken cancellationToken)
    {
        var settings = await _compensationService.GetSettingsAsync(projectId, cancellationToken);
        return Ok(settings);
    }

    [HttpPut("projects/{projectId}/settings")]
    public async Task<ActionResult<CompensationSettingsResponse>> UpdateSettings(
        Guid projectId, 
        [FromBody] UpdateCompensationSettingsRequest request,
        CancellationToken cancellationToken)
    {
        var settings = await _compensationService.UpdateSettingsAsync(projectId, request, cancellationToken);
        return Ok(settings);
    }

    [HttpGet("employees/{employeeId}/balance")]
    public async Task<ActionResult<EmployeeCompensationResponse>> GetEmployeeBalance(
        Guid employeeId,
        CancellationToken cancellationToken)
    {
        var balance = await _compensationService.GetEmployeeBalanceAsync(employeeId, cancellationToken);
        return Ok(balance);
    }

    [HttpPost("transactions")]
    public async Task<ActionResult<CompensationTransactionResponse>> ProcessTransaction(
        [FromBody] CreateCompensationTransactionRequest request,
        CancellationToken cancellationToken)
    {
        var transaction = await _compensationService.ProcessTransactionAsync(request, cancellationToken);
        return Ok(transaction);
    }

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

    [HttpGet("projects/{projectId}/daily-summary")]
    public async Task<ActionResult<DailyCompensationSummary>> GetDailySummary(
        Guid projectId,
        [FromQuery] string? date = null,
        CancellationToken cancellationToken = default)
    {
        // FIXED: Use local timezone for default date instead of UTC
        // This ensures "today" matches the user's business day
        var targetDate = TimezoneHelper.GetLocalTodayDate(null); // Uses Asia/Dushanbe default
        if (!string.IsNullOrEmpty(date) && DateOnly.TryParse(date, out var parsedDate))
            targetDate = parsedDate;

        var summary = await _compensationService.GetDailySummaryAsync(projectId, targetDate, cancellationToken);
        return Ok(summary);
    }
}
