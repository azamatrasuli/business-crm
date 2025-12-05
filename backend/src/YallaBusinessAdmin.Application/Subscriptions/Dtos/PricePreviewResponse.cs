namespace YallaBusinessAdmin.Application.Subscriptions.Dtos;

public class PricePreviewResponse
{
    public string CurrentComboType { get; set; } = string.Empty;
    public decimal CurrentPrice { get; set; }
    public string NewComboType { get; set; } = string.Empty;
    public decimal NewPrice { get; set; }
    public decimal PriceDifference { get; set; }
    public string PriceChangeDescription { get; set; } = string.Empty;
    public int AffectedOrdersCount { get; set; }
    public decimal TotalImpact { get; set; }
}

