namespace YallaBusinessAdmin.Domain.Enums;

/// <summary>
/// Status of an order.
/// Maps to Postgres enum: order_status
/// </summary>
public enum OrderStatus
{
    /// <summary>Активен - Active order</summary>
    Active,
    /// <summary>На паузе - Paused order</summary>
    Paused,
    /// <summary>Завершен - Completed order</summary>
    Completed,
    /// <summary>Доставлен - Delivered order</summary>
    Delivered,
    /// <summary>Отменён - Cancelled order</summary>
    Cancelled,
    /// <summary>Заморожен - Frozen order (обед отменён, день переносится в конец подписки)</summary>
    Frozen
}

public static class OrderStatusExtensions
{
    public static string ToRussian(this OrderStatus status) => status switch
    {
        OrderStatus.Active => "Активен",
        OrderStatus.Paused => "На паузе",
        OrderStatus.Completed => "Завершен",
        OrderStatus.Delivered => "Доставлен",
        OrderStatus.Cancelled => "Отменён",
        OrderStatus.Frozen => "Заморожен",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };

    public static OrderStatus FromRussian(string value) => value switch
    {
        "Активен" => OrderStatus.Active,
        "На паузе" => OrderStatus.Paused,
        "Завершен" => OrderStatus.Completed,
        "Доставлен" => OrderStatus.Delivered,
        "Отменён" => OrderStatus.Cancelled,
        "Заморожен" => OrderStatus.Frozen,
        _ => throw new ArgumentOutOfRangeException(nameof(value), $"Неизвестный статус заказа: {value}")
    };
}

