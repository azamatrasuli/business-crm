namespace YallaBusinessAdmin.Application.Subscriptions.Dtos;

public class SubscriptionResponse
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string EmployeePhone { get; set; } = string.Empty;
    public string ComboType { get; set; } = string.Empty;
    public Guid? DeliveryAddressId { get; set; }
    public string? DeliveryAddressName { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

