using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Employees;
using YallaBusinessAdmin.Application.Employees.Dtos;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

/// <summary>
/// Service for managing employee order history.
/// Extracted from EmployeesService for SRP compliance.
/// </summary>
public class EmployeeOrderHistoryService : IEmployeeOrderHistoryService
{
    private readonly AppDbContext _context;

    public EmployeeOrderHistoryService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<EmployeeOrderResponse>> GetOrderHistoryAsync(
        Guid employeeId, 
        int page, 
        int pageSize, 
        Guid companyId,
        string? dateFrom = null,
        string? dateTo = null,
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        var employee = await _context.Employees
            .FirstOrDefaultAsync(e => e.Id == employeeId && e.CompanyId == companyId, cancellationToken);

        if (employee == null)
        {
            throw new KeyNotFoundException("Сотрудник не найден");
        }

        var results = new List<EmployeeOrderResponse>();
        
        // BUSINESS RULE: Load orders ONLY for employee's ServiceType
        var employeeServiceType = employee.ServiceType;

        // 1. Load LUNCH orders (only if ServiceType is LUNCH or not set)
        if (employeeServiceType == null || employeeServiceType == ServiceType.Lunch)
        {
            var ordersQuery = _context.Orders
                .Include(o => o.Project)
                .Where(o => o.EmployeeId == employeeId);

            // Apply date range filter
            if (!string.IsNullOrWhiteSpace(dateFrom) && DateTime.TryParse(dateFrom, out var fromDate))
            {
                ordersQuery = ordersQuery.Where(o => o.OrderDate >= fromDate.Date);
            }
            if (!string.IsNullOrWhiteSpace(dateTo) && DateTime.TryParse(dateTo, out var toDate))
            {
                ordersQuery = ordersQuery.Where(o => o.OrderDate <= toDate.Date);
            }

            // Apply status filter - if no status specified, exclude cancelled orders by default
            if (!string.IsNullOrWhiteSpace(status))
            {
                var orderStatus = OrderStatusExtensions.FromRussian(status);
                ordersQuery = ordersQuery.Where(o => o.Status == orderStatus);
            }
            else
            {
                // By default, don't show cancelled orders in history
                ordersQuery = ordersQuery.Where(o => o.Status != OrderStatus.Cancelled);
            }

            var lunchOrders = await ordersQuery.ToListAsync(cancellationToken);

            results.AddRange(lunchOrders.Select(o => new EmployeeOrderResponse
            {
                Id = o.Id,
                Date = o.OrderDate.ToString("yyyy-MM-dd"),
                Type = o.IsGuestOrder ? "Гость" : "Сотрудник",
                Status = o.Status.ToRussian(),
                Amount = o.Price,
                // Use AddressFullAddress with fallback to AddressName for consistency
                Address = !string.IsNullOrEmpty(o.Project?.AddressFullAddress) 
                    ? o.Project.AddressFullAddress 
                    : (o.Project?.AddressName ?? ""),
                ServiceType = "LUNCH",
                ComboType = o.ComboType
            }));
        }

        // 2. Load COMPENSATION transactions (only if ServiceType is COMPENSATION)
        if (employeeServiceType == ServiceType.Compensation)
        {
            var compQuery = _context.CompensationTransactions
                .Include(ct => ct.Project)
                .Where(ct => ct.EmployeeId == employeeId);

            // Apply date range filter
            if (!string.IsNullOrWhiteSpace(dateFrom) && DateOnly.TryParse(dateFrom, out var compFromDate))
            {
                compQuery = compQuery.Where(ct => ct.TransactionDate >= compFromDate);
            }
            if (!string.IsNullOrWhiteSpace(dateTo) && DateOnly.TryParse(dateTo, out var compToDate))
            {
                compQuery = compQuery.Where(ct => ct.TransactionDate <= compToDate);
            }

            var compTransactions = await compQuery.ToListAsync(cancellationToken);

            results.AddRange(compTransactions.Select(ct => new EmployeeOrderResponse
            {
                Id = ct.Id,
                Date = ct.TransactionDate.ToString("yyyy-MM-dd"),
                Type = "Сотрудник",
                Status = OrderStatus.Delivered.ToRussian(),  // Compensation transactions are always delivered
                Amount = ct.TotalAmount,
                Address = ct.RestaurantName ?? "",
                ServiceType = "COMPENSATION",
                ComboType = "",
                CompensationLimit = ct.Project?.CompensationDailyLimit ?? 0,
                CompensationSpent = ct.TotalAmount,
                RestaurantName = ct.RestaurantName
            }));
        }

        // Sort and paginate
        var sortedResults = results
            .OrderByDescending(r => r.Date)
            .ToList();

        var total = sortedResults.Count;
        var pagedItems = sortedResults
            .Skip((page - 1) * pageSize)
            .Take(pageSize);

        return PagedResult<EmployeeOrderResponse>.Create(pagedItems, total, page, pageSize);
    }

    public async Task<EmployeeOrderStatsResponse> GetOrderStatsAsync(
        Guid employeeId,
        Guid companyId,
        DateTime? startDate = null,
        DateTime? endDate = null,
        CancellationToken cancellationToken = default)
    {
        var employee = await _context.Employees
            .FirstOrDefaultAsync(e => e.Id == employeeId && e.CompanyId == companyId, cancellationToken);

        if (employee == null)
        {
            throw new KeyNotFoundException("Сотрудник не найден");
        }

        var ordersQuery = _context.Orders.Where(o => o.EmployeeId == employeeId);

        if (startDate.HasValue)
            ordersQuery = ordersQuery.Where(o => o.OrderDate >= startDate.Value);
        if (endDate.HasValue)
            ordersQuery = ordersQuery.Where(o => o.OrderDate <= endDate.Value);

        var orders = await ordersQuery.ToListAsync(cancellationToken);
        
        var thisMonthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
        var thisMonthOrders = orders.Where(o => o.OrderDate >= thisMonthStart).ToList();

        var mostFrequentCombo = orders
            .GroupBy(o => o.ComboType)
            .OrderByDescending(g => g.Count())
            .FirstOrDefault()?.Key ?? "";

        return new EmployeeOrderStatsResponse
        {
            TotalOrders = orders.Count,
            TotalSpent = orders.Sum(o => o.Price),
            AverageOrderAmount = orders.Count > 0 ? orders.Average(o => o.Price) : 0,
            OrdersThisMonth = thisMonthOrders.Count,
            SpentThisMonth = thisMonthOrders.Sum(o => o.Price),
            MostFrequentComboType = mostFrequentCombo
        };
    }

    public async Task<TodayOrderResponse?> GetTodayOrderAsync(
        Guid employeeId,
        Guid companyId,
        CancellationToken cancellationToken = default)
    {
        var today = DateTime.UtcNow.Date;
        
        var todayOrder = await _context.Orders
            .FirstOrDefaultAsync(o => 
                o.EmployeeId == employeeId && 
                o.OrderDate.Date == today,
                cancellationToken);

        if (todayOrder == null)
            return null;

        return new TodayOrderResponse
        {
            OrderId = todayOrder.Id,
            Status = todayOrder.Status.ToRussian(),
            ComboType = todayOrder.ComboType,
            Amount = todayOrder.Price,
            OrderDate = todayOrder.OrderDate
        };
    }
}

