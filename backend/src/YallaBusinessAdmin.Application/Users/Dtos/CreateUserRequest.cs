namespace YallaBusinessAdmin.Application.Users.Dtos;

public class CreateUserRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public IEnumerable<string> Permissions { get; set; } = Enumerable.Empty<string>();
}

