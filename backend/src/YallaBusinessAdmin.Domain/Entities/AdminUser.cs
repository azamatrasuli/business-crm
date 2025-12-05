using YallaBusinessAdmin.Domain.Enums;

namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents an admin user (B2B portal user) in the system.
/// Maps to table: admin_users
/// </summary>
public class AdminUser
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    
    /// <summary>The project this admin belongs to. Determines data access scope.</summary>
    public Guid? ProjectId { get; set; }
    
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public AdminStatus Status { get; set; } = AdminStatus.Inactive;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    // New fields for soft delete and tracking
    public DateTime? DeletedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }

    // Navigation properties
    public Company? Company { get; set; }
    public Project? Project { get; set; }
    public ICollection<UserPermission> Permissions { get; set; } = new List<UserPermission>();
    public ICollection<NewsReadStatus> NewsReadStatuses { get; set; } = new List<NewsReadStatus>();
    public ICollection<Order> CreatedGuestOrders { get; set; } = new List<Order>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
}
