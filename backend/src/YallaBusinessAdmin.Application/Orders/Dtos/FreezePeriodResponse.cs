namespace YallaBusinessAdmin.Application.Orders.Dtos;

public class FreezePeriodResponse
{
    /// <summary>Список замороженных заказов</summary>
    public List<OrderResponse> FrozenOrders { get; set; } = new();
    
    /// <summary>Список созданных заменяющих заказов</summary>
    public List<OrderResponse> ReplacementOrders { get; set; } = new();
    
    /// <summary>Обновлённая информация о подписке</summary>
    public SubscriptionInfo Subscription { get; set; } = null!;
    
    /// <summary>Количество замороженных дней</summary>
    public int FrozenDaysCount { get; set; }
}

