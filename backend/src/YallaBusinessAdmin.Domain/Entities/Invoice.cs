using YallaBusinessAdmin.Domain.Enums;

namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents an invoice from Yalla Lunch.
/// Maps to table: invoices
/// </summary>
public class Invoice
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    
    /// <summary>Project this invoice belongs to (each project has isolated billing)</summary>
    public Guid? ProjectId { get; set; }
    
    public string? ExternalId { get; set; } // ID from Yalla CRM / 1C (idempotency key)
    public decimal Amount { get; set; }
    public string CurrencyCode { get; set; } = "TJS";
    public InvoiceStatus Status { get; set; } = InvoiceStatus.Unpaid;
    public DateTime? DueDate { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime CreatedAt { get; set; }

    // Navigation properties
    public Company? Company { get; set; }
    public Project? Project { get; set; }
    public ICollection<CompanyTransaction> Transactions { get; set; } = new List<CompanyTransaction>();
}

