namespace YallaBusinessAdmin.Application.Employees.Dtos;

public class EmployeeResponse
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Position { get; set; }
    public decimal TotalBudget { get; set; }
    public decimal DailyLimit { get; set; }
    public string MealStatus { get; set; } = "Не заказан";
    public string? MealPlan { get; set; }
    public string InviteStatus { get; set; } = "Принято";
    
    /// <summary>Employee status: Активный, Деактивирован, Отпуск</summary>
    public string Status { get; set; } = "Активный";
    
    /// <summary>Backward compatibility - computed from Status</summary>
    public bool IsActive { get; set; }
    
    /// <summary>Project information (REQUIRED - address comes from project)</summary>
    public Guid ProjectId { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    
    /// <summary>Address from project (immutable)</summary>
    public string AddressName { get; set; } = string.Empty;
    public string AddressFullAddress { get; set; } = string.Empty;
    
    // ═══════════════════════════════════════════════════════════════
    // Service Type (attached to employee, not project)
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>Service type for THIS employee (LUNCH or COMPENSATION)</summary>
    public string? ServiceType { get; set; }
    
    /// <summary>Whether employee can switch to COMPENSATION (no active lunch subscription)</summary>
    public bool CanSwitchToCompensation { get; set; }
    
    /// <summary>Whether employee can switch to LUNCH (no active compensation)</summary>
    public bool CanSwitchToLunch { get; set; }
    
    /// <summary>Reason why switching to compensation is blocked (with expiry date)</summary>
    public string? SwitchToCompensationBlockedReason { get; set; }
    
    /// <summary>Reason why switching to lunch is blocked</summary>
    public string? SwitchToLunchBlockedReason { get; set; }
    
    // ═══════════════════════════════════════════════════════════════
    // Work Schedule
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>Type of shift: DAY or NIGHT</summary>
    public string? ShiftType { get; set; }
    
    /// <summary>Working days as array [1,2,3,4,5] where 0=Sun, 1=Mon, etc.</summary>
    public int[]? WorkingDays { get; set; }
    
    /// <summary>Work start time (e.g., "09:00")</summary>
    public string? WorkStartTime { get; set; }
    
    /// <summary>Work end time (e.g., "18:00")</summary>
    public string? WorkEndTime { get; set; }
    
    // ═══════════════════════════════════════════════════════════════
    // Active Subscriptions
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>Active lunch subscription ID (null if no active subscription)</summary>
    public Guid? ActiveLunchSubscriptionId { get; set; }
    
    /// <summary>Active compensation ID (null if no active compensation)</summary>
    public Guid? ActiveCompensationId { get; set; }
    
    /// <summary>Active lunch subscription details</summary>
    public LunchSubscriptionInfo? LunchSubscription { get; set; }
    
    /// <summary>Active compensation details</summary>
    public CompensationInfo? Compensation { get; set; }
    
    public BudgetResponse? Budget { get; set; }
    public OrderInfo? Order { get; set; }
    public string? CreationScenario { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool HasSubscription { get; set; }
}

public class LunchSubscriptionInfo
{
    public Guid Id { get; set; }
    public string ComboType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    
    /// <summary>
    /// Общая стоимость оставшихся (future) заказов.
    /// Рассчитывается динамически: sum(future orders prices)
    /// </summary>
    public decimal? TotalPrice { get; set; }
    
    /// <summary>
    /// Количество оставшихся дней (= FutureOrdersCount).
    /// Это реальное количество будущих заказов, не календарные дни!
    /// </summary>
    public int? RemainingDays { get; set; }
    
    /// <summary>
    /// Общее количество дней подписки (все заказы не отменённые).
    /// Рассчитывается динамически из Orders таблицы.
    /// </summary>
    public int? TotalDays { get; set; }
    
    /// <summary>Тип графика: EVERY_DAY, EVERY_OTHER_DAY, CUSTOM</summary>
    public string ScheduleType { get; set; } = "EVERY_DAY";
    
    /// <summary>Выбранные даты для CUSTOM графика</summary>
    public List<string>? CustomDays { get; set; }
    
    /// <summary>
    /// Количество будущих заказов (включая сегодня) со статусом Active/Frozen.
    /// Это и есть реальное "оставшееся количество дней" для UI.
    /// </summary>
    public int FutureOrdersCount { get; set; }
    
    /// <summary>Количество выполненных заказов (Доставлен/Завершен)</summary>
    public int CompletedOrdersCount { get; set; }
}

public class CompensationInfo
{
    public Guid Id { get; set; }
    public decimal TotalBudget { get; set; }
    public decimal DailyLimit { get; set; }
    public decimal UsedAmount { get; set; }
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public bool CarryOver { get; set; }
    public bool AutoRenew { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class BudgetResponse
{
    public decimal TotalBudget { get; set; }
    public decimal DailyLimit { get; set; }
    public string Period { get; set; } = "в Месяц";
    public bool AutoRenew { get; set; }
}

public class OrderInfo
{
    public string Status { get; set; } = string.Empty;
    public string? Type { get; set; }
}

