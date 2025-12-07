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
    public string Status { get; set; } = "Активна";

    /// <summary>Тип графика: EVERY_DAY, EVERY_OTHER_DAY, CUSTOM</summary>
    public string ScheduleType { get; set; } = "EVERY_DAY";

    /// <summary>Когда подписка была приостановлена</summary>
    public DateTime? PausedAt { get; set; }

    /// <summary>Количество дней на паузе (переносятся в конец)</summary>
    public int PausedDaysCount { get; set; }

    /// <summary>Оригинальная дата окончания подписки (до заморозок)</summary>
    public DateOnly? OriginalEndDate { get; set; }

    /// <summary>Количество замороженных заказов (отдельных дней)</summary>
    public int FrozenDaysCount { get; set; }

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
    /// Checks if the subscription is currently paused.
    /// </summary>
    public bool IsPaused => Status == "Приостановлена" || PausedAt.HasValue;

    /// <summary>
    /// Checks if the subscription has expired.
    /// </summary>
    public bool IsExpired => EndDate.HasValue && EndDate.Value < DateOnly.FromDateTime(DateTime.UtcNow);

    /// <summary>
    /// Gets the remaining days in the subscription.
    /// </summary>
    public int RemainingDays
    {
        get
        {
            if (!EndDate.HasValue) return 0;
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            return Math.Max(0, EndDate.Value.DayNumber - today.DayNumber);
        }
    }

    /// <summary>
    /// Checks if the subscription can be paused.
    /// Business rule: Can pause only active subscriptions.
    /// </summary>
    public bool CanBePaused => IsActive && !IsPaused && !IsExpired;

    /// <summary>
    /// Checks if the subscription can be resumed.
    /// Business rule: Can resume only paused subscriptions that haven't expired.
    /// </summary>
    public bool CanBeResumed => IsPaused && !IsExpired;

    /// <summary>
    /// Deactivates the subscription.
    /// </summary>
    public void Deactivate()
    {
        IsActive = false;
        Status = "Завершена";
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
        Status = "Приостановлена";
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
        Status = "Активна";
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Extends the subscription by the specified number of days.
    /// </summary>
    /// <param name="days">Number of days to extend.</param>
    public void ExtendByDays(int days)
    {
        if (days <= 0)
            throw new ArgumentException("Количество дней должно быть положительным", nameof(days));

        if (EndDate.HasValue)
        {
            EndDate = EndDate.Value.AddDays(days);
        }
        else
        {
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(days);
        }

        TotalDays += days;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Продлевает подписку на 1 день при заморозке заказа.
    /// Сохраняет оригинальную дату окончания если ещё не сохранена.
    /// </summary>
    public void ExtendByFrozenOrder()
    {
        // Сохраняем оригинальную дату окончания при первой заморозке
        if (!OriginalEndDate.HasValue && EndDate.HasValue)
        {
            OriginalEndDate = EndDate.Value;
        }

        FrozenDaysCount++;

        if (EndDate.HasValue)
        {
            EndDate = EndDate.Value.AddDays(1);
        }

        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Сокращает подписку на 1 день при разморозке заказа.
    /// </summary>
    public void ShrinkByUnfrozenOrder()
    {
        if (FrozenDaysCount <= 0)
            return;

        FrozenDaysCount--;

        if (EndDate.HasValue)
        {
            EndDate = EndDate.Value.AddDays(-1);
        }

        // Если все заморозки отменены, очищаем OriginalEndDate
        if (FrozenDaysCount == 0)
        {
            OriginalEndDate = null;
        }

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
    public static LunchSubscription Create(
        Guid employeeId,
        Guid companyId,
        Guid projectId,
        string comboType,
        DateOnly startDate,
        int totalDays,
        decimal totalPrice,
        string scheduleType = "EVERY_DAY")
    {
        return new LunchSubscription
        {
            Id = Guid.NewGuid(),
            EmployeeId = employeeId,
            CompanyId = companyId,
            ProjectId = projectId,
            ComboType = comboType,
            IsActive = true,
            StartDate = startDate,
            EndDate = startDate.AddDays(totalDays),
            TotalDays = totalDays,
            TotalPrice = totalPrice,
            Status = "Активна",
            ScheduleType = scheduleType,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }
}

