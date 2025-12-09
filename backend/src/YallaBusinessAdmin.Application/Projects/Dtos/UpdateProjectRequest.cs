using System.ComponentModel.DataAnnotations;

namespace YallaBusinessAdmin.Application.Projects.Dtos;

public record UpdateProjectRequest(
    [StringLength(200, MinimumLength = 1)]
    string? Name = null,
    
    // ═══════════════════════════════════════════════════════════════
    // ADDRESS FIELDS
    // Note: Address can be updated to fill in missing data.
    // For complete address change, consider creating a new project.
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>Short name for the address (e.g., "Главный офис")</summary>
    [StringLength(255)]
    string? AddressName = null,
    
    /// <summary>Full delivery address (e.g., "ул. Рудаки 14, Душанбе")</summary>
    [StringLength(500)]
    string? AddressFullAddress = null,
    
    /// <summary>Latitude for geo location (optional)</summary>
    double? AddressLatitude = null,
    
    /// <summary>Longitude for geo location (optional)</summary>
    double? AddressLongitude = null,
    
    // ═══════════════════════════════════════════════════════════════
    // FINANCE & SETTINGS
    // ═══════════════════════════════════════════════════════════════
    
    decimal? Budget = null,
    decimal? OverdraftLimit = null,
    
    [StringLength(3, MinimumLength = 3)]
    string? CurrencyCode = null,
    
    /// <summary>ACTIVE, BLOCKED_DEBT, ARCHIVED</summary>
    string? Status = null,
    
    string? Timezone = null,
    TimeOnly? CutoffTime = null,
    
    /// <summary>Array of service types: LUNCH and/or COMPENSATION</summary>
    List<string>? ServiceTypes = null,
    
    /// <summary>Daily limit per employee (for COMPENSATION)</summary>
    decimal? CompensationDailyLimit = null,
    
    /// <summary>If true, unused balance accumulates; if false, expires daily</summary>
    bool? CompensationRollover = null
);












