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

    /// <summary>Employee status: Активный, Деактивирован</summary>
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
    /// Note: Active means IsActive=true, excludes paused subscriptions.
    /// </summary>
    public bool HasActiveLunchSubscription => LunchSubscription?.IsActive == true;

    /// <summary>
    /// Checks if the employee has an existing lunch subscription (active OR paused).
    /// Used to show subscription info in UI even when paused.
    /// Excludes completed/terminated subscriptions.
    /// </summary>
    public bool HasExistingLunchSubscription =>
        LunchSubscription != null &&
        !LunchSubscription.IsCompleted;

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
    public void Deactivate()
    {
        Status = EmployeeStatus.Deactivated;
        UpdatedAt = DateTime.UtcNow;

        // Pause active orders
        foreach (var order in Orders.Where(o => o.Status == OrderStatus.Active && o.OrderDate >= DateTime.UtcNow.Date))
        {
            order.Pause();
        }
    }

    /// <summary>
    /// Soft deletes the employee.
    /// </summary>
    public void SoftDelete()
    {
        DeletedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
        Status = EmployeeStatus.Deactivated;

        // Cancel active orders
        foreach (var order in Orders.Where(o => o.Status == OrderStatus.Active && o.OrderDate >= DateTime.UtcNow.Date))
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
    /// Gets the count of future active/paused orders for this employee.
    /// This is the accurate "remaining days" count.
    /// REQUIRES: Orders navigation property to be loaded!
    /// </summary>
    public int GetFutureOrdersCount()
    {
        if (Orders == null || !Orders.Any())
            return 0;

        var today = DateTime.UtcNow.Date;
        return Orders.Count(o =>
            o.OrderDate.Date >= today &&
            o.Status != Domain.Enums.OrderStatus.Cancelled);
    }
}
