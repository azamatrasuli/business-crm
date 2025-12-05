namespace YallaBusinessAdmin.Application.Employees.Dtos;

public class UpdateEmployeeRequest
{
    public string? FullName { get; set; }
    public string? Email { get; set; }
    public string? Position { get; set; }
    
    /// <summary>Project ID (address comes from project)</summary>
    public Guid? ProjectId { get; set; }
    
    // ═══════════════════════════════════════════════════════════════
    // Service Type
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>Type of service: LUNCH or COMPENSATION. Can only switch if no active lunch subscription.</summary>
    public string? ServiceType { get; set; }
    
    // ═══════════════════════════════════════════════════════════════
    // Work Schedule
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>Type of shift: DAY or NIGHT</summary>
    public string? ShiftType { get; set; }
    
    /// <summary>Working days as array [1,2,3,4,5] where 0=Sun, 1=Mon, etc.</summary>
    public int[]? WorkingDays { get; set; }
    
    /// <summary>Work start time (e.g., "09:00")</summary>
    public string? WorkStartTime { get; set; }
    
    /// <summary>Work end time (e.g., "18:00")</summary>
    public string? WorkEndTime { get; set; }
}

