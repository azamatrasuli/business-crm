namespace YallaBusinessAdmin.Domain.Enums;

/// <summary>
/// Status of a lunch subscription.
/// Maps to Postgres text column: status
/// </summary>
public enum SubscriptionStatus
{
    /// <summary>Активна - Subscription is active</summary>
    Active,
    
    /// <summary>Приостановлена - Subscription is paused (temporarily)</summary>
    Paused,
    
    /// <summary>Завершена - Subscription is completed/deactivated (permanently)</summary>
    Completed
}

public static class SubscriptionStatusExtensions
{
    /// <summary>
    /// Convert enum to Russian string for database storage.
    /// </summary>
    public static string ToRussian(this SubscriptionStatus status) => status switch
    {
        SubscriptionStatus.Active => "Активна",
        SubscriptionStatus.Paused => "Приостановлена",
        SubscriptionStatus.Completed => "Завершена",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };

    /// <summary>
    /// Convert Russian string from database to enum.
    /// Note: "На паузе" is deprecated, use "Приостановлена" - kept for backward compatibility only.
    /// </summary>
    public static SubscriptionStatus FromRussian(string? value) => value switch
    {
        "Активна" or "ACTIVE" or "Active" => SubscriptionStatus.Active,
        "Приостановлена" or "PAUSED" or "Paused" => SubscriptionStatus.Paused,
        "На паузе" => SubscriptionStatus.Paused,  // DEPRECATED: Legacy alias, use "Приостановлена"
        "Завершена" or "COMPLETED" or "Completed" => SubscriptionStatus.Completed,
        null or "" => SubscriptionStatus.Active,  // Default
        _ => SubscriptionStatus.Active  // Default for unknown values
    };

    /// <summary>
    /// Check if subscription is operational (can receive orders).
    /// Only Active subscriptions can receive orders.
    /// </summary>
    public static bool IsOperational(this SubscriptionStatus status) =>
        status == SubscriptionStatus.Active;
    
    /// <summary>
    /// Check if subscription is in a terminal state (cannot be resumed).
    /// </summary>
    public static bool IsTerminal(this SubscriptionStatus status) =>
        status == SubscriptionStatus.Completed;
    
    /// <summary>
    /// Check if subscription can be resumed.
    /// Only paused subscriptions can be resumed.
    /// </summary>
    public static bool CanBeResumed(this SubscriptionStatus status) =>
        status == SubscriptionStatus.Paused;
}

