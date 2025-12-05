namespace YallaBusinessAdmin.Application.Invoices.Dtos;

public class InvoiceResponse
{
    public Guid Id { get; set; }
    public string? ExternalId { get; set; }
    public decimal Amount { get; set; }
    public string CurrencyCode { get; set; } = "TJS";
    public string Status { get; set; } = string.Empty;
    public DateTime? DueDate { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

