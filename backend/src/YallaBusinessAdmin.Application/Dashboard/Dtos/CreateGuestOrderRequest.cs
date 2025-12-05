namespace YallaBusinessAdmin.Application.Dashboard.Dtos;

public class CreateGuestOrderRequest
{
    public string OrderName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string ComboType { get; set; } = string.Empty;
    
    /// <summary>Project to create guest order for (address comes from project)</summary>
    public Guid ProjectId { get; set; }
    
    public string Date { get; set; } = string.Empty;
}

