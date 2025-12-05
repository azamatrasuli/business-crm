namespace YallaBusinessAdmin.Application.Subscriptions.Dtos;

public class BulkCreateSubscriptionRequest
{
    public List<Guid> EmployeeIds { get; set; } = new();
    public string ComboType { get; set; } = string.Empty;
    public Guid DeliveryAddressId { get; set; }
}

public class BulkUpdateSubscriptionRequest
{
    public List<Guid> SubscriptionIds { get; set; } = new();
    public string? ComboType { get; set; }
    public Guid? DeliveryAddressId { get; set; }
}

public class BulkSubscriptionActionRequest
{
    public List<Guid> SubscriptionIds { get; set; } = new();
}

