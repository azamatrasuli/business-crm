using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using YallaBusinessAdmin.Application.Dashboard;
using YallaBusinessAdmin.Application.Dashboard.Dtos;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services.Dashboard;

/// <summary>
/// Service for retrieving dashboard metrics and statistics.
/// </summary>
public sealed class DashboardMetricsService : IDashboardMetricsService
{
    private readonly AppDbContext _context;
    private readonly ILogger<DashboardMetricsService> _logger;

    /// <summary>
    /// Low budget warning threshold (20% remaining).
    /// </summary>
    private const decimal LowBudgetThreshold = 0.20m;

    public DashboardMetricsService(
        AppDbContext context,
        ILogger<DashboardMetricsService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc />
    public async Task<DashboardResponse> GetDashboardAsync(
        Guid companyId,
        Guid? projectId = null,
        CancellationToken cancellationToken = default)
    {
        _logger.LogDebug(
            "Getting dashboard for company {CompanyId}, project {ProjectId}",
            companyId, projectId);

        var (budget, overdraftLimit, timezone, cutoffTime, currencyCode) =
            await GetBudgetSettingsAsync(companyId, projectId, cancellationToken);

        var ordersStats = await GetOrdersStatisticsAsync(companyId, projectId, cancellationToken);

        var budgetMetrics = CalculateBudgetMetrics(
            budget, overdraftLimit, ordersStats.Forecast, currencyCode);

        var cutoffInfo = CalculateCutoffInfo(cutoffTime, timezone);

        return new DashboardResponse
        {
            TotalBudget = budget,
            Forecast = ordersStats.Forecast,
            TotalOrders = ordersStats.TotalOrders,
            ActiveOrders = ordersStats.ActiveOrders,
            PausedOrders = ordersStats.PausedOrders,
            GuestOrders = ordersStats.GuestOrders,
            ActiveGuestOrders = ordersStats.ActiveGuestOrders,
            PausedGuestOrders = ordersStats.PausedGuestOrders,

            // Comparison stats
            TodayOrders = ordersStats.TodayOrders,
            YesterdayOrders = ordersStats.YesterdayOrders,
            OrdersChange = ordersStats.OrdersChange,
            OrdersChangePercent = ordersStats.OrdersChangePercent,

            // Budget stats
            BudgetConsumptionPercent = budgetMetrics.ConsumptionPercent,
            OverdraftLimit = overdraftLimit,
            AvailableBudget = budgetMetrics.AvailableBudget,
            IsLowBudget = budgetMetrics.IsLowBudget,
            LowBudgetWarning = budgetMetrics.LowBudgetWarning,

            // Cutoff info
            CutoffTime = cutoffInfo.CutoffTimeString,
            IsCutoffPassed = cutoffInfo.IsPassed,
            Timezone = timezone
        };
    }

    private async Task<(decimal Budget, decimal OverdraftLimit, string Timezone, TimeOnly CutoffTime, string CurrencyCode)>
        GetBudgetSettingsAsync(Guid companyId, Guid? projectId, CancellationToken cancellationToken)
    {
        if (projectId.HasValue)
        {
            var project = await _context.Projects
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == projectId.Value && p.CompanyId == companyId, cancellationToken)
                ?? throw new KeyNotFoundException("Проект не найден");

            return (
                project.Budget,
                project.OverdraftLimit,
                project.Timezone ?? TimezoneHelper.DefaultTimezone,
                project.CutoffTime,
                project.CurrencyCode ?? "TJS"
            );
        }

        var company = await _context.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken)
            ?? throw new KeyNotFoundException("Компания не найдена");

        return (
            company.Budget,
            company.OverdraftLimit,
            company.Timezone ?? TimezoneHelper.DefaultTimezone,
            company.CutoffTime,
            company.CurrencyCode ?? "TJS"
        );
    }

    private async Task<OrdersStatistics> GetOrdersStatisticsAsync(
        Guid companyId, Guid? projectId, CancellationToken cancellationToken)
    {
        var query = _context.Orders
            .AsNoTracking()
            .Where(o => o.CompanyId == companyId);

        if (projectId.HasValue)
        {
            query = query.Where(o => o.ProjectId == projectId.Value);
        }

        var orders = await query.ToListAsync(cancellationToken);

        var today = DateTime.UtcNow.Date;
        var yesterday = today.AddDays(-1);

        var activeOrders = orders.Count(o => o.Status == OrderStatus.Active);
        var pausedOrders = orders.Count(o => o.Status == OrderStatus.Paused);
        var guestOrders = orders.Count(o => o.IsGuestOrder);
        var activeGuestOrders = orders.Count(o => o.IsGuestOrder && o.Status == OrderStatus.Active);
        var pausedGuestOrders = orders.Count(o => o.IsGuestOrder && o.Status == OrderStatus.Paused);

        var forecast = orders
            .Where(o => o.Status == OrderStatus.Active)
            .Sum(o => o.Price);

        var todayOrders = orders.Count(o => o.OrderDate.Date == today);
        var yesterdayOrders = orders.Count(o => o.OrderDate.Date == yesterday);
        var ordersChange = todayOrders - yesterdayOrders;
        var ordersChangePercent = yesterdayOrders > 0
            ? Math.Round((decimal)ordersChange / yesterdayOrders * 100, 1)
            : 0;

        return new OrdersStatistics(
            TotalOrders: orders.Count,
            ActiveOrders: activeOrders,
            PausedOrders: pausedOrders,
            GuestOrders: guestOrders,
            ActiveGuestOrders: activeGuestOrders,
            PausedGuestOrders: pausedGuestOrders,
            Forecast: forecast,
            TodayOrders: todayOrders,
            YesterdayOrders: yesterdayOrders,
            OrdersChange: ordersChange,
            OrdersChangePercent: ordersChangePercent
        );
    }

    private static BudgetMetrics CalculateBudgetMetrics(
        decimal budget, decimal overdraftLimit, decimal forecast, string currencyCode)
    {
        var availableBudget = budget + overdraftLimit;
        var totalBudgetWithOverdraft = budget > 0 ? budget : availableBudget;
        var consumptionPercent = totalBudgetWithOverdraft > 0
            ? Math.Round(forecast / totalBudgetWithOverdraft * 100, 1)
            : 0;

        var isLowBudget = budget <= 0 ||
            (availableBudget > 0 && budget / availableBudget < LowBudgetThreshold);

        string? lowBudgetWarning = null;
        if (budget <= 0)
        {
            lowBudgetWarning = budget < 0
                ? $"Бюджет отрицательный: {budget:N0} {currencyCode}. Используется овердрафт."
                : "Бюджет исчерпан. Пополните счет.";
        }
        else if (isLowBudget)
        {
            var remainingPercent = availableBudget > 0
                ? Math.Round(budget / availableBudget * 100)
                : 0;
            lowBudgetWarning = $"Низкий остаток бюджета: {budget:N0} {currencyCode} ({remainingPercent}%)";
        }

        return new BudgetMetrics(
            ConsumptionPercent: consumptionPercent,
            AvailableBudget: availableBudget,
            IsLowBudget: isLowBudget,
            LowBudgetWarning: lowBudgetWarning
        );
    }

    private static CutoffInfo CalculateCutoffInfo(TimeOnly cutoffTime, string timezone)
    {
        var isPassed = TimezoneHelper.IsCutoffPassed(cutoffTime, timezone);
        return new CutoffInfo(
            CutoffTimeString: cutoffTime.ToString("HH:mm"),
            IsPassed: isPassed
        );
    }

    private record OrdersStatistics(
        int TotalOrders,
        int ActiveOrders,
        int PausedOrders,
        int GuestOrders,
        int ActiveGuestOrders,
        int PausedGuestOrders,
        decimal Forecast,
        int TodayOrders,
        int YesterdayOrders,
        int OrdersChange,
        decimal OrdersChangePercent);

    private record BudgetMetrics(
        decimal ConsumptionPercent,
        decimal AvailableBudget,
        bool IsLowBudget,
        string? LowBudgetWarning);

    private record CutoffInfo(
        string CutoffTimeString,
        bool IsPassed);
}

