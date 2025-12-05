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
        CancellationToken cancellationToken = default);
    
    Task<TransactionResponse> GetByIdAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Gets the current balance and validates integrity against the latest transaction
    /// </summary>
    Task<decimal> GetCurrentBalanceAsync(Guid companyId, CancellationToken cancellationToken = default);
}

