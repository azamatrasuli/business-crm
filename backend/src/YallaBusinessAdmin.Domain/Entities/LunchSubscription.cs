namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents a lunch subscription template for an employee.
/// This is the "intention" to eat - template for automatic order generation.
/// Address is derived from Project (one project = one address).
/// Maps to table: lunch_subscriptions
/// </summary>
public class LunchSubscription
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public Guid CompanyId { get; set; }
    
    /// <summary>Project this subscription belongs to (REQUIRED - address comes from project)</summary>
    public Guid ProjectId { get; set; }
    
    public string ComboType { get; set; } = string.Empty; // 'Комбо 25' or 'Комбо 35'
    public bool IsActive { get; set; } = true;
    
    // Timestamps
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation properties
    public Employee? Employee { get; set; }
    public Company? Company { get; set; }
    public Project? Project { get; set; }
}

