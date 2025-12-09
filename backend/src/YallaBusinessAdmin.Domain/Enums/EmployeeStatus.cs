namespace YallaBusinessAdmin.Domain.Enums;

/// <summary>
/// Status of an employee.
/// Replaces the simple bool IsActive with more granular states.
/// Maps to Postgres text column: status
/// </summary>
public enum EmployeeStatus
{
    /// <summary>Активный - Employee is active and can receive orders</summary>
    Active,
    
    /// <summary>Деактивирован - Employee is deactivated (disabled)</summary>
    Deactivated,
    
    /// <summary>Отпуск - Employee is on vacation (temporary inactive)</summary>
    Vacation
}

public static class EmployeeStatusExtensions
{
    /// <summary>
    /// Convert enum to Russian string for database storage.
    /// </summary>
    public static string ToRussian(this EmployeeStatus status) => status switch
    {
        EmployeeStatus.Active => "Активный",
        EmployeeStatus.Deactivated => "Деактивирован",
        EmployeeStatus.Vacation => "Отпуск",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };

    /// <summary>
    /// Convert Russian string from database to enum.
    /// </summary>
    public static EmployeeStatus FromRussian(string? value) => value switch
    {
        "Активный" or "ACTIVE" or "Active" => EmployeeStatus.Active,
        "Деактивирован" or "DEACTIVATED" or "Deactivated" or "Inactive" => EmployeeStatus.Deactivated,
        "Отпуск" or "VACATION" or "Vacation" => EmployeeStatus.Vacation,
        // Legacy support: convert bool-like values
        "true" or "True" => EmployeeStatus.Active,
        "false" or "False" => EmployeeStatus.Deactivated,
        null or "" => EmployeeStatus.Active, // Default for empty values
        _ => EmployeeStatus.Active // Default for unknown values
    };

    /// <summary>
    /// Check if employee is active and can receive orders.
    /// </summary>
    public static bool IsOperational(this EmployeeStatus status) =>
        status == EmployeeStatus.Active;

    /// <summary>
    /// Check if status is a temporary inactive state (can be reactivated easily).
    /// </summary>
    public static bool IsTemporaryInactive(this EmployeeStatus status) =>
        status == EmployeeStatus.Vacation;

    /// <summary>
    /// Convert to legacy bool for backward compatibility.
    /// </summary>
    public static bool ToBool(this EmployeeStatus status) =>
        status == EmployeeStatus.Active;

    /// <summary>
    /// Convert from legacy bool for backward compatibility.
    /// </summary>
    public static EmployeeStatus FromBool(bool isActive) =>
        isActive ? EmployeeStatus.Active : EmployeeStatus.Deactivated;
}

