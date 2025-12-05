using YallaBusinessAdmin.Domain.Enums;

namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents a meal assignment for an employee on a specific day.
/// Address is derived from Employee's Project (one project = one address).
/// Maps to table: employee_meal_assignments
/// </summary>
public class EmployeeMealAssignment
{
    public Guid Id { get; set; }
    
    /// <summary>Parent subscription</summary>
    public Guid SubscriptionId { get; set; }
    
    /// <summary>Employee receiving the meal (address comes from employee's project)</summary>
    public Guid EmployeeId { get; set; }
    
    /// <summary>Day of assignment</summary>
    public DateOnly AssignmentDate { get; set; }
    
    /// <summary>Type of combo (e.g., "Комбо 25", "Комбо 35")</summary>
    public string ComboType { get; set; } = string.Empty;
    
    /// <summary>Price of the combo</summary>
    public decimal Price { get; set; }
    
    /// <summary>Current status</summary>
    public MealAssignmentStatus Status { get; set; } = MealAssignmentStatus.Scheduled;
    
    // Freeze info
    public DateTime? FrozenAt { get; set; }
    public string? FrozenReason { get; set; }
    public DateOnly? ReplacementDate { get; set; }
    
    // Timestamps
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    // Navigation properties
    public CompanySubscription? Subscription { get; set; }
    public Employee? Employee { get; set; }
}




