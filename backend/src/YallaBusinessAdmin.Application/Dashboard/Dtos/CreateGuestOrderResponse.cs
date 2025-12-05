namespace YallaBusinessAdmin.Application.Dashboard.Dtos;

public class CreateGuestOrderResponse
{
    public string Message { get; set; } = string.Empty;
    public decimal TotalCost { get; set; }
    public decimal RemainingBudget { get; set; }
    public IEnumerable<OrderResponse> Orders { get; set; } = Enumerable.Empty<OrderResponse>();
}

