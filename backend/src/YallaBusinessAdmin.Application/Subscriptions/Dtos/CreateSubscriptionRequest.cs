namespace YallaBusinessAdmin.Application.Subscriptions.Dtos;

public class CreateSubscriptionRequest
{
    public Guid EmployeeId { get; set; }
    public string ComboType { get; set; } = string.Empty;
    public Guid? DeliveryAddressId { get; set; }
    
    /// <summary>
    /// Start date of the subscription. Defaults to today if not specified.
    /// </summary>
    public DateOnly? StartDate { get; set; }
    
    /// <summary>
    /// End date of the subscription. Defaults to 1 month from start if not specified.
    /// </summary>
    public DateOnly? EndDate { get; set; }
}

