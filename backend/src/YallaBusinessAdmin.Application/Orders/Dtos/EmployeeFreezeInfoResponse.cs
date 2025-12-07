namespace YallaBusinessAdmin.Application.Orders.Dtos;

public class EmployeeFreezeInfoResponse
{
    /// <summary>ID сотрудника</summary>
    public Guid EmployeeId { get; set; }
    
    /// <summary>Имя сотрудника</summary>
    public string EmployeeName { get; set; } = string.Empty;
    
    /// <summary>Количество заморозок на этой неделе</summary>
    public int FreezesThisWeek { get; set; }
    
    /// <summary>Максимальное количество заморозок в неделю</summary>
    public int MaxFreezesPerWeek { get; set; }
    
    /// <summary>Можно ли заморозить ещё</summary>
    public bool CanFreeze { get; set; }
    
    /// <summary>Оставшееся количество заморозок на этой неделе</summary>
    public int RemainingFreezes { get; set; }
    
    /// <summary>Список замороженных заказов</summary>
    public List<OrderResponse> FrozenOrders { get; set; } = new();
    
    /// <summary>Информация о подписке</summary>
    public SubscriptionInfo? Subscription { get; set; }
    
    /// <summary>Начало текущей недели</summary>
    public DateOnly WeekStart { get; set; }
    
    /// <summary>Конец текущей недели</summary>
    public DateOnly WeekEnd { get; set; }
}

