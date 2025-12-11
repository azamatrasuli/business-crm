namespace YallaBusinessAdmin.Application.Transactions.Dtos;

/// <summary>
/// Pending operations - orders to be settled and invoices to be paid.
/// Shows what will happen to the balance in the near future.
/// </summary>
public record PendingOperationsResponse
{
    /// <summary>
    /// Orders pending settlement (Active status).
    /// </summary>
    public List<PendingOrderItem> PendingOrders { get; init; } = new();

    /// <summary>
    /// Invoices pending payment (Unpaid/Overdue status).
    /// </summary>
    public List<PendingInvoiceItem> PendingInvoices { get; init; } = new();
}

/// <summary>
/// A single pending order (will be deducted from balance).
/// </summary>
public record PendingOrderItem
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string ComboType { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public string CurrencyCode { get; init; } = "TJS";
    public DateTime OrderDate { get; init; }
    public DateTime SettlementDate { get; init; }
    public bool IsGuestOrder { get; init; }
}

/// <summary>
/// A single pending invoice (will be added to balance when paid).
/// </summary>
public record PendingInvoiceItem
{
    public Guid Id { get; init; }
    public string? ExternalId { get; init; }
    public decimal Amount { get; init; }
    public string CurrencyCode { get; init; } = "TJS";
    public string Status { get; init; } = string.Empty;
    public DateTime? DueDate { get; init; }
    public DateTime CreatedAt { get; init; }
}





