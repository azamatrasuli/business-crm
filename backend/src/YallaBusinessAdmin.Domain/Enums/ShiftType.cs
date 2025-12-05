namespace YallaBusinessAdmin.Domain.Enums;

/// <summary>
/// Type of work shift for an employee.
/// </summary>
public enum ShiftType
{
    /// <summary>Дневная смена (обычно 08:00 - 18:00)</summary>
    Day,
    /// <summary>Ночная смена (обычно 20:00 - 08:00)</summary>
    Night
}

public static class ShiftTypeExtensions
{
    public static string ToDatabase(this ShiftType type) => type switch
    {
        ShiftType.Day => "DAY",
        ShiftType.Night => "NIGHT",
        _ => throw new ArgumentOutOfRangeException(nameof(type))
    };

    public static ShiftType FromDatabase(string value) => value switch
    {
        "DAY" => ShiftType.Day,
        "NIGHT" => ShiftType.Night,
        _ => throw new ArgumentOutOfRangeException(nameof(value))
    };

    public static string ToRussian(this ShiftType type) => type switch
    {
        ShiftType.Day => "Дневная",
        ShiftType.Night => "Ночная",
        _ => throw new ArgumentOutOfRangeException(nameof(type))
    };

    public static ShiftType FromRussian(string value) => value switch
    {
        "Дневная" => ShiftType.Day,
        "Ночная" => ShiftType.Night,
        _ => throw new ArgumentOutOfRangeException(nameof(value))
    };
}

