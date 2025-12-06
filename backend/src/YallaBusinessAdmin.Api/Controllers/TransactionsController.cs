using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Transactions;

namespace YallaBusinessAdmin.Api.Controllers;

/// <summary>
/// Transactions - all exceptions handled by global exception handler
/// </summary>
[ApiController]
[Route("api/transactions")]
[Authorize]
public class TransactionsController : BaseApiController
{
    private readonly ITransactionsService _transactionsService;

    public TransactionsController(ITransactionsService transactionsService)
    {
        _transactionsService = transactionsService;
    }

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
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _transactionsService.GetAllAsync(
            companyId.Value, page, pageSize, type, startDate, endDate, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _transactionsService.GetByIdAsync(id, companyId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpGet("balance")]
    public async Task<ActionResult> GetBalance(CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var balance = await _transactionsService.GetCurrentBalanceAsync(companyId.Value, cancellationToken);
        return Ok(new { balance });
    }
}
