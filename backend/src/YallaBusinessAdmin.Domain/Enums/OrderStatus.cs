namespace YallaBusinessAdmin.Domain.Enums;

/// <summary>
/// Status of an order.
/// Maps to Postgres text column: status
/// DB values: {Активен, Выполнен, Отменён, Приостановлен}
/// </summary>
public enum OrderStatus
{
    /// <summary>Активен - Active order, ready for delivery</summary>
    Active,
    
    /// <summary>Приостановлен - Order is paused (subscription paused)</summary>
    Paused,
    
    /// <summary>Выполнен - Completed (order was delivered/fulfilled)</summary>
    Completed,
    
    /// <summary>Отменён - Cancelled order</summary>
    Cancelled
}

public static class OrderStatusExtensions
{
    /// <summary>
    /// Convert enum to Russian string for database storage.
    /// </summary>
    public static string ToRussian(this OrderStatus status) => status switch
    {
        OrderStatus.Active => "Активен",
        OrderStatus.Paused => "Приостановлен",
        OrderStatus.Completed => "Выполнен",
        OrderStatus.Cancelled => "Отменён",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };

    /// <summary>
    /// Convert Russian string from database to enum.
    /// </summary>
    public static OrderStatus FromRussian(string? value) => value switch
    {
        "Активен" => OrderStatus.Active,
        "Приостановлен" => OrderStatus.Paused,
        "На паузе" => OrderStatus.Paused,  // Legacy alias
        "Выполнен" => OrderStatus.Completed,
        "Завершен" => OrderStatus.Completed,  // Legacy UI value
        "Отменён" => OrderStatus.Cancelled,
        // Legacy values - map to appropriate status
        "Заморожен" => OrderStatus.Cancelled,  // Frozen -> Cancelled
        "Выходной" => OrderStatus.Cancelled,   // DayOff -> Cancelled
        "Доставлен" => OrderStatus.Completed,  // Delivered -> Completed
        null or "" => OrderStatus.Active,  // Default
        _ => OrderStatus.Active  // Default for unknown values
    };

    /// <summary>
    /// Check if order can be modified (not in terminal state).
    /// </summary>
    public static bool CanModify(this OrderStatus status) =>
        status == OrderStatus.Active || 
        status == OrderStatus.Paused;

    /// <summary>
    /// Check if order is in terminal state (completed or cancelled).
    /// </summary>
    public static bool IsTerminal(this OrderStatus status) =>
        status == OrderStatus.Completed ||
        status == OrderStatus.Cancelled;

    /// <summary>
    /// Check if order represents an active delivery request.
    /// </summary>
    public static bool IsActiveOrder(this OrderStatus status) =>
        status == OrderStatus.Active;
    
    /// <summary>
    /// Check if order was successfully completed/delivered.
    /// </summary>
    public static bool IsDelivered(this OrderStatus status) =>
        status == OrderStatus.Completed;
}
