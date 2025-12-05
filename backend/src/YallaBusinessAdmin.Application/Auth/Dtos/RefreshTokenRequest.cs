using System.ComponentModel.DataAnnotations;

namespace YallaBusinessAdmin.Application.Auth.Dtos;

public class RefreshTokenRequest
{
    [Required(ErrorMessage = "Refresh token обязателен")]
    public string RefreshToken { get; set; } = string.Empty;
}

