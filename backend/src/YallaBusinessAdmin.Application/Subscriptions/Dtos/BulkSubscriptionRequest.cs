namespace YallaBusinessAdmin.Application.Subscriptions.Dtos;

public class BulkCreateSubscriptionRequest
{
    public List<Guid> EmployeeIds { get; set; } = new();
    public string ComboType { get; set; } = string.Empty;
    
    // NOTE: Address is derived from Employee's Project - no DeliveryAddressId needed
    
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public string? ScheduleType { get; set; }
    public List<string>? CustomDays { get; set; }
}

public class BulkUpdateSubscriptionRequest
{
    public List<Guid> SubscriptionIds { get; set; } = new();
    public string? ComboType { get; set; }
    
    // NOTE: Address is derived from Employee's Project and cannot be changed here.
    // To change address, update the Project's address fields.
}

public class BulkSubscriptionActionRequest
{
    public List<Guid> SubscriptionIds { get; set; } = new();
}

