// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// FREEZE FUNCTIONALITY DISABLED
// This interface is temporarily disabled as part of status system refactoring.
// The freeze feature will be re-enabled in future versions.
// Last updated: 2025-01-09
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

/*
using YallaBusinessAdmin.Application.Orders.Dtos;

namespace YallaBusinessAdmin.Application.Orders;

public interface IOrderFreezeService
{
    Task<FreezeOrderResponse> FreezeOrderAsync(
        Guid orderId, 
        FreezeOrderRequest request,
        Guid companyId, 
        CancellationToken cancellationToken = default);
    
    Task<FreezeOrderResponse> UnfreezeOrderAsync(
        Guid orderId, 
        Guid companyId, 
        CancellationToken cancellationToken = default);
    
    Task<FreezePeriodResponse> FreezePeriodAsync(
        FreezePeriodRequest request, 
        Guid companyId, 
        CancellationToken cancellationToken = default);
    
    Task<EmployeeFreezeInfoResponse> GetEmployeeFreezeInfoAsync(
        Guid employeeId, 
        Guid companyId, 
        CancellationToken cancellationToken = default);
    
    Task<List<OrderResponse>> GetEmployeeOrdersAsync(
        Guid employeeId,
        DateOnly? startDate,
        DateOnly? endDate,
        Guid companyId, 
        CancellationToken cancellationToken = default);
    
    Task<bool> ValidateFreezeLimitAsync(
        Guid employeeId, 
        DateOnly date,
        int maxFreezesPerWeek,
        CancellationToken cancellationToken = default);
}
*/
