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
    
    // Timestamps
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation properties
    public Company? Company { get; set; }
    public Project? Project { get; set; }
    public Employee? Employee { get; set; }
    public AdminUser? CreatedByUser { get; set; }
    public ICollection<CompanyTransaction> Transactions { get; set; } = new List<CompanyTransaction>();
}
