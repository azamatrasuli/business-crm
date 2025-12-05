namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents a permission (route access) for an admin user.
/// Maps to table: user_permissions
/// </summary>
public class UserPermission
{
    public Guid Id { get; set; }
    public Guid AdminUserId { get; set; }
    public string Route { get; set; } = string.Empty;

    // Navigation properties
    public AdminUser? AdminUser { get; set; }
}

