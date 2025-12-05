namespace YallaBusinessAdmin.Domain.Enums;

/// <summary>
/// Type of service for a project.
/// Maps to Postgres enum: service_type
/// </summary>
public enum ServiceType
{
    /// <summary>Комплексные обеды по подписке</summary>
    Lunch,
    /// <summary>Компенсация на питание (QR-оплата в ресторанах)</summary>
    Compensation
}

public static class ServiceTypeExtensions
{
    public static string ToDatabase(this ServiceType type) => type switch
    {
        ServiceType.Lunch => "LUNCH",
        ServiceType.Compensation => "COMPENSATION",
        _ => throw new ArgumentOutOfRangeException(nameof(type))
    };

    public static ServiceType FromDatabase(string value) => value switch
    {
        "LUNCH" => ServiceType.Lunch,
        "COMPENSATION" => ServiceType.Compensation,
        _ => throw new ArgumentOutOfRangeException(nameof(value))
    };

    public static string ToRussian(this ServiceType type) => type switch
    {
        ServiceType.Lunch => "Ланч",
        ServiceType.Compensation => "Компенсация",
        _ => throw new ArgumentOutOfRangeException(nameof(type))
    };

    public static ServiceType FromRussian(string value) => value switch
    {
        "Ланч" => ServiceType.Lunch,
        "Компенсация" => ServiceType.Compensation,
        _ => throw new ArgumentOutOfRangeException(nameof(value))
    };
}











