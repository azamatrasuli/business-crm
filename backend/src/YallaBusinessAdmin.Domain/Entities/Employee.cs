using YallaBusinessAdmin.Domain.Enums;

namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents an employee (meal consumer) in the system.
/// Every employee MUST belong to a project (address is derived from project).
/// Maps to table: employees
/// </summary>
public class Employee
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    
    /// <summary>Project this employee belongs to (REQUIRED - address comes from project)</summary>
    public Guid ProjectId { get; set; }
    
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Position { get; set; }
    public bool IsActive { get; set; }
    public EmployeeInviteStatus InviteStatus { get; set; } = EmployeeInviteStatus.Accepted;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    
    // ═══════════════════════════════════════════════════════════════
    // Service Type (attached to employee, not project)
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>Type of service for this employee: LUNCH or COMPENSATION</summary>
    public ServiceType? ServiceType { get; set; }
    
    // ═══════════════════════════════════════════════════════════════
    // Work Schedule
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>Type of shift: Day or Night</summary>
    public ShiftType? ShiftType { get; set; }
    
    /// <summary>Working days as JSON array [1,2,3,4,5] where 0=Sun, 1=Mon, etc.</summary>
    public int[]? WorkingDays { get; set; }
    
    /// <summary>Work start time (e.g., "09:00")</summary>
    public TimeOnly? WorkStartTime { get; set; }
    
    /// <summary>Work end time (e.g., "18:00")</summary>
    public TimeOnly? WorkEndTime { get; set; }

    // Navigation properties
    public Company? Company { get; set; }
    public Project? Project { get; set; }
    public EmployeeBudget? Budget { get; set; }
    public LunchSubscription? LunchSubscription { get; set; }
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
