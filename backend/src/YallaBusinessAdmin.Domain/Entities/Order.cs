using YallaBusinessAdmin.Domain.Enums;

namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents a daily meal order in the system.
/// Address is derived from Project (one project = one address).
/// Maps to table: orders (conceptually daily_orders per spec)
/// </summary>
public class Order
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    
    /// <summary>Project this order belongs to (REQUIRED - address comes from project)</summary>
    public Guid ProjectId { get; set; }
    
    public Guid? EmployeeId { get; set; }
    
    // Guest order fields
    public string? GuestName { get; set; }
    public bool IsGuestOrder { get; set; }
    public Guid? CreatedByUserId { get; set; } // Admin who created guest order (for audit)
    
    // Order details
    public string ComboType { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string CurrencyCode { get; set; } = "TJS";
    public OrderStatus Status { get; set; } = OrderStatus.Active;
    public DateTime OrderDate { get; set; }
    
    // Freeze-related fields
    /// <summary>Когда заказ был заморожен</summary>
    public DateTime? FrozenAt { get; set; }
    
    /// <summary>Причина заморозки</summary>
    public string? FrozenReason { get; set; }
    
    /// <summary>ID заменяющего заказа (создаётся в конце подписки)</summary>
    public Guid? ReplacementOrderId { get; set; }
    
    // Timestamps
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation properties
    public Company? Company { get; set; }
    public Project? Project { get; set; }
    public Employee? Employee { get; set; }
    public AdminUser? CreatedByUser { get; set; }
    public ICollection<CompanyTransaction> Transactions { get; set; } = new List<CompanyTransaction>();
    
    /// <summary>Заменяющий заказ (создан при заморозке)</summary>
    public Order? ReplacementOrder { get; set; }
    
    // ═══════════════════════════════════════════════════════════════
    // RICH DOMAIN MODEL - Business Logic Methods
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>
    /// Checks if the order is for today (APPROXIMATE - uses UTC).
    /// WARNING: For accurate timezone-aware checks, use TimezoneHelper.IsToday() in service layer.
    /// </summary>
    /// <remarks>
    /// This property uses UTC time and may not be accurate for edge cases near midnight.
    /// Always use TimezoneHelper.IsToday(orderDate, project.Timezone) for business-critical validations.
    /// </remarks>
    [Obsolete("Use TimezoneHelper.IsToday() for timezone-accurate checks")]
    public bool IsForToday => OrderDate.Date == DateTime.UtcNow.Date;
    
    /// <summary>
    /// Checks if the order is active (can be modified).
    /// </summary>
    public bool IsActive => Status == OrderStatus.Active;
    
    /// <summary>
    /// Checks if the order is frozen.
    /// </summary>
    public bool IsFrozen => Status == OrderStatus.Frozen;
    
    /// <summary>
    /// Checks if the order is in the past (APPROXIMATE - uses UTC).
    /// WARNING: For accurate timezone-aware checks, use TimezoneHelper.IsPastDate() in service layer.
    /// </summary>
    /// <remarks>
    /// This property uses UTC time. It's conservative - an order that appears "past" in UTC
    /// might still be "today" in a local timezone, which is safe for preventing modifications
    /// to past orders but may block some valid operations near midnight.
    /// </remarks>
    public bool IsPastOrderUtc => OrderDate.Date < DateTime.UtcNow.Date;
    
    /// <summary>
    /// Checks if the order can be cancelled.
    /// Business rule: Can cancel only active orders for today or future.
    /// NOTE: Uses UTC-based check. Service layer should add timezone-accurate cutoff validation.
    /// </summary>
    public bool CanBeCancelled => IsActive && !IsPastOrderUtc;
    
    /// <summary>
    /// Checks if the order can be modified.
    /// Business rule: Can modify only active orders for today or future.
    /// NOTE: Uses UTC-based check. Service layer should add timezone-accurate cutoff validation.
    /// </summary>
    public bool CanBeModified => IsActive && !IsPastOrderUtc;
    
    /// <summary>
    /// Pauses the order.
    /// </summary>
    public void Pause()
    {
        if (Status != OrderStatus.Active)
            return;
            
        Status = OrderStatus.Paused;
        UpdatedAt = DateTime.UtcNow;
    }
    
    /// <summary>
    /// Resumes a paused order.
    /// </summary>
    public void Resume()
    {
        if (Status != OrderStatus.Paused)
            return;
            
        Status = OrderStatus.Active;
        UpdatedAt = DateTime.UtcNow;
    }
    
    /// <summary>
    /// Completes the order.
    /// </summary>
    public void Complete()
    {
        Status = OrderStatus.Completed;
        UpdatedAt = DateTime.UtcNow;
    }
    
    /// <summary>
    /// Cancels the order with business rule validation.
    /// </summary>
    /// <exception cref="InvalidOperationException">Thrown when the order cannot be cancelled.</exception>
    public void Cancel()
    {
        if (!CanBeCancelled)
        {
            throw new InvalidOperationException("Невозможно отменить заказ. Заказы можно отменять только на текущий или будущий день.");
        }
        
        Status = OrderStatus.Cancelled;
        UpdatedAt = DateTime.UtcNow;
    }
    
    /// <summary>
    /// Checks if the order can be frozen.
    /// Business rule: Can freeze only active orders for today or future.
    /// </summary>
    public bool CanBeFrozen => IsActive && !IsPastOrderUtc;
    
    /// <summary>
    /// Checks if the order can be unfrozen.
    /// Business rule: Can unfreeze only frozen orders for today or future.
    /// </summary>
    public bool CanBeUnfrozen => IsFrozen && !IsPastOrderUtc;
    
    /// <summary>
    /// Freezes the order (отмена обеда с переносом в конец подписки).
    /// </summary>
    /// <param name="reason">Причина заморозки</param>
    /// <exception cref="InvalidOperationException">Thrown when the order cannot be frozen.</exception>
    public void Freeze(string? reason = null)
    {
        if (!CanBeFrozen)
        {
            throw new InvalidOperationException("Невозможно заморозить заказ. Заказы можно замораживать только активные на текущий или будущий день.");
        }
        
        Status = OrderStatus.Frozen;
        FrozenAt = DateTime.UtcNow;
        FrozenReason = reason;
        UpdatedAt = DateTime.UtcNow;
    }
    
    /// <summary>
    /// Unfreezes the order (возврат в активное состояние).
    /// </summary>
    /// <exception cref="InvalidOperationException">Thrown when the order cannot be unfrozen.</exception>
    public void Unfreeze()
    {
        if (!CanBeUnfrozen)
        {
            throw new InvalidOperationException("Невозможно разморозить заказ. Можно разморозить только замороженные заказы на текущий или будущий день.");
        }
        
        Status = OrderStatus.Active;
        FrozenAt = null;
        FrozenReason = null;
        UpdatedAt = DateTime.UtcNow;
    }
    
    /// <summary>
    /// Changes the combo type with business rule validation.
    /// </summary>
    /// <param name="newComboType">The new combo type.</param>
    /// <exception cref="InvalidOperationException">Thrown when the order cannot be modified.</exception>
    public void ChangeComboType(string newComboType)
    {
        if (!CanBeModified)
        {
            throw new InvalidOperationException("Невозможно изменить заказ. Заказы можно изменять только на текущий или будущий день.");
        }
        
        ComboType = newComboType;
        UpdatedAt = DateTime.UtcNow;
    }
    
    /// <summary>
    /// Creates a new order for an employee.
    /// </summary>
    public static Order CreateForEmployee(
        Guid companyId,
        Guid projectId,
        Guid employeeId,
        string comboType,
        decimal price,
        DateTime orderDate)
    {
        return new Order
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            ProjectId = projectId,
            EmployeeId = employeeId,
            ComboType = comboType,
            Price = price,
            OrderDate = orderDate,
            IsGuestOrder = false,
            Status = OrderStatus.Active,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }
    
    /// <summary>
    /// Creates a guest order.
    /// </summary>
    public static Order CreateGuestOrder(
        Guid companyId,
        Guid projectId,
        string guestName,
        string comboType,
        decimal price,
        DateTime orderDate,
        Guid createdByUserId)
    {
        return new Order
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            ProjectId = projectId,
            GuestName = guestName,
            ComboType = comboType,
            Price = price,
            OrderDate = orderDate,
            IsGuestOrder = true,
            CreatedByUserId = createdByUserId,
            Status = OrderStatus.Active,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }
}
