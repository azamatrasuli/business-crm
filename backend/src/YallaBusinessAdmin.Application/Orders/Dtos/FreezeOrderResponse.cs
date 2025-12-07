namespace YallaBusinessAdmin.Application.Orders.Dtos;

public class FreezeOrderResponse
{
    /// <summary>Заморожен/размороженный заказ</summary>
    public OrderResponse Order { get; set; } = null!;
    
    /// <summary>Заменяющий заказ (создан при заморозке)</summary>
    public OrderResponse? ReplacementOrder { get; set; }
    
    /// <summary>Обновлённая информация о подписке</summary>
    public SubscriptionInfo Subscription { get; set; } = null!;
}

public class SubscriptionInfo
{
    public Guid Id { get; set; }
    public DateOnly? OriginalEndDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public int FrozenDaysCount { get; set; }
    public int TotalDays { get; set; }
}

