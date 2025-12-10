using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Transactions.Dtos;

namespace YallaBusinessAdmin.Application.Transactions;

public interface ITransactionsService
{
    Task<PagedResult<TransactionResponse>> GetAllAsync(
        Guid companyId,
        int page,
        int pageSize,
        string? type,
        DateTime? startDate,
        DateTime? endDate,
        Guid? projectId = null,
        CancellationToken cancellationToken = default);

    Task<TransactionResponse> GetByIdAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the current balance and validates integrity against the latest transaction
    /// </summary>
    Task<decimal> GetCurrentBalanceAsync(Guid companyId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets financial summary for a project including balance, pending deductions, and available funds.
    /// </summary>
    Task<FinancialSummaryResponse> GetFinancialSummaryAsync(
        Guid companyId,
        Guid? projectId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets pending operations - orders to be settled and invoices to be paid.
    /// </summary>
    Task<PendingOperationsResponse> GetPendingOperationsAsync(
        Guid companyId,
        Guid? projectId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets unified financial operations - completed transactions + pending orders + pending invoices.
    /// Supports filtering, sorting, and pagination.
    /// </summary>
    Task<FinancialOperationsPagedResponse> GetFinancialOperationsAsync(
        Guid companyId,
        Guid? projectId,
        int page,
        int pageSize,
        OperationStatusFilter statusFilter = OperationStatusFilter.All,
        OperationTypeFilter typeFilter = OperationTypeFilter.All,
        OperationSortField sortField = OperationSortField.Date,
        bool sortDescending = true,
        CancellationToken cancellationToken = default);
}

