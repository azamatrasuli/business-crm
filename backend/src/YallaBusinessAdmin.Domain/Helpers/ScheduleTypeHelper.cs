namespace YallaBusinessAdmin.Domain.Helpers;

/// <summary>
/// Helper for schedule type validation and normalization.
/// Supported types: EVERY_DAY, EVERY_OTHER_DAY, CUSTOM
/// </summary>
public static class ScheduleTypeHelper
{
    public const string EveryDay = "EVERY_DAY";
    public const string EveryOtherDay = "EVERY_OTHER_DAY";
    public const string Custom = "CUSTOM";
    
    // Legacy type that should be normalized
    private const string LegacyWeekdays = "WEEKDAYS";
    
    /// <summary>
    /// All valid schedule types supported by the system.
    /// </summary>
    public static readonly HashSet<string> ValidTypes = new() 
    { 
        EveryDay, 
        EveryOtherDay, 
        Custom 
    };
    
    /// <summary>
    /// Normalizes schedule type to supported values.
    /// - WEEKDAYS → EVERY_DAY (legacy support)
    /// - Unknown/null → EVERY_DAY (safe default)
    /// </summary>
    public static string Normalize(string? scheduleType)
    {
        if (string.IsNullOrEmpty(scheduleType))
            return EveryDay;
            
        // Legacy support: WEEKDAYS was used to mean Monday-Friday
        // (same as EVERY_DAY with default working days)
        if (scheduleType == LegacyWeekdays)
            return EveryDay;
            
        // Validate against supported types
        if (!ValidTypes.Contains(scheduleType))
            return EveryDay;
            
        return scheduleType;
    }
    
    /// <summary>
    /// Checks if the schedule type is valid (supported by the system).
    /// </summary>
    public static bool IsValid(string? scheduleType) =>
        !string.IsNullOrEmpty(scheduleType) && ValidTypes.Contains(scheduleType);
    
    /// <summary>
    /// Checks if the schedule type is CUSTOM.
    /// </summary>
    public static bool IsCustom(string? scheduleType) =>
        Normalize(scheduleType) == Custom;
}







