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

    public static AdminStatus FromRussian(string value) => value switch
    {
        "Активный" => AdminStatus.Active,
        "Не активный" => AdminStatus.Inactive,
        "Заблокирован" => AdminStatus.Blocked,
        _ => throw new ArgumentOutOfRangeException(nameof(value))
    };
}

