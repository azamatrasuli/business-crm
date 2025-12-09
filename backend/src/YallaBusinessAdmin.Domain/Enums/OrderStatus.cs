namespace YallaBusinessAdmin.Domain.Enums;

/// <summary>
/// Status of an order.
/// Maps to Postgres enum: order_status
/// DB values: {Активен, Выполнен, Отменён, Заморожен, Приостановлен, Выходной, Доставлен}
/// </summary>
public enum OrderStatus
{
    /// <summary>Активен - Active order, ready for delivery</summary>
    Active,
    
    /// <summary>Приостановлен - Order is paused (subscription paused)</summary>
    Paused,
    
    /// <summary>Заморожен - Frozen order (day skipped, moved to end of subscription)</summary>
    Frozen,
    
    /// <summary>Выходной - Day off (no work on this day)</summary>
    DayOff,
    
    /// <summary>Доставлен - Order has been delivered (primary terminal status)</summary>
    Delivered,
    
    /// <summary>Выполнен - Completed (legacy DB value, use Delivered for new orders)</summary>
    Completed,
    
    /// <summary>Отменён - Cancelled order</summary>
    Cancelled
}

public static class OrderStatusExtensions
{
    /// <summary>
    /// Convert enum to Russian string for database storage.
    /// Note: Completed is stored as "Выполнен" (legacy), Delivered as "Доставлен" (new).
    /// </summary>
    public static string ToRussian(this OrderStatus status) => status switch
    {
        OrderStatus.Active => "Активен",
        OrderStatus.Paused => "Приостановлен",
        OrderStatus.Frozen => "Заморожен",
        OrderStatus.DayOff => "Выходной",
        OrderStatus.Delivered => "Доставлен",
        OrderStatus.Completed => "Выполнен",  // Legacy DB value (not "Завершен"!)
        OrderStatus.Cancelled => "Отменён",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };

    /// <summary>
    /// Convert Russian string from database to enum.
    /// Note: "На паузе" is deprecated, use "Приостановлен" - kept for backward compatibility only.
    /// </summary>
    public static OrderStatus FromRussian(string? value) => value switch
    {
        "Активен" => OrderStatus.Active,
        "Приостановлен" => OrderStatus.Paused,
        "На паузе" => OrderStatus.Paused,  // DEPRECATED: Legacy alias, migrated to "Приостановлен"
        "Заморожен" => OrderStatus.Frozen,
        "Выходной" => OrderStatus.DayOff,
        "Доставлен" => OrderStatus.Delivered,
        "Выполнен" => OrderStatus.Completed,  // Legacy DB value
        "Завершен" => OrderStatus.Completed,  // Legacy UI value (map to same enum)
        "Отменён" => OrderStatus.Cancelled,
        null or "" => OrderStatus.Active,  // Default
        _ => OrderStatus.Active  // Default for unknown values
    };

    /// <summary>
    /// Check if order can be modified (not in terminal state).
    /// </summary>
    public static bool CanModify(this OrderStatus status) =>
        status == OrderStatus.Active || 
        status == OrderStatus.Paused ||
        status == OrderStatus.Frozen;

    /// <summary>
    /// Check if order is in terminal state (delivered, completed, or cancelled).
    /// </summary>
    public static bool IsTerminal(this OrderStatus status) =>
        status == OrderStatus.Delivered || 
        status == OrderStatus.Completed ||
        status == OrderStatus.Cancelled;

    /// <summary>
    /// Check if order represents an active delivery request.
    /// </summary>
    public static bool IsActiveOrder(this OrderStatus status) =>
        status == OrderStatus.Active;
    
    /// <summary>
    /// Check if order was successfully delivered (Delivered or legacy Completed).
    /// </summary>
    public static bool IsDelivered(this OrderStatus status) =>
        status == OrderStatus.Delivered || status == OrderStatus.Completed;
}
