namespace YallaBusinessAdmin.Application.Dashboard.Dtos;

public class DashboardResponse
{
    public decimal TotalBudget { get; set; }
    public decimal Forecast { get; set; }
    public int TotalOrders { get; set; }
    public int ActiveOrders { get; set; }
    public int PausedOrders { get; set; }
    public int GuestOrders { get; set; }
    public int ActiveGuestOrders { get; set; }
    public int PausedGuestOrders { get; set; }
    
    // New comparison stats
    public int TodayOrders { get; set; }
    public int YesterdayOrders { get; set; }
    public int OrdersChange { get; set; } // TodayOrders - YesterdayOrders
    public decimal OrdersChangePercent { get; set; }
    
    // Budget stats
    public decimal BudgetConsumptionPercent { get; set; }
    public decimal OverdraftLimit { get; set; }
    public decimal AvailableBudget { get; set; } // TotalBudget + OverdraftLimit
    public bool IsLowBudget { get; set; }
    public string? LowBudgetWarning { get; set; }
    
    // Cutoff info
    public string? CutoffTime { get; set; }
    public bool IsCutoffPassed { get; set; }
    public string? Timezone { get; set; }
}

