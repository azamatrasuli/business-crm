using YallaBusinessAdmin.Application.Orders.Dtos;

namespace YallaBusinessAdmin.Application.Orders;

public interface IOrderFreezeService
{
    /// <summary>
    /// Заморозить один заказ.
    /// Создаёт replacement order в конце подписки и продлевает подписку на 1 день.
    /// </summary>
    Task<FreezeOrderResponse> FreezeOrderAsync(
        Guid orderId, 
        FreezeOrderRequest request,
        Guid companyId, 
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Разморозить заказ.
    /// Удаляет replacement order и сокращает подписку на 1 день.
    /// </summary>
    Task<FreezeOrderResponse> UnfreezeOrderAsync(
        Guid orderId, 
        Guid companyId, 
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Заморозить период (несколько дней, например отпуск).
    /// </summary>
    Task<FreezePeriodResponse> FreezePeriodAsync(
        FreezePeriodRequest request, 
        Guid companyId, 
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Получить информацию о заморозках сотрудника.
    /// Включает количество заморозок на этой неделе, лимит, замороженные заказы.
    /// </summary>
    Task<EmployeeFreezeInfoResponse> GetEmployeeFreezeInfoAsync(
        Guid employeeId, 
        Guid companyId, 
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Получить заказы сотрудника за период.
    /// </summary>
    Task<List<OrderResponse>> GetEmployeeOrdersAsync(
        Guid employeeId,
        DateOnly? startDate,
        DateOnly? endDate,
        Guid companyId, 
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Проверить можно ли заморозить заказ.
    /// Лимит берётся из business_config (subscription.max_freezes_per_week).
    /// </summary>
    /// <param name="employeeId">ID сотрудника</param>
    /// <param name="date">Дата для проверки</param>
    /// <param name="maxFreezesPerWeek">Максимум заморозок в неделю (из конфига)</param>
    /// <param name="cancellationToken">Токен отмены</param>
    Task<bool> ValidateFreezeLimitAsync(
        Guid employeeId, 
        DateOnly date,
        int maxFreezesPerWeek,
        CancellationToken cancellationToken = default);
}

