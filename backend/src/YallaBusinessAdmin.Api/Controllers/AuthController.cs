using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Auth;
using YallaBusinessAdmin.Application.Auth.Dtos;

namespace YallaBusinessAdmin.Api.Controllers;

/// <summary>
/// Authentication controller - all exceptions are handled by global exception handler
/// </summary>
[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    /// <summary>
    /// Login with phone and password
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var ipAddress = GetClientIpAddress();
        var userAgent = GetUserAgent();
        var result = await _authService.LoginAsync(request, ipAddress, userAgent, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Refresh access token using refresh token
    /// </summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> RefreshToken([FromBody] RefreshTokenRequest request, CancellationToken cancellationToken)
    {
        var ipAddress = GetClientIpAddress();
        var result = await _authService.RefreshTokenAsync(request, ipAddress, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Logout current user
    /// </summary>
    [HttpPost("logout")]
    [Authorize]
    public async Task<ActionResult> Logout([FromBody] LogoutRequest? request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });
        }

        await _authService.LogoutAsync(userId.Value, request?.RefreshToken, cancellationToken);
        return Ok(new { success = true, message = "Выход выполнен успешно" });
    }

    /// <summary>
    /// Request password reset email
    /// </summary>
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<ActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        var result = await _authService.ForgotPasswordAsync(request, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Reset password with token
    /// </summary>
    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<ActionResult> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        var result = await _authService.ResetPasswordAsync(request, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Change password for authenticated user
    /// </summary>
    [HttpPost("change-password")]
    [Authorize]
    public async Task<ActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });
        }

        var ipAddress = GetClientIpAddress();
        var result = await _authService.ChangePasswordAsync(userId.Value, request, ipAddress, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Get current user with company info
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<CurrentUserResponse>> GetCurrentUser(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });
        }

        var result = await _authService.GetCurrentUserAsync(userId.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Get current user profile (alias for /me)
    /// </summary>
    [HttpGet("profile")]
    [Authorize]
    public async Task<ActionResult<CurrentUserResponse>> GetProfile(CancellationToken cancellationToken)
    {
        return await GetCurrentUser(cancellationToken);
    }

    /// <summary>
    /// Update current user profile
    /// </summary>
    [HttpPut("profile")]
    [Authorize]
    public async Task<ActionResult<UserDto>> UpdateProfile([FromBody] UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });
        }

        var result = await _authService.UpdateProfileAsync(userId.Value, request, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Impersonate another user (SUPER_ADMIN only)
    /// </summary>
    [HttpPost("impersonate/{userId:guid}")]
    [Authorize(Roles = "SUPER_ADMIN")]
    public async Task<ActionResult<LoginResponse>> Impersonate(Guid userId, CancellationToken cancellationToken)
    {
        var currentUserId = GetUserId();
        if (currentUserId == null)
        {
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });
        }

        var ipAddress = GetClientIpAddress();
        var userAgent = GetUserAgent();
        var result = await _authService.ImpersonateAsync(userId, currentUserId.Value, ipAddress, userAgent, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Stop impersonation and log the action
    /// </summary>
    [HttpPost("stop-impersonation")]
    [Authorize]
    public async Task<ActionResult> StopImpersonation([FromBody] StopImpersonationRequest request, CancellationToken cancellationToken)
    {
        var impersonatorId = GetImpersonatorId();
        if (impersonatorId == null)
        {
            return BadRequest(new { success = false, error = new { code = "AUTH_NOT_IMPERSONATING", message = "Вы не находитесь в режиме имперсонации", type = "Validation" } });
        }

        var impersonatedUserId = GetUserId();
        if (impersonatedUserId == null)
        {
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });
        }

        var ipAddress = GetClientIpAddress();
        var userAgent = GetUserAgent();
        await _authService.StopImpersonatingAsync(impersonatorId.Value, impersonatedUserId.Value, ipAddress, userAgent, cancellationToken);
        
        return Ok(new { success = true, message = "Режим имперсонации завершён" });
    }

    private Guid? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst(JwtRegisteredClaimNames.Sub);
        if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return userId;
        }
        return null;
    }

    private Guid? GetImpersonatorId()
    {
        var impersonatorClaim = User.FindFirst("impersonated_by");
        if (impersonatorClaim != null && Guid.TryParse(impersonatorClaim.Value, out var impersonatorId))
        {
            return impersonatorId;
        }
        return null;
    }

    private string? GetClientIpAddress()
    {
        var forwardedFor = HttpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            return forwardedFor.Split(',').First().Trim();
        }
        
        return HttpContext.Connection.RemoteIpAddress?.ToString();
    }

    private string? GetUserAgent()
    {
        return HttpContext.Request.Headers["User-Agent"].FirstOrDefault();
    }
}

/// <summary>
/// Request for logout with optional refresh token
/// </summary>
public class LogoutRequest
{
    public string? RefreshToken { get; set; }
}

/// <summary>
/// Request for stopping impersonation (empty body, just for POST semantics)
/// </summary>
public class StopImpersonationRequest
{
}
