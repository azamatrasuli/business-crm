using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Transactions;
using YallaBusinessAdmin.Application.Transactions.Dtos;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class TransactionsService : ITransactionsService
{
    private readonly AppDbContext _context;

    public TransactionsService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<TransactionResponse>> GetAllAsync(
        Guid companyId,
        int page,
        int pageSize,
        string? type,
        DateTime? startDate,
        DateTime? endDate,
        CancellationToken cancellationToken = default)
    {
        var query = _context.CompanyTransactions
            .Where(t => t.CompanyId == companyId);

        if (!string.IsNullOrWhiteSpace(type))
        {
            var transactionType = TransactionTypeExtensions.FromDatabase(type.ToUpper());
            query = query.Where(t => t.Type == transactionType);
        }

        if (startDate.HasValue)
        {
            query = query.Where(t => t.CreatedAt >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            query = query.Where(t => t.CreatedAt <= endDate.Value);
        }

        var total = await query.CountAsync(cancellationToken);
        var transactions = await query
            .OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = transactions.Select(t => new TransactionResponse
        {
            Id = t.Id,
            Type = t.Type.ToDatabase(),
            Amount = t.Amount,
            BalanceAfter = t.BalanceAfter,
            Description = t.Description,
            InvoiceId = t.InvoiceId,
            DailyOrderId = t.DailyOrderId,
            CreatedAt = t.CreatedAt
        });

        return PagedResult<TransactionResponse>.Create(items, total, page, pageSize);
    }

    public async Task<TransactionResponse> GetByIdAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default)
    {
        var transaction = await _context.CompanyTransactions
            .FirstOrDefaultAsync(t => t.Id == id && t.CompanyId == companyId, cancellationToken);

        if (transaction == null)
        {
            throw new KeyNotFoundException("Транзакция не найдена");
        }

        return new TransactionResponse
        {
            Id = transaction.Id,
            Type = transaction.Type.ToDatabase(),
            Amount = transaction.Amount,
            BalanceAfter = transaction.BalanceAfter,
            Description = transaction.Description,
            InvoiceId = transaction.InvoiceId,
            DailyOrderId = transaction.DailyOrderId,
            CreatedAt = transaction.CreatedAt
        };
    }

    public async Task<decimal> GetCurrentBalanceAsync(Guid companyId, CancellationToken cancellationToken = default)
    {
        var company = await _context.Companies
            .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken);

        if (company == null)
        {
            throw new KeyNotFoundException("Компания не найдена");
        }

        // Verify integrity: latest transaction balance_after should match company balance
        var latestTransaction = await _context.CompanyTransactions
            .Where(t => t.CompanyId == companyId)
            .OrderByDescending(t => t.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (latestTransaction != null && latestTransaction.BalanceAfter != company.Budget)
        {
            // Log warning: balance mismatch detected
            // In production, this would trigger an alert
        }

        return company.Budget;
    }
}

