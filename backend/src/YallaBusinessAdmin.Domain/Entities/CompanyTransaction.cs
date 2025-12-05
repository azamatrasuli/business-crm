using YallaBusinessAdmin.Domain.Enums;

namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents a transaction in the company ledger.
/// This is an immutable record - entries are never modified.
/// Maps to table: company_transactions
/// </summary>
public class CompanyTransaction
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    
    /// <summary>Project this transaction belongs to (each project has isolated finances)</summary>
    public Guid? ProjectId { get; set; }
    
    public TransactionType Type { get; set; }
    public decimal Amount { get; set; } // Negative for deductions, positive for deposits
    
    // Traceability links
    public Guid? InvoiceId { get; set; }
    public Guid? DailyOrderId { get; set; }
    public Guid? ClientAppOrderUuid { get; set; } // Weak reference to external Client App
    
    // Balance snapshot for integrity verification
    public decimal BalanceAfter { get; set; }
    public string? Description { get; set; }
    
    public DateTime CreatedAt { get; set; }

    // Navigation properties
    public Company? Company { get; set; }
    public Project? Project { get; set; }
    public Invoice? Invoice { get; set; }
    public Order? DailyOrder { get; set; }
}

