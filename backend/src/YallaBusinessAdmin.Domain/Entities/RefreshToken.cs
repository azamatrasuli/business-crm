namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents a refresh token for JWT authentication.
/// Maps to table: refresh_tokens
/// </summary>
public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? DeviceInfo { get; set; }
    public string? IpAddress { get; set; }

    // Navigation properties
    public AdminUser? User { get; set; }
    
    // Helper properties
    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    public bool IsRevoked => RevokedAt != null;
    public bool IsActive => !IsRevoked && !IsExpired;
}

