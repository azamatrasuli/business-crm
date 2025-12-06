namespace YallaBusinessAdmin.Domain.Enums;

/// <summary>
/// Status of an admin user in the system.
/// Maps to Postgres enum: admin_status
/// </summary>
public enum AdminStatus
{
    /// <summary>Активный - Active user</summary>
    Active,
    /// <summary>Не активный - Inactive user (not yet activated)</summary>
    Inactive,
    /// <summary>Заблокирован - Blocked user</summary>
    Blocked
}

public static class AdminStatusExtensions
{
    public static string ToRussian(this AdminStatus status) => status switch
    {
        AdminStatus.Active => "Активный",
        AdminStatus.Inactive => "Не активный",
        AdminStatus.Blocked => "Заблокирован",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };

    public static AdminStatus FromRussian(string? value) => value switch
    {
        "Активный" or "Active" or "active" => AdminStatus.Active,
        "Не активный" or "Inactive" or "inactive" => AdminStatus.Inactive,
        "Заблокирован" or "Blocked" or "blocked" => AdminStatus.Blocked,
        null or "" => AdminStatus.Inactive, // Default for empty values
        _ => AdminStatus.Inactive // Default for unknown values
    };
}

