using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Transactions;

namespace YallaBusinessAdmin.Api.Controllers;

[ApiController]
[Route("api/transactions")]
[Authorize]
public class TransactionsController : ControllerBase
{
    private readonly ITransactionsService _transactionsService;

    public TransactionsController(ITransactionsService transactionsService)
    {
        _transactionsService = transactionsService;
    }

    /// <summary>
    /// Get all transactions (ledger history)
    /// </summary>
    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? type = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        CancellationToken cancellationToken = default)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        var result = await _transactionsService.GetAllAsync(
            companyId.Value, page, pageSize, type, startDate, endDate, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Get transaction by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        try
        {
            var result = await _transactionsService.GetByIdAsync(id, companyId.Value, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Get current balance
    /// </summary>
    [HttpGet("balance")]
    public async Task<ActionResult> GetBalance(CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        try
        {
            var balance = await _transactionsService.GetCurrentBalanceAsync(companyId.Value, cancellationToken);
            return Ok(new { balance });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
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
}

