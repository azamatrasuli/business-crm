namespace YallaBusinessAdmin.Api.Middleware;

/// <summary>
/// Middleware to add security headers to all responses
/// </summary>
public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IWebHostEnvironment _environment;

    public SecurityHeadersMiddleware(RequestDelegate next, IWebHostEnvironment environment)
    {
        _next = next;
        _environment = environment;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Add security headers before response is sent
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;

            // Prevent clickjacking - don't allow page to be embedded in iframes
            if (!headers.ContainsKey("X-Frame-Options"))
            {
                headers.Append("X-Frame-Options", "DENY");
            }

            // Prevent MIME type sniffing
            if (!headers.ContainsKey("X-Content-Type-Options"))
            {
                headers.Append("X-Content-Type-Options", "nosniff");
            }

            // Enable XSS filter (legacy browsers)
            if (!headers.ContainsKey("X-XSS-Protection"))
            {
                headers.Append("X-XSS-Protection", "1; mode=block");
            }

            // Referrer policy - don't leak full URL
            if (!headers.ContainsKey("Referrer-Policy"))
            {
                headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
            }

            // Permissions policy - restrict browser features
            if (!headers.ContainsKey("Permissions-Policy"))
            {
                headers.Append("Permissions-Policy", 
                    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()");
            }

            // HSTS - force HTTPS (only in production)
            if (!_environment.IsDevelopment() && !headers.ContainsKey("Strict-Transport-Security"))
            {
                // max-age=1 year, includeSubDomains
                headers.Append("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
            }

            // Content Security Policy
            if (!headers.ContainsKey("Content-Security-Policy"))
            {
                // For API, we mainly need to prevent XSS in error messages
                var csp = _environment.IsDevelopment()
                    ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss:;"
                    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self';";
                
                headers.Append("Content-Security-Policy", csp);
            }

            // Cache control for API responses
            if (!headers.ContainsKey("Cache-Control"))
            {
                // API responses should generally not be cached
                headers.Append("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
                headers.Append("Pragma", "no-cache");
                headers.Append("Expires", "0");
            }

            // Remove server header to hide technology stack
            headers.Remove("Server");
            headers.Remove("X-Powered-By");

            return Task.CompletedTask;
        });

        await _next(context);
    }
}

/// <summary>
/// Extension methods for security headers middleware
/// </summary>
public static class SecurityHeadersMiddlewareExtensions
{
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<SecurityHeadersMiddleware>();
    }
}

