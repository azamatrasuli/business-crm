namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Tracks accumulated compensation balance for employees (when rollover is enabled).
/// Maps to table: employee_compensation_balances
/// </summary>
public class EmployeeCompensationBalance
{
    public Guid Id { get; set; }
    
    public Guid EmployeeId { get; set; }
    public Guid ProjectId { get; set; }
    
    /// <summary>Accumulated unused balance (when rollover is enabled)</summary>
    public decimal AccumulatedBalance { get; set; }
    
    /// <summary>Last date the balance was updated</summary>
    public DateOnly LastUpdatedDate { get; set; }
    
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    // Navigation properties
    public Employee? Employee { get; set; }
    public Project? Project { get; set; }
}











