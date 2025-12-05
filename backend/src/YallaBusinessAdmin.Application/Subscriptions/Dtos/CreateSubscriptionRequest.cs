namespace YallaBusinessAdmin.Application.Subscriptions.Dtos;

public class CreateSubscriptionRequest
{
    public Guid EmployeeId { get; set; }
    public string ComboType { get; set; } = string.Empty;
    public Guid? DeliveryAddressId { get; set; }
}

