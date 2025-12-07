using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using YallaBusinessAdmin.Application.Auth;
using YallaBusinessAdmin.Application.Auth.Dtos;
using YallaBusinessAdmin.Application.Common.Validators;

namespace YallaBusinessAdmin.Api.Controllers;

/// <summary>
/// Authentication controller - all exceptions are handled by global exception handler
/// Uses HttpOnly cookies for secure token storage (XSS protection)
/// Supports API versioning (v1)
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/auth")]
[Route("api/auth")] // Backwards compatibility - default to v1
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IConfiguration _configuration;

    // Cookie names - must match frontend expectations
    private const string AccessTokenCookieName = "X-Access-Token";
    private const string RefreshTokenCookieName = "X-Refresh-Token";

    public AuthController(IAuthService authService, IConfiguration configuration)
    {
        _authService = authService;
        _configuration = configuration;
    }

    /// <summary>
    /// Login with phone and password
    /// Sets HttpOnly cookies for access and refresh tokens
    /// Rate limited to 5 attempts per minute
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var ipAddress = GetClientIpAddress();
        var userAgent = GetUserAgent();
        var result = await _authService.LoginAsync(request, ipAddress, userAgent, cancellationToken);

        // Set secure HttpOnly cookies
        SetTokenCookies(result.Token, result.RefreshToken, result.ExpiresAt);

        // Return response without exposing tokens in body (they're in cookies)
        // But keep them for backwards compatibility during migration
        return Ok(result);
    }

    /// <summary>
    /// Refresh access token using refresh token from cookie or body
    /// Rate limited to prevent abuse
    /// </summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting("api")]
    public async Task<ActionResult<LoginResponse>> RefreshToken([FromBody] RefreshTokenRequest? request, CancellationToken cancellationToken)
    {
        // Try to get refresh token from cookie first, then from body
        var refreshToken = Request.Cookies[RefreshTokenCookieName] ?? request?.RefreshToken;

        if (string.IsNullOrEmpty(refreshToken))
        {
            return BadRequest(new {
                success = false,
                error = new {
                    code = "AUTH_REFRESH_TOKEN_MISSING",
                    message = "Refresh token не найден",
                    type = "Validation"
                }
            });
        }

        var ipAddress = GetClientIpAddress();
        var refreshRequest = new RefreshTokenRequest { RefreshToken = refreshToken };
        var result = await _authService.RefreshTokenAsync(refreshRequest, ipAddress, cancellationToken);

        // Update cookies with new tokens
        SetTokenCookies(result.Token, result.RefreshToken, result.ExpiresAt);

        return Ok(result);
    }

    /// <summary>
    /// Logout current user - clears HttpOnly cookies
    /// </summary>
    [HttpPost("logout")]
    [Authorize]
    public async Task<ActionResult> Logout([FromBody] LogoutRequest? request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            // Clear cookies even if not authorized (defensive)
            ClearTokenCookies();
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });
        }

        // Get refresh token from cookie or body
        var refreshToken = Request.Cookies[RefreshTokenCookieName] ?? request?.RefreshToken;

        await _authService.LogoutAsync(userId.Value, refreshToken, cancellationToken);

        // Clear all auth cookies
        ClearTokenCookies();

        return Ok(new { success = true, message = "Выход выполнен успешно" });
    }

    /// <summary>
    /// Request password reset email
    /// Rate limited to 3 attempts per hour
    /// </summary>
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting("password-reset")]
    public async Task<ActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        var result = await _authService.ForgotPasswordAsync(request, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Reset password with token
    /// Rate limited to 3 attempts per hour
    /// </summary>
    [HttpPost("reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting("password-reset")]
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

        // Clear cookies after password change (user should re-login)
        ClearTokenCookies();

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
    /// Sets new HttpOnly cookies for the impersonated session
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

        // Set new cookies for impersonated session
        SetTokenCookies(result.Token, result.RefreshToken, result.ExpiresAt);

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

        // Clear impersonation cookies - frontend will restore original token
        ClearTokenCookies();

        return Ok(new { success = true, message = "Режим имперсонации завершён" });
    }

    /// <summary>
    /// Check if user is authenticated (via cookie)
    /// Useful for frontend to verify auth status without exposing tokens
    /// </summary>
    [HttpGet("check")]
    public ActionResult CheckAuth()
    {
        var hasAccessToken = Request.Cookies.ContainsKey(AccessTokenCookieName);
        var hasRefreshToken = Request.Cookies.ContainsKey(RefreshTokenCookieName);

        return Ok(new {
            isAuthenticated = hasAccessToken || hasRefreshToken,
            hasAccessToken,
            hasRefreshToken
        });
    }

    /// <summary>
    /// Validate password complexity without storing it
    /// Used for real-time validation on frontend
    /// </summary>
    [HttpPost("validate-password")]
    [AllowAnonymous]
    public ActionResult ValidatePassword([FromBody] ValidatePasswordRequest request)
    {
        var result = PasswordValidator.Validate(request.Password);
        var strength = PasswordValidator.CalculateStrength(request.Password);

        return Ok(new {
            isValid = result.IsValid,
            errors = result.Errors,
            strength = strength,
            strengthLabel = strength switch
            {
                < 30 => "Слабый",
                < 50 => "Средний",
                < 70 => "Хороший",
                _ => "Отличный"
            },
            requirements = new {
                minLength = PasswordValidator.MinLength,
                maxLength = PasswordValidator.MaxLength,
                requireUppercase = true,
                requireLowercase = true,
                requireDigit = true,
                requireSpecialChar = true
            }
        });
    }

    #region Cookie Helpers

    private void SetTokenCookies(string accessToken, string? refreshToken, long? expiresAt)
    {
        // Check if running locally (localhost) - only then use Lax mode
        // For any deployed environment (staging, production) we need SameSite=None for cross-origin
        var isLocalDevelopment = string.Equals(
            _configuration["ASPNETCORE_ENVIRONMENT"] ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
            "Development",
            StringComparison.OrdinalIgnoreCase) && 
            (Request.Host.Host == "localhost" || Request.Host.Host == "127.0.0.1");

        // For cross-origin requests (frontend on Vercel, backend on Render),
        // we need SameSite=None with Secure=true
        // SameSite=Lax/Strict would prevent cookies from being sent in cross-site requests
        var sameSiteMode = isLocalDevelopment ? SameSiteMode.Lax : SameSiteMode.None;
        var isSecure = !isLocalDevelopment;

        // Access token cookie options
        var accessTokenOptions = new CookieOptions
        {
            HttpOnly = true,                          // Prevent XSS access
            Secure = isSecure,                        // HTTPS required for SameSite=None
            SameSite = sameSiteMode,                  // None for cross-site, Lax for localhost dev
            Path = "/",
            Expires = expiresAt.HasValue
                ? DateTimeOffset.FromUnixTimeMilliseconds(expiresAt.Value)
                : DateTimeOffset.UtcNow.AddHours(24)
        };

        Response.Cookies.Append(AccessTokenCookieName, accessToken, accessTokenOptions);

        // Refresh token cookie options (longer expiry)
        if (!string.IsNullOrEmpty(refreshToken))
        {
            var refreshTokenOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = isSecure,
                SameSite = sameSiteMode,              // Same as access token for cross-site support
                Path = "/api/auth",                    // Only sent to auth endpoints
                Expires = DateTimeOffset.UtcNow.AddDays(7)
            };

            Response.Cookies.Append(RefreshTokenCookieName, refreshToken, refreshTokenOptions);
        }
    }

    private void ClearTokenCookies()
    {
        // Check if running locally (localhost) - only then use Lax mode
        var isLocalDevelopment = string.Equals(
            _configuration["ASPNETCORE_ENVIRONMENT"] ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
            "Development",
            StringComparison.OrdinalIgnoreCase) && 
            (Request.Host.Host == "localhost" || Request.Host.Host == "127.0.0.1");

        // Must match the SameSite mode used when setting cookies for proper deletion
        var sameSiteMode = isLocalDevelopment ? SameSiteMode.Lax : SameSiteMode.None;
        var isSecure = !isLocalDevelopment;

        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = isSecure,
            SameSite = sameSiteMode,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddDays(-1)
        };

        Response.Cookies.Delete(AccessTokenCookieName, cookieOptions);

        var refreshCookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = isSecure,
            SameSite = sameSiteMode,
            Path = "/api/auth",
            Expires = DateTimeOffset.UtcNow.AddDays(-1)
        };

        Response.Cookies.Delete(RefreshTokenCookieName, refreshCookieOptions);
    }

    #endregion

    #region Helper Methods

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

    #endregion
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

/// <summary>
/// Request for password validation
/// </summary>
public class ValidatePasswordRequest
{
    public string Password { get; set; } = string.Empty;
}
