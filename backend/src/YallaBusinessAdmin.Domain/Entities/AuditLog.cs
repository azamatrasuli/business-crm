namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents an audit log entry for tracking critical operations.
/// Maps to table: audit_logs
/// </summary>
public class AuditLog
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid? EntityId { get; set; }
    public string? OldValues { get; set; }
    public string? NewValues { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime CreatedAt { get; set; }

    // Navigation properties
    public AdminUser? User { get; set; }
}

/// <summary>
/// Constants for audit log actions
/// </summary>
public static class AuditActions
{
    public const string Login = "LOGIN";
    public const string Logout = "LOGOUT";
    public const string LoginFailed = "LOGIN_FAILED";
    public const string PasswordChange = "PASSWORD_CHANGE";
    public const string PasswordReset = "PASSWORD_RESET";
    public const string Create = "CREATE";
    public const string Update = "UPDATE";
    public const string Delete = "DELETE";
    public const string Activate = "ACTIVATE";
    public const string Deactivate = "DEACTIVATE";
    public const string Block = "BLOCK";
    public const string Unblock = "UNBLOCK";
}

/// <summary>
/// Constants for entity types in audit logs
/// </summary>
public static class AuditEntityTypes
{
    public const string User = "USER";
    public const string Employee = "EMPLOYEE";
    public const string Order = "ORDER";
    public const string Budget = "BUDGET";
    public const string Subscription = "SUBSCRIPTION";
    public const string Address = "ADDRESS";
    public const string Permission = "PERMISSION";
    public const string Company = "COMPANY";
}

