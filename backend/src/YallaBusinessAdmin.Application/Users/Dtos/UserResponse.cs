namespace YallaBusinessAdmin.Application.Users.Dtos;

public class UserResponse
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public Guid CompanyId { get; set; }
    public IEnumerable<string> Permissions { get; set; } = Enumerable.Empty<string>();
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
}

