namespace YallaBusinessAdmin.Application.Subscriptions.Dtos;

public class UpdateSubscriptionDetailsRequest
{
    public string? ComboType { get; set; }
    
    // NOTE: Address is derived from Employee's Project and cannot be changed here.
    // To change address, update the Project's address fields.
    
    public bool? IsActive { get; set; }
}

