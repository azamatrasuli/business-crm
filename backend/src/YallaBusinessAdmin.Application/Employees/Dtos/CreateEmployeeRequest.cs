namespace YallaBusinessAdmin.Application.Employees.Dtos;

public class CreateEmployeeRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Position { get; set; }
    
    /// <summary>Project ID (REQUIRED - address comes from project)</summary>
    public Guid ProjectId { get; set; }
    
    /// <summary>Service type: LUNCH or COMPENSATION</summary>
    public string? ServiceType { get; set; }
    
    /// <summary>Shift type: DAY or NIGHT</summary>
    public string? ShiftType { get; set; }
    
    /// <summary>Working days (0=Sunday, 1=Monday, ..., 6=Saturday)</summary>
    public int[]? WorkingDays { get; set; }
    
    /// <summary>Work start time (format: HH:mm)</summary>
    public string? WorkStartTime { get; set; }
    
    /// <summary>Work end time (format: HH:mm)</summary>
    public string? WorkEndTime { get; set; }
}
