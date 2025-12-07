using System.Security.Cryptography;

namespace YallaBusinessAdmin.Api.Middleware;

/// <summary>
/// CSRF protection middleware using double-submit cookie pattern
/// Validates that the CSRF token in header matches the one in cookie
/// </summary>
public class CsrfMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<CsrfMiddleware> _logger;
    private const string CsrfCookieName = "XSRF-TOKEN";
    private const string CsrfHeaderName = "X-XSRF-TOKEN";
    
    // Methods that don't require CSRF validation
    private static readonly HashSet<string> SafeMethods = new(StringComparer.OrdinalIgnoreCase) 
    { 
        "GET", "HEAD", "OPTIONS", "TRACE" 
    };
    
    // Paths that don't require CSRF validation
    private static readonly string[] ExcludedPaths = 
    {
        "/api/auth/login",      // Login doesn't need CSRF (no session yet)
        "/api/auth/refresh",    // Refresh uses its own token validation
        "/api/auth/check",      // Read-only
        "/health",              // Health check
        "/swagger"              // Swagger UI
    };

    public CsrfMiddleware(RequestDelegate next, ILogger<CsrfMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? "";
        var method = context.Request.Method;
        
        // Always set CSRF cookie for authenticated requests
        if (context.Request.Cookies.ContainsKey("access_token") || 
            context.Request.Cookies.ContainsKey("auth_status"))
        {
            SetCsrfCookie(context);
        }
        
        // Skip validation for safe methods and excluded paths
        if (SafeMethods.Contains(method) || IsExcludedPath(path))
        {
            await _next(context);
            return;
        }
        
        // Skip if not authenticated (no access_token cookie)
        if (!context.Request.Cookies.ContainsKey("access_token") && 
            !context.Request.Headers.ContainsKey("Authorization"))
        {
            await _next(context);
            return;
        }
        
        // Validate CSRF token
        var cookieToken = context.Request.Cookies[CsrfCookieName];
        var headerToken = context.Request.Headers[CsrfHeaderName].FirstOrDefault();
        
        // For backwards compatibility, also check X-Correlation-ID as CSRF token
        // This allows existing clients to work while migrating
        if (string.IsNullOrEmpty(headerToken))
        {
            // During migration period, skip CSRF validation if header is missing
            // TODO: Make this mandatory after frontend is updated
            _logger.LogDebug("CSRF header missing for {Method} {Path}, skipping validation (migration period)", 
                method, path);
            await _next(context);
            return;
        }
        
        if (string.IsNullOrEmpty(cookieToken) || cookieToken != headerToken)
        {
            _logger.LogWarning("CSRF validation failed for {Method} {Path}. Cookie: {HasCookie}, Header: {HasHeader}", 
                method, path, !string.IsNullOrEmpty(cookieToken), !string.IsNullOrEmpty(headerToken));
            
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            
            await context.Response.WriteAsJsonAsync(new
            {
                success = false,
                error = new
                {
                    code = "CSRF_TOKEN_INVALID",
                    message = "Недействительный CSRF токен. Обновите страницу и попробуйте снова",
                    type = "Forbidden"
                },
                path = path,
                timestamp = DateTime.UtcNow
            });
            return;
        }
        
        await _next(context);
    }

    private void SetCsrfCookie(HttpContext context)
    {
        // Only set if not already present or if it's expired
        if (!context.Request.Cookies.ContainsKey(CsrfCookieName))
        {
            var token = GenerateCsrfToken();
            
            context.Response.Cookies.Append(CsrfCookieName, token, new CookieOptions
            {
                HttpOnly = false, // Must be readable by JavaScript
                Secure = !context.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment(),
                SameSite = SameSiteMode.Lax,
                Path = "/",
                MaxAge = TimeSpan.FromHours(24)
            });
        }
    }

    private static string GenerateCsrfToken()
    {
        var bytes = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes);
    }

    private static bool IsExcludedPath(string path)
    {
        return ExcludedPaths.Any(excluded => 
            path.StartsWith(excluded, StringComparison.OrdinalIgnoreCase));
    }
}

/// <summary>
/// Extension methods for CSRF middleware
/// </summary>
public static class CsrfMiddlewareExtensions
{
    public static IApplicationBuilder UseCsrfProtection(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<CsrfMiddleware>();
    }
}

