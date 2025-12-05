namespace YallaBusinessAdmin.Application.Transactions.Dtos;

public class TransactionResponse
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal BalanceAfter { get; set; }
    public string? Description { get; set; }
    public Guid? InvoiceId { get; set; }
    public Guid? DailyOrderId { get; set; }
    public DateTime CreatedAt { get; set; }
}

