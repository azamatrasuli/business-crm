namespace YallaBusinessAdmin.Application.Users.Dtos;

/// <summary>
/// DTO for listing all admins across all companies (SUPER_ADMIN only)
/// </summary>
public class AdminListItem
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public Guid CompanyId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public Guid? ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public DateTime? LastLoginAt { get; set; }
}

