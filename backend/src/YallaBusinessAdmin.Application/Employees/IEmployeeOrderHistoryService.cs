using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Employees.Dtos;

namespace YallaBusinessAdmin.Application.Employees;

/// <summary>
/// Service for managing employee order history.
/// Separated from IEmployeesService for SRP compliance.
/// </summary>
public interface IEmployeeOrderHistoryService
{
    /// <summary>
    /// Gets paginated order history for a specific employee.
    /// Includes both lunch orders and compensation transactions based on employee's service type.
    /// </summary>
    Task<PagedResult<EmployeeOrderResponse>> GetOrderHistoryAsync(
        Guid employeeId, 
        int page, 
        int pageSize, 
        Guid companyId,
        string? dateFrom = null,
        string? dateTo = null,
        string? status = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets order statistics for a specific employee.
    /// </summary>
    Task<EmployeeOrderStatsResponse> GetOrderStatsAsync(
        Guid employeeId,
        Guid companyId,
        DateTime? startDate = null,
        DateTime? endDate = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets today's order status for a specific employee.
    /// </summary>
    Task<TodayOrderResponse?> GetTodayOrderAsync(
        Guid employeeId,
        Guid companyId,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Statistics about employee orders.
/// </summary>
public class EmployeeOrderStatsResponse
{
    public int TotalOrders { get; set; }
    public decimal TotalSpent { get; set; }
    public decimal AverageOrderAmount { get; set; }
    public int OrdersThisMonth { get; set; }
    public decimal SpentThisMonth { get; set; }
    public string MostFrequentComboType { get; set; } = string.Empty;
}

/// <summary>
/// Today's order information for an employee.
/// </summary>
public class TodayOrderResponse
{
    public Guid OrderId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string ComboType { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateTime OrderDate { get; set; }
}

