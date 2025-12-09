using YallaBusinessAdmin.Domain.Enums;

namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents an employee (meal consumer) in the system.
/// Every employee MUST belong to a project (address is derived from project).
/// Maps to table: employees
/// </summary>
public class Employee
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    
    /// <summary>Project this employee belongs to (REQUIRED - address comes from project)</summary>
    public Guid ProjectId { get; set; }
    
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Position { get; set; }
    
    /// <summary>Employee status: Активный, Деактивирован, Отпуск</summary>
    public EmployeeStatus Status { get; set; } = EmployeeStatus.Active;
    
    /// <summary>Computed property for backward compatibility</summary>
    public bool IsActive => Status == EmployeeStatus.Active;
    
    public EmployeeInviteStatus InviteStatus { get; set; } = EmployeeInviteStatus.Accepted;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    
    // ═══════════════════════════════════════════════════════════════
    // Service Type (attached to employee, not project)
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>Type of service for this employee: LUNCH or COMPENSATION</summary>
    public ServiceType? ServiceType { get; set; }
    
    // ═══════════════════════════════════════════════════════════════
    // Work Schedule
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>Type of shift: Day or Night</summary>
    public ShiftType? ShiftType { get; set; }
    
    /// <summary>Working days as JSON array [1,2,3,4,5] where 0=Sun, 1=Mon, etc.</summary>
    public int[]? WorkingDays { get; set; }
    
    /// <summary>Work start time (e.g., "09:00")</summary>
    public TimeOnly? WorkStartTime { get; set; }
    
    /// <summary>Work end time (e.g., "18:00")</summary>
    public TimeOnly? WorkEndTime { get; set; }

    // Navigation properties
    public Company? Company { get; set; }
    public Project? Project { get; set; }
    public EmployeeBudget? Budget { get; set; }
    public LunchSubscription? LunchSubscription { get; set; }
    public ICollection<Order> Orders { get; set; } = new List<Order>();
    
    // ═══════════════════════════════════════════════════════════════
    // RICH DOMAIN MODEL - Business Logic Methods
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>
    /// Checks if the employee is deleted (soft delete).
    /// </summary>
    public bool IsDeleted => DeletedAt.HasValue;
    
    /// <summary>
    /// Checks if the employee has an active lunch subscription.
    /// </summary>
    public bool HasActiveLunchSubscription => LunchSubscription?.IsActive == true;
    
    /// <summary>
    /// Checks if the employee can switch to compensation service type.
    /// Business rule: Cannot switch if active lunch subscription exists.
    /// </summary>
    public bool CanSwitchToCompensation => !HasActiveLunchSubscription;
    
    /// <summary>
    /// Checks if the employee is working today based on their schedule.
    /// </summary>
    public bool IsWorkingToday()
    {
        if (WorkingDays == null || WorkingDays.Length == 0)
            return true; // No schedule defined = works every day
            
        var todayDayOfWeek = (int)DateTime.UtcNow.DayOfWeek;
        return WorkingDays.Contains(todayDayOfWeek);
    }
    
    /// <summary>
    /// Checks if the employee is currently within working hours.
    /// </summary>
    public bool IsWithinWorkingHours()
    {
        if (!WorkStartTime.HasValue || !WorkEndTime.HasValue)
            return true; // No hours defined = always working
            
        var now = TimeOnly.FromDateTime(DateTime.UtcNow);
        return now >= WorkStartTime.Value && now <= WorkEndTime.Value;
    }
    
    /// <summary>
    /// Activates the employee.
    /// </summary>
    public void Activate()
    {
        Status = EmployeeStatus.Active;
        UpdatedAt = DateTime.UtcNow;
    }
    
    /// <summary>
    /// Deactivates the employee and pauses all their active orders.
    /// </summary>
    /// <remarks>
    /// WARNING: Uses UTC for date comparison. For timezone-accurate handling,
    /// the service layer should call this method with orders already loaded
    /// using the correct timezone boundaries.
    /// </remarks>
    public void Deactivate()
    {
        Status = EmployeeStatus.Deactivated;
        UpdatedAt = DateTime.UtcNow;
        
        // Pause active orders
        // NOTE: Using UTC - service layer should ensure correct orders are loaded
        var todayUtc = DateTime.UtcNow.Date;
        foreach (var order in Orders.Where(o => o.Status == OrderStatus.Active && o.OrderDate >= todayUtc))
        {
            order.Pause();
        }
    }
    
    /// <summary>
    /// Sets the employee on vacation.
    /// </summary>
    /// <remarks>
    /// WARNING: Uses UTC for date comparison. For timezone-accurate handling,
    /// the service layer should call this method with orders already loaded
    /// using the correct timezone boundaries.
    /// </remarks>
    public void SetVacation()
    {
        Status = EmployeeStatus.Vacation;
        UpdatedAt = DateTime.UtcNow;
        
        // Pause active orders while on vacation
        // NOTE: Using UTC - service layer should ensure correct orders are loaded
        var todayUtc = DateTime.UtcNow.Date;
        foreach (var order in Orders.Where(o => o.Status == OrderStatus.Active && o.OrderDate >= todayUtc))
        {
            order.Pause();
        }
    }
    
    /// <summary>
    /// Soft deletes the employee.
    /// </summary>
    /// <remarks>
    /// WARNING: Uses UTC for date comparison. For timezone-accurate handling,
    /// the service layer should call this method with orders already loaded
    /// using the correct timezone boundaries.
    /// </remarks>
    public void SoftDelete()
    {
        DeletedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
        Status = EmployeeStatus.Deactivated;
        
        // Cancel active orders
        // NOTE: Using UTC - service layer should ensure correct orders are loaded
        var todayUtc = DateTime.UtcNow.Date;
        foreach (var order in Orders.Where(o => o.Status == OrderStatus.Active && o.OrderDate >= todayUtc))
        {
            order.Complete();
        }
        
        // Deactivate subscription
        if (LunchSubscription != null)
        {
            LunchSubscription.Deactivate();
        }
    }
    
    /// <summary>
    /// Switches service type with business rule validation.
    /// </summary>
    /// <param name="newServiceType">The new service type to switch to.</param>
    /// <exception cref="InvalidOperationException">Thrown when switching to compensation while having active lunch subscription.</exception>
    public void SwitchServiceType(ServiceType newServiceType)
    {
        if (newServiceType == Enums.ServiceType.Compensation && HasActiveLunchSubscription)
        {
            throw new InvalidOperationException(
                "Невозможно переключиться на Компенсацию: у сотрудника активная подписка на обеды. " +
                "Сначала отмените или дождитесь окончания подписки.");
        }
        
        ServiceType = newServiceType;
        UpdatedAt = DateTime.UtcNow;
    }
    
    /// <summary>
    /// Validates the phone format.
    /// </summary>
    public static bool IsValidPhoneFormat(string phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return false;
        if (!phone.StartsWith('+')) return false;
        
        var digitsOnly = phone.Substring(1);
        if (digitsOnly.Length < 10 || digitsOnly.Length > 15) return false;
        
        return digitsOnly.All(char.IsDigit);
    }
    
    /// <summary>
    /// DEPRECATED: Returns calendar days until subscription EndDate, NOT actual remaining orders!
    /// Use futureOrdersCount from API response for accurate remaining days.
    /// This counts all calendar days (including weekends and holidays).
    /// </summary>
    /// <remarks>
    /// For accurate "remaining days" (actual future orders), the service layer counts:
    /// <c>Orders.Count(o =&gt; o.Status != Cancelled &amp;&amp; o.OrderDate &gt;= today)</c>
    /// WARNING: Uses UTC for date comparison. For timezone-accurate calculations,
    /// use the service layer with TimezoneHelper.
    /// </remarks>
    [Obsolete("Use futureOrdersCount from API response. This returns calendar days, not actual order count.")]
    public int? GetSubscriptionRemainingDaysCalendar()
    {
        if (!HasActiveLunchSubscription || LunchSubscription?.EndDate == null)
            return null;
        
        // NOTE: Uses UTC, may be off by 1 day in local timezone (Asia/Dushanbe UTC+5)
        // This method is deprecated - use GetFutureOrdersCount() or service layer for accurate counts
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return Math.Max(0, LunchSubscription.EndDate.Value.DayNumber - today.DayNumber);
    }
    
    /// <summary>
    /// Gets the count of future active/frozen orders for this employee.
    /// This is the accurate "remaining days" count.
    /// REQUIRES: Orders navigation property to be loaded!
    /// </summary>
    /// <remarks>
    /// WARNING: Uses UTC for date comparison. For timezone-accurate calculations,
    /// use the service layer with TimezoneHelper.GetLocalToday(project.Timezone).
    /// </remarks>
    public int GetFutureOrdersCount()
    {
        if (Orders == null || !Orders.Any())
            return 0;
        
        // NOTE: Using UTC - service layer should ensure correct orders are loaded
        var todayUtc = DateTime.UtcNow.Date;
        return Orders.Count(o => 
            o.OrderDate.Date >= todayUtc &&
            o.Status != Domain.Enums.OrderStatus.Cancelled);
    }
}
