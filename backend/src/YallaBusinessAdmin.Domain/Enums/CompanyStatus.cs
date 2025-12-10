namespace YallaBusinessAdmin.Domain.Enums;

/// <summary>
/// Status of a company or project.
/// Used for both Company and Project entities.
/// Maps to Postgres text column: status
/// </summary>
public enum CompanyStatus
{
    /// <summary>Активный - Company/Project is active and operational</summary>
    Active,
    
    /// <summary>Не активный - Company/Project is inactive (disabled)</summary>
    Inactive
}

public static class CompanyStatusExtensions
{
    /// <summary>
    /// Convert enum to Russian string for database storage.
    /// </summary>
    public static string ToRussian(this CompanyStatus status) => status switch
    {
        CompanyStatus.Active => "Активный",
        CompanyStatus.Inactive => "Не активный",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };

    /// <summary>
    /// Convert Russian string from database to enum.
    /// </summary>
    public static CompanyStatus FromRussian(string? value) => value switch
    {
        "Активный" or "ACTIVE" or "Active" => CompanyStatus.Active,
        "Не активный" or "INACTIVE" or "Inactive" => CompanyStatus.Inactive,
        // Legacy mappings for backward compatibility
        "Заморожен" or "FROZEN" or "Frozen" => CompanyStatus.Inactive,         // Frozen -> Inactive
        "Приостановлен" or "SUSPENDED" or "Suspended" => CompanyStatus.Inactive, // Suspended -> Inactive
        "BLOCKED_DEBT" or "BlockedDebt" => CompanyStatus.Inactive,
        "ARCHIVED" or "Archived" => CompanyStatus.Inactive,
        null or "" => CompanyStatus.Active, // Default for empty values
        _ => CompanyStatus.Active // Default for unknown values
    };

    /// <summary>
    /// Check if status allows operations (orders, subscriptions, etc.)
    /// </summary>
    public static bool IsOperational(this CompanyStatus status) =>
        status == CompanyStatus.Active;
}
