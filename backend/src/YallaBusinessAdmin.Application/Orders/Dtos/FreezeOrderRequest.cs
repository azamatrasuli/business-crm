namespace YallaBusinessAdmin.Application.Orders.Dtos;

public class FreezeOrderRequest
{
    /// <summary>Причина заморозки (опционально)</summary>
    public string? Reason { get; set; }
}

