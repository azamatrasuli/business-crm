namespace YallaBusinessAdmin.Application.Auth.Dtos;

public class LoginResponse
{
    public string Token { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public long? ExpiresAt { get; set; }
    public UserDto User { get; set; } = new();
    
    // Impersonation info
    public bool IsImpersonating { get; set; }
    public Guid? ImpersonatedBy { get; set; }
}

public class UserDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public Guid CompanyId { get; set; }
    public string? CompanyName { get; set; }
    
    // Project info
    public Guid? ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public bool IsHeadquarters { get; set; }
    
    public IEnumerable<string> Permissions { get; set; } = Enumerable.Empty<string>();
}

