namespace YallaBusinessAdmin.Application.Invoices.Dtos;

public class CreateInvoiceRequest
{
    public string? ExternalId { get; set; }
    public decimal Amount { get; set; }
    public DateTime? DueDate { get; set; }
}

