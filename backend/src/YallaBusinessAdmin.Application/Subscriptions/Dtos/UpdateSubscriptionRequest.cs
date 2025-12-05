namespace YallaBusinessAdmin.Application.Subscriptions.Dtos;

public class UpdateSubscriptionDetailsRequest
{
    public string? ComboType { get; set; }
    public Guid? DeliveryAddressId { get; set; }
    public bool? IsActive { get; set; }
}

