namespace YallaBusinessAdmin.Application.Transactions.Dtos;

// ═══════════════════════════════════════════════════════════════
// FILTER ENUMS
// ═══════════════════════════════════════════════════════════════

public enum OperationStatusFilter
{
    All,
    Completed,
    PendingDeduction,
    PendingIncome
}

public enum OperationTypeFilter
{
    All,
    Deposits,
    Deductions,
    Refunds
}

public enum OperationSortField
{
    Date,
    Amount,
    Type,
    Status
}

// ═══════════════════════════════════════════════════════════════
// RESPONSE DTOS
// ═══════════════════════════════════════════════════════════════

/// <summary>
/// Unified financial operation - can be completed transaction or pending order/invoice.
/// </summary>
public record FinancialOperationResponse
{
    public Guid Id { get; init; }
    
    /// <summary>DEPOSIT, LUNCH_DEDUCTION, GUEST_ORDER, REFUND, CLIENT_APP_ORDER</summary>
    public string Type { get; init; } = string.Empty;
    
    /// <summary>COMPLETED, PENDING_DEDUCTION, PENDING_INCOME</summary>
    public string Status { get; init; } = string.Empty;
    
    public decimal Amount { get; init; }
    public string CurrencyCode { get; init; } = "TJS";
    
    /// <summary>Main description (e.g., "Обеды за 10.12 • 5 сотр., 2 гост.")</summary>
    public string Description { get; init; } = string.Empty;
    
    /// <summary>Additional details (e.g., employee names)</summary>
    public string? Details { get; init; }
    
    public DateTime CreatedAt { get; init; }
    
    /// <summary>When the operation will be executed (for pending operations)</summary>
    public DateTime? ExecutionDate { get; init; }
    
    /// <summary>True if this is income (DEPOSIT, REFUND), false if expense</summary>
    public bool IsIncome { get; init; }
    
    /// <summary>Number of items in aggregated operations (e.g., orders count)</summary>
    public int ItemsCount { get; init; } = 1;
}

/// <summary>
/// Paged response for financial operations.
/// </summary>
public record FinancialOperationsPagedResponse
{
    public List<FinancialOperationResponse> Items { get; init; } = new();
    public int Total { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalPages { get; init; }
}
