namespace YallaBusinessAdmin.Application.Common.Interfaces;

/// <summary>
/// Service for atomic budget operations with concurrency control
/// Prevents race conditions in financial operations
/// </summary>
public interface IBudgetService
{
    /// <summary>
    /// Atomically deduct amount from project budget with validation
    /// </summary>
    /// <param name="projectId">Project ID</param>
    /// <param name="amount">Amount to deduct (positive value)</param>
    /// <param name="description">Operation description for audit</param>
    /// <param name="orderId">Optional related order ID</param>
    /// <returns>New balance after deduction</returns>
    /// <exception cref="InvalidOperationException">If insufficient funds</exception>
    Task<decimal> DeductProjectBudgetAsync(
        Guid projectId, 
        decimal amount, 
        string description,
        Guid? orderId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Atomically refund amount to project budget
    /// </summary>
    /// <param name="projectId">Project ID</param>
    /// <param name="amount">Amount to refund (positive value)</param>
    /// <param name="description">Operation description for audit</param>
    /// <param name="orderId">Optional related order ID</param>
    /// <returns>New balance after refund</returns>
    Task<decimal> RefundProjectBudgetAsync(
        Guid projectId, 
        decimal amount, 
        string description,
        Guid? orderId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Check if project has sufficient budget (including overdraft)
    /// </summary>
    Task<bool> HasSufficientBudgetAsync(Guid projectId, decimal requiredAmount, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Get current budget info for a project
    /// </summary>
    Task<(decimal Balance, decimal OverdraftLimit, decimal Available)> GetProjectBudgetInfoAsync(
        Guid projectId, 
        CancellationToken cancellationToken = default);
}

