using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Transactions;
using YallaBusinessAdmin.Application.Transactions.Dtos;

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

        var projectId = GetProjectId();
        var result = await _transactionsService.GetAllAsync(
            companyId.Value, page, pageSize, type, startDate, endDate, projectId, cancellationToken);
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

    /// <summary>
    /// Get financial summary including balance, pending deductions, and available funds.
    /// </summary>
    [HttpGet("summary")]
    public async Task<ActionResult> GetSummary(CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var projectId = GetProjectId();
        var summary = await _transactionsService.GetFinancialSummaryAsync(companyId.Value, projectId, cancellationToken);
        return Ok(summary);
    }

    /// <summary>
    /// Get pending operations - orders to be settled and invoices to be paid.
    /// </summary>
    [HttpGet("pending")]
    public async Task<ActionResult> GetPendingOperations(CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var projectId = GetProjectId();
        var pending = await _transactionsService.GetPendingOperationsAsync(companyId.Value, projectId, cancellationToken);
        return Ok(pending);
    }

    /// <summary>
    /// Get unified financial operations - completed + pending with filters and sorting.
    /// </summary>
    [HttpGet("operations")]
    public async Task<ActionResult> GetOperations(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        [FromQuery] string? type = null,
        [FromQuery] string? sort = "date",
        [FromQuery] bool desc = true,
        CancellationToken cancellationToken = default)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var projectId = GetProjectId();

        // Parse status filter
        var statusFilter = status?.ToLower() switch
        {
            "completed" => OperationStatusFilter.Completed,
            "pending_deduction" or "deduction" => OperationStatusFilter.PendingDeduction,
            "pending_income" or "income" => OperationStatusFilter.PendingIncome,
            _ => OperationStatusFilter.All
        };

        // Parse type filter
        var typeFilter = type?.ToLower() switch
        {
            "deposits" or "deposit" => OperationTypeFilter.Deposits,
            "deductions" or "deduction" => OperationTypeFilter.Deductions,
            "refunds" or "refund" => OperationTypeFilter.Refunds,
            _ => OperationTypeFilter.All
        };

        // Parse sort field
        var sortField = sort?.ToLower() switch
        {
            "amount" => OperationSortField.Amount,
            "type" => OperationSortField.Type,
            "status" => OperationSortField.Status,
            _ => OperationSortField.Date
        };

        var result = await _transactionsService.GetFinancialOperationsAsync(
            companyId.Value,
            projectId,
            page,
            pageSize,
            statusFilter,
            typeFilter,
            sortField,
            desc,
            cancellationToken);

        return Ok(result);
    }
}
