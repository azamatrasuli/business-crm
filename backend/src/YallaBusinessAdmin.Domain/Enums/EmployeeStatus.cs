namespace YallaBusinessAdmin.Domain.Enums;

/// <summary>
/// Status of an employee.
/// Maps to Postgres text column: status
/// </summary>
public enum EmployeeStatus
{
    /// <summary>Активный - Employee is active and can receive orders</summary>
    Active,
    
    /// <summary>Деактивирован - Employee is deactivated (disabled, on leave, temporarily unavailable)</summary>
    Deactivated
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
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };

    /// <summary>
    /// Convert Russian string from database to enum.
    /// </summary>
    public static EmployeeStatus FromRussian(string? value) => value switch
    {
        "Активный" or "ACTIVE" or "Active" => EmployeeStatus.Active,
        "Деактивирован" or "DEACTIVATED" or "Deactivated" or "Inactive" => EmployeeStatus.Deactivated,
        // Legacy support: convert old values
        "Отпуск" or "VACATION" or "Vacation" => EmployeeStatus.Deactivated, // Vacation -> Deactivated
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
