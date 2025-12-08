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
    
    // Subscription period & pricing
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public int TotalDays { get; set; }
    public decimal TotalPrice { get; set; }
    public string Status { get; set; } = string.Empty;
    public string ScheduleType { get; set; } = "EVERY_DAY";
    
    // Freeze info
    public int FrozenDaysCount { get; set; }
    public string? OriginalEndDate { get; set; }
    
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

