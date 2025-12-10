using YallaBusinessAdmin.Domain.Enums;

namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents a lunch subscription template for an employee.
/// This is the "intention" to eat - template for automatic order generation.
/// Address is derived from Project (one project = one address).
/// Maps to table: lunch_subscriptions
/// </summary>
public class LunchSubscription
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public Guid CompanyId { get; set; }

    /// <summary>Project this subscription belongs to (REQUIRED - address comes from project)</summary>
    public Guid ProjectId { get; set; }

    public string ComboType { get; set; } = string.Empty; // 'Комбо 25' or 'Комбо 35'
    public bool IsActive { get; set; } = true;

    // ═══════════════════════════════════════════════════════════════
    // Subscription Period & Pricing
    // ═══════════════════════════════════════════════════════════════

    /// <summary>Дата начала подписки</summary>
    public DateOnly? StartDate { get; set; }

    /// <summary>Дата окончания подписки</summary>
    public DateOnly? EndDate { get; set; }

    /// <summary>Общее количество дней подписки</summary>
    public int TotalDays { get; set; }

    /// <summary>Общая стоимость подписки</summary>
    public decimal TotalPrice { get; set; }

    /// <summary>Статус: Активна, Приостановлена, Завершена</summary>
    public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Active;

    /// <summary>Тип графика: EVERY_DAY, EVERY_OTHER_DAY, CUSTOM</summary>
    public string ScheduleType { get; set; } = "EVERY_DAY";

    /// <summary>Когда подписка была приостановлена</summary>
    public DateTime? PausedAt { get; set; }

    /// <summary>Количество дней на паузе (переносятся в конец)</summary>
    public int PausedDaysCount { get; set; }

    // Timestamps
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation properties
    public Employee? Employee { get; set; }
    public Company? Company { get; set; }
    public Project? Project { get; set; }

    // ═══════════════════════════════════════════════════════════════
    // RICH DOMAIN MODEL - Business Logic Methods
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Checks if the subscription is currently paused (temporarily).
    /// </summary>
    public bool IsPaused => Status == SubscriptionStatus.Paused || PausedAt.HasValue;
    
    /// <summary>
    /// Checks if the subscription is completed/deactivated (permanently).
    /// </summary>
    public bool IsCompleted => Status == SubscriptionStatus.Completed;

    /// <summary>
    /// Checks if the subscription has expired.
    /// </summary>
    public bool IsExpired => EndDate.HasValue && EndDate.Value < DateOnly.FromDateTime(DateTime.UtcNow);

    /// <summary>
    /// Checks if the subscription can be paused.
    /// Business rule: Can pause only active subscriptions that are not completed.
    /// </summary>
    public bool CanBePaused => IsActive && !IsPaused && !IsCompleted && !IsExpired;

    /// <summary>
    /// Checks if the subscription can be resumed.
    /// Business rule: Can resume only paused (not completed) subscriptions that haven't expired.
    /// Completed subscriptions cannot be resumed - must create a new subscription.
    /// </summary>
    public bool CanBeResumed => IsPaused && !IsCompleted && !IsExpired;

    /// <summary>
    /// Deactivates the subscription permanently (sets status to Completed).
    /// Use Pause() for temporary pause.
    /// </summary>
    public void Deactivate()
    {
        IsActive = false;
        Status = SubscriptionStatus.Completed;  // Permanent deactivation
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Pauses the subscription with business rule validation.
    /// </summary>
    /// <exception cref="InvalidOperationException">Thrown when the subscription cannot be paused.</exception>
    public void Pause()
    {
        if (!CanBePaused)
        {
            throw new InvalidOperationException("Невозможно приостановить подписку. Можно приостановить только активные подписки.");
        }

        PausedAt = DateTime.UtcNow;
        Status = SubscriptionStatus.Paused;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Resumes a paused subscription with business rule validation.
    /// </summary>
    /// <exception cref="InvalidOperationException">Thrown when the subscription cannot be resumed.</exception>
    public void Resume()
    {
        if (!CanBeResumed)
        {
            throw new InvalidOperationException("Невозможно возобновить подписку. Можно возобновить только приостановленные подписки.");
        }

        // Calculate paused days and extend end date
        if (PausedAt.HasValue && EndDate.HasValue)
        {
            var pausedDays = (DateTime.UtcNow - PausedAt.Value).Days;
            PausedDaysCount += pausedDays;
            EndDate = EndDate.Value.AddDays(pausedDays);
        }

        PausedAt = null;
        Status = SubscriptionStatus.Active;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Extends the subscription end date by the specified number of days.
    /// </summary>
    /// <param name="days">Number of days to extend.</param>
    /// <exception cref="InvalidOperationException">Thrown when EndDate is not set.</exception>
    public void ExtendByDays(int days)
    {
        if (days <= 0)
            throw new ArgumentException("Количество дней должно быть положительным", nameof(days));

        if (!EndDate.HasValue)
            throw new InvalidOperationException("Cannot extend subscription without EndDate set. Set EndDate first.");

        EndDate = EndDate.Value.AddDays(days);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Changes the combo type.
    /// </summary>
    /// <param name="newComboType">The new combo type.</param>
    public void ChangeComboType(string newComboType)
    {
        if (string.IsNullOrWhiteSpace(newComboType))
            throw new ArgumentException("Тип комбо не может быть пустым", nameof(newComboType));

        ComboType = newComboType;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Factory method to create a new subscription.
    /// </summary>
    /// <param name="employeeId">Employee ID</param>
    /// <param name="companyId">Company ID</param>
    /// <param name="projectId">Project ID (determines delivery address)</param>
    /// <param name="comboType">'Комбо 25' or 'Комбо 35'</param>
    /// <param name="startDate">Subscription start date (inclusive)</param>
    /// <param name="endDate">Subscription end date (inclusive) - should be calculated by caller based on working days</param>
    /// <param name="totalDays">Total days count (dynamically calculated from Orders table)</param>
    /// <param name="totalPrice">Total price (dynamically calculated from Orders table)</param>
    /// <param name="scheduleType">EVERY_DAY, EVERY_OTHER_DAY, or CUSTOM</param>
    public static LunchSubscription Create(
        Guid employeeId,
        Guid companyId,
        Guid projectId,
        string comboType,
        DateOnly startDate,
        DateOnly endDate,
        int totalDays,
        decimal totalPrice,
        string scheduleType = "EVERY_DAY")
    {
        // Validate dates
        if (endDate < startDate)
            throw new ArgumentException("End date cannot be before start date", nameof(endDate));
            
        // Normalize schedule type (WEEKDAYS → EVERY_DAY)
        var normalizedScheduleType = Helpers.ScheduleTypeHelper.Normalize(scheduleType);
        
        return new LunchSubscription
        {
            Id = Guid.NewGuid(),
            EmployeeId = employeeId,
            CompanyId = companyId,
            ProjectId = projectId,
            ComboType = comboType,
            IsActive = true,
            StartDate = startDate,
            EndDate = endDate,
            TotalDays = totalDays,
            TotalPrice = totalPrice,
            Status = SubscriptionStatus.Active,
            ScheduleType = normalizedScheduleType,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }
}
