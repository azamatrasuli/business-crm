namespace YallaBusinessAdmin.Application.Orders.Dtos;

public class OrderResponse
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid? EmployeeId { get; set; }
    public string? EmployeeName { get; set; }
    public string? GuestName { get; set; }
    public bool IsGuestOrder { get; set; }
    public string ComboType { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string CurrencyCode { get; set; } = "TJS";
    public string Status { get; set; } = string.Empty;
    public DateTime OrderDate { get; set; }
    
    // Freeze info
    public DateTime? FrozenAt { get; set; }
    public string? FrozenReason { get; set; }
    public Guid? ReplacementOrderId { get; set; }
    public OrderResponse? ReplacementOrder { get; set; }
    
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

