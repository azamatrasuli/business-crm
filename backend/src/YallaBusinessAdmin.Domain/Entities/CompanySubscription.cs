using YallaBusinessAdmin.Domain.Enums;

namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents a subscription for a project (lunch deliveries).
/// Maps to table: company_subscriptions
/// </summary>
public class CompanySubscription
{
    public Guid Id { get; set; }
    
    /// <summary>Project that has this subscription</summary>
    public Guid ProjectId { get; set; }
    
    // Subscription period
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public int TotalDays { get; set; }
    
    // Finance
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public bool IsPaid { get; set; }
    
    // Status
    public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Active;
    
    // Pause info
    public DateTime? PausedAt { get; set; }
    public int PausedDaysCount { get; set; } = 0;
    
    // Who created
    public Guid? CreatedByUserId { get; set; }
    
    // Timestamps
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    // Navigation properties
    public Project? Project { get; set; }
    public AdminUser? CreatedByUser { get; set; }
    public ICollection<EmployeeMealAssignment> MealAssignments { get; set; } = new List<EmployeeMealAssignment>();
}






