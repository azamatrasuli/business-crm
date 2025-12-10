namespace YallaBusinessAdmin.Application.Dashboard.Dtos;

/// <summary>
/// Dashboard response containing company/project metrics and statistics.
/// </summary>
public class DashboardResponse
{
    /// <summary>Total budget available (company or project).</summary>
    public decimal TotalBudget { get; set; }

    /// <summary>Forecasted spending based on active orders.</summary>
    public decimal Forecast { get; set; }

    /// <summary>Total number of orders.</summary>
    public int TotalOrders { get; set; }

    /// <summary>Number of active orders.</summary>
    public int ActiveOrders { get; set; }

    /// <summary>Number of paused orders.</summary>
    public int PausedOrders { get; set; }

    /// <summary>Number of cancelled orders.</summary>
    public int CancelledOrders { get; set; }

    /// <summary>Total number of guest orders.</summary>
    public int GuestOrders { get; set; }

    /// <summary>Number of active guest orders.</summary>
    public int ActiveGuestOrders { get; set; }

    /// <summary>Number of paused guest orders.</summary>
    public int PausedGuestOrders { get; set; }

    // ═══════════════════════════════════════════════════════════════════════════════
    // Comparison Statistics
    // ═══════════════════════════════════════════════════════════════════════════════

    /// <summary>Number of orders created today.</summary>
    public int TodayOrders { get; set; }

    /// <summary>Number of orders created yesterday.</summary>
    public int YesterdayOrders { get; set; }

    /// <summary>Difference between today and yesterday orders.</summary>
    public int OrdersChange { get; set; }

    /// <summary>Percentage change in orders compared to yesterday.</summary>
    public decimal OrdersChangePercent { get; set; }

    // ═══════════════════════════════════════════════════════════════════════════════
    // Budget Statistics
    // ═══════════════════════════════════════════════════════════════════════════════

    /// <summary>Percentage of budget consumed by active orders.</summary>
    public decimal BudgetConsumptionPercent { get; set; }

    /// <summary>Maximum overdraft limit allowed.</summary>
    public decimal OverdraftLimit { get; set; }

    /// <summary>Total available budget (TotalBudget + OverdraftLimit).</summary>
    public decimal AvailableBudget { get; set; }

    /// <summary>Indicates if budget is low (less than 20% remaining or negative).</summary>
    public bool IsLowBudget { get; set; }

    /// <summary>Warning message when budget is low.</summary>
    public string? LowBudgetWarning { get; set; }

    // ═══════════════════════════════════════════════════════════════════════════════
    // Cutoff Time Information
    // ═══════════════════════════════════════════════════════════════════════════════

    /// <summary>Order cutoff time (HH:mm format).</summary>
    public string? CutoffTime { get; set; }

    /// <summary>Indicates if cutoff time has passed for today.</summary>
    public bool IsCutoffPassed { get; set; }

    /// <summary>Timezone used for cutoff calculations.</summary>
    public string? Timezone { get; set; }
}
