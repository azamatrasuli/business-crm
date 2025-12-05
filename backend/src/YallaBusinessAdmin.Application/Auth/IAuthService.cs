using YallaBusinessAdmin.Application.Auth.Dtos;

namespace YallaBusinessAdmin.Application.Auth;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request, string? ipAddress = null, string? userAgent = null, CancellationToken cancellationToken = default);
    Task<LoginResponse> RefreshTokenAsync(RefreshTokenRequest request, string? ipAddress = null, CancellationToken cancellationToken = default);
    Task LogoutAsync(Guid userId, string? refreshToken = null, CancellationToken cancellationToken = default);
    Task<object> ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken cancellationToken = default);
    Task<object> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken = default);
    Task<object> ChangePasswordAsync(Guid userId, ChangePasswordRequest request, string? ipAddress = null, CancellationToken cancellationToken = default);
    Task<UserDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken cancellationToken = default);
    Task<CurrentUserResponse> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default);
}

