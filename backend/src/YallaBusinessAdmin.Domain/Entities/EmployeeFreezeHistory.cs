namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Tracks freeze history for employees (limit: 2 per week).
/// Maps to table: employee_freeze_history
/// </summary>
public class EmployeeFreezeHistory
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public Guid AssignmentId { get; set; }
    
    public DateTime FrozenAt { get; set; }
    public DateOnly OriginalDate { get; set; }
    
    /// <summary>ISO week year</summary>
    public int WeekYear { get; set; }
    /// <summary>ISO week number (1-53)</summary>
    public int WeekNumber { get; set; }
    
    public DateTime CreatedAt { get; set; }
    
    // Navigation properties
    public Employee? Employee { get; set; }
    public EmployeeMealAssignment? Assignment { get; set; }
}











