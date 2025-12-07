using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Audit;
using YallaBusinessAdmin.Application.Common.Exceptions;
using YallaBusinessAdmin.Application.Common.Interfaces;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

/// <summary>
/// Service for atomic budget operations with concurrency control
/// Uses row-level locking and atomic updates to prevent race conditions
/// </summary>
public class BudgetService : IBudgetService
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;

    public BudgetService(AppDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    public async Task<decimal> DeductProjectBudgetAsync(
        Guid projectId,
        decimal amount,
        string description,
        Guid? orderId = null,
        CancellationToken cancellationToken = default)
    {
        if (amount <= 0)
            throw new ArgumentException("Сумма должна быть положительной", nameof(amount));

        // Use raw SQL for atomic update with row-level locking
        // This prevents race conditions by using database-level atomicity
        var result = await _context.Database.ExecuteSqlRawAsync(
            @"UPDATE projects 
              SET budget = budget - {0}, updated_at = NOW() 
              WHERE id = {1} 
              AND (budget + overdraft_limit) >= {0}",
            amount, projectId);

        if (result == 0)
        {
            // Either project not found or insufficient funds
            var project = await _context.Projects
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == projectId, cancellationToken);

            if (project == null)
                throw new KeyNotFoundException("Проект не найден");

            var available = project.Budget + project.OverdraftLimit;
            throw new InvalidOperationException(
                $"Недостаточно средств. Доступно: {available:N2} {project.CurrencyCode}, требуется: {amount:N2}");
        }

        // Get new balance
        var newBalance = await _context.Projects
            .AsNoTracking()
            .Where(p => p.Id == projectId)
            .Select(p => p.Budget)
            .FirstOrDefaultAsync(cancellationToken);

        // Log transaction
        await LogTransactionAsync(projectId, -amount, newBalance, description, orderId, cancellationToken);

        return newBalance;
    }

    public async Task<decimal> RefundProjectBudgetAsync(
        Guid projectId,
        decimal amount,
        string description,
        Guid? orderId = null,
        CancellationToken cancellationToken = default)
    {
        if (amount <= 0)
            throw new ArgumentException("Сумма должна быть положительной", nameof(amount));

        // Atomic update for refund
        var result = await _context.Database.ExecuteSqlRawAsync(
            @"UPDATE projects 
              SET budget = budget + {0}, updated_at = NOW() 
              WHERE id = {1}",
            amount, projectId);

        if (result == 0)
            throw new KeyNotFoundException("Проект не найден");

        // Get new balance
        var newBalance = await _context.Projects
            .AsNoTracking()
            .Where(p => p.Id == projectId)
            .Select(p => p.Budget)
            .FirstOrDefaultAsync(cancellationToken);

        // Log transaction
        await LogTransactionAsync(projectId, amount, newBalance, description, orderId, cancellationToken);

        return newBalance;
    }

    public async Task<bool> HasSufficientBudgetAsync(
        Guid projectId, 
        decimal requiredAmount, 
        CancellationToken cancellationToken = default)
    {
        var budgetInfo = await GetProjectBudgetInfoAsync(projectId, cancellationToken);
        return budgetInfo.Available >= requiredAmount;
    }

    public async Task<(decimal Balance, decimal OverdraftLimit, decimal Available)> GetProjectBudgetInfoAsync(
        Guid projectId, 
        CancellationToken cancellationToken = default)
    {
        var project = await _context.Projects
            .AsNoTracking()
            .Where(p => p.Id == projectId)
            .Select(p => new { p.Budget, p.OverdraftLimit })
            .FirstOrDefaultAsync(cancellationToken);

        if (project == null)
            throw new KeyNotFoundException("Проект не найден");

        return (project.Budget, project.OverdraftLimit, project.Budget + project.OverdraftLimit);
    }

    private async Task LogTransactionAsync(
        Guid projectId,
        decimal amount,
        decimal balanceAfter,
        string description,
        Guid? orderId,
        CancellationToken cancellationToken)
    {
        // Get company ID from project
        var companyId = await _context.Projects
            .Where(p => p.Id == projectId)
            .Select(p => p.CompanyId)
            .FirstOrDefaultAsync(cancellationToken);

        var transaction = new CompanyTransaction
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            ProjectId = projectId,
            Type = amount > 0 ? TransactionType.Refund : TransactionType.LunchDeduction,
            Amount = amount,
            DailyOrderId = orderId,
            BalanceAfter = balanceAfter,
            Description = description,
            CreatedAt = DateTime.UtcNow
        };

        await _context.CompanyTransactions.AddAsync(transaction, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }
}

