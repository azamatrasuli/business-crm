using System.ComponentModel.DataAnnotations;

namespace YallaBusinessAdmin.Application.Projects.Dtos;

public record CreateProjectRequest(
    [Required]
    [StringLength(200, MinimumLength = 1)]
    string Name,
    
    // ═══════════════════════════════════════════════════════════════
    // ADDRESS (required, immutable after creation)
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>Short name for the address (e.g., "Главный офис")</summary>
    [Required]
    [StringLength(255, MinimumLength = 1)]
    string AddressName,
    
    /// <summary>Full delivery address (e.g., "ул. Рудаки 14, Душанбе")</summary>
    [Required]
    [StringLength(500, MinimumLength = 1)]
    string AddressFullAddress,
    
    /// <summary>Latitude for geo location (optional)</summary>
    double? AddressLatitude = null,
    
    /// <summary>Longitude for geo location (optional)</summary>
    double? AddressLongitude = null,
    
    // ═══════════════════════════════════════════════════════════════
    // FINANCE & SETTINGS
    // ═══════════════════════════════════════════════════════════════
    
    decimal Budget = 0,
    decimal OverdraftLimit = 0,
    
    [StringLength(3, MinimumLength = 3)]
    string CurrencyCode = "TJS",
    
    string Timezone = "Asia/Dushanbe",
    TimeOnly? CutoffTime = null,
    
    /// <summary>Array of service types: LUNCH and/or COMPENSATION</summary>
    List<string>? ServiceTypes = null,
    
    /// <summary>Daily limit per employee (for COMPENSATION)</summary>
    decimal CompensationDailyLimit = 0,
    
    /// <summary>If true, unused balance accumulates; if false, expires daily</summary>
    bool CompensationRollover = false
);




