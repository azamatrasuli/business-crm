using System.ComponentModel.DataAnnotations;

namespace YallaBusinessAdmin.Application.Projects.Dtos;

public record UpdateProjectRequest(
    [StringLength(200, MinimumLength = 1)]
    string? Name = null,
    
    decimal? Budget = null,
    decimal? OverdraftLimit = null,
    
    [StringLength(3, MinimumLength = 3)]
    string? CurrencyCode = null,
    
    /// <summary>ACTIVE, BLOCKED_DEBT, ARCHIVED</summary>
    string? Status = null,
    
    string? Timezone = null,
    TimeOnly? CutoffTime = null,
    
    /// <summary>LUNCH or COMPENSATION</summary>
    string? ServiceType = null,
    
    /// <summary>Daily limit per employee (for COMPENSATION)</summary>
    decimal? CompensationDailyLimit = null,
    
    /// <summary>If true, unused balance accumulates; if false, expires daily</summary>
    bool? CompensationRollover = null
);












