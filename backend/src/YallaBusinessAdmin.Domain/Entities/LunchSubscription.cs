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
    
    // Timestamps
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation properties
    public Employee? Employee { get; set; }
    public Company? Company { get; set; }
    public Project? Project { get; set; }
}

