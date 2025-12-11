namespace YallaBusinessAdmin.Application.Transactions.Dtos;

/// <summary>
/// Financial summary for a project - shows current balance and pending operations.
/// Used on the Payments/Finance page to give clear visibility into money flow.
/// </summary>
public record FinancialSummaryResponse
{
    // ═══════════════════════════════════════════════════════════════
    // БАЛАНС
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>
    /// Current project balance (what's actually in the account).
    /// </summary>
    public decimal Balance { get; init; }

    /// <summary>
    /// Currency code (e.g., "TJS").
    /// </summary>
    public string CurrencyCode { get; init; } = "TJS";

    // ═══════════════════════════════════════════════════════════════
    // ПОСТУПЛЕНИЯ (Income)
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>
    /// Amount pending income - sum of unpaid invoices.
    /// </summary>
    public decimal PendingIncome { get; init; }

    /// <summary>
    /// Number of unpaid invoices.
    /// </summary>
    public int PendingInvoicesCount { get; init; }

    // ═══════════════════════════════════════════════════════════════
    // СПИСАНИЯ (Expenses)
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>
    /// Amount pending deduction - sum of Active orders that will be settled.
    /// </summary>
    public decimal PendingDeduction { get; init; }

    /// <summary>
    /// Number of active orders pending settlement.
    /// </summary>
    public int PendingOrdersCount { get; init; }

    // ═══════════════════════════════════════════════════════════════
    // ИТОГО
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>
    /// Available funds = Balance - PendingDeduction.
    /// This is what's actually available after today's orders are settled.
    /// </summary>
    public decimal Available { get; init; }

    /// <summary>
    /// Projected balance = Balance + PendingIncome - PendingDeduction.
    /// What balance will be after all pending operations complete.
    /// </summary>
    public decimal ProjectedBalance { get; init; }

    /// <summary>
    /// Overdraft limit - how much the project can go negative.
    /// </summary>
    public decimal OverdraftLimit { get; init; }

    // ═══════════════════════════════════════════════════════════════
    // СТАТУС
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>
    /// True if balance is low (less than pending deduction).
    /// </summary>
    public bool IsLowBalance { get; init; }

    /// <summary>
    /// Warning message if balance is low or negative.
    /// </summary>
    public string? WarningMessage { get; init; }

    /// <summary>
    /// Today's date for reference.
    /// </summary>
    public string Date { get; init; } = string.Empty;
}




