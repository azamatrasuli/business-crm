namespace YallaBusinessAdmin.Domain.Enums;

/// <summary>
/// Status of a company subscription
/// Maps to Postgres enum: subscription_status
/// </summary>
public enum SubscriptionStatus
{
    Active,
    Paused,
    Completed,
    Cancelled
}

public static class SubscriptionStatusExtensions
{
    public static string ToDatabase(this SubscriptionStatus status) => status switch
    {
        SubscriptionStatus.Active => "ACTIVE",
        SubscriptionStatus.Paused => "PAUSED",
        SubscriptionStatus.Completed => "COMPLETED",
        SubscriptionStatus.Cancelled => "CANCELLED",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };

    public static SubscriptionStatus FromDatabase(string value) => value switch
    {
        "ACTIVE" => SubscriptionStatus.Active,
        "PAUSED" => SubscriptionStatus.Paused,
        "COMPLETED" => SubscriptionStatus.Completed,
        "CANCELLED" => SubscriptionStatus.Cancelled,
        _ => throw new ArgumentOutOfRangeException(nameof(value))
    };

    public static string ToRussian(this SubscriptionStatus status) => status switch
    {
        SubscriptionStatus.Active => "Активна",
        SubscriptionStatus.Paused => "На паузе",
        SubscriptionStatus.Completed => "Завершена",
        SubscriptionStatus.Cancelled => "Отменена",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };
}











