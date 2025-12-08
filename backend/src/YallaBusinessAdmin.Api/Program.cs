using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using Serilog.Context;
using YallaBusinessAdmin.Application;
using YallaBusinessAdmin.Infrastructure;
using YallaBusinessAdmin.Api.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Load secrets from appsettings.secrets.json if exists (for local development)
var secretsPath = Path.Combine(builder.Environment.ContentRootPath, "appsettings.secrets.json");
if (File.Exists(secretsPath))
{
    builder.Configuration.AddJsonFile(secretsPath, optional: true, reloadOnChange: true);
}

// Environment variables override all other sources (for production)
builder.Configuration.AddEnvironmentVariables();

// Map common environment variable names to configuration
var envMappings = new Dictionary<string, string>
{
    { "DATABASE_URL", "ConnectionStrings:DefaultConnection" },
    { "JWT_SECRET", "Jwt:Secret" },
    { "JWT_ISSUER", "Jwt:Issuer" },
    { "JWT_AUDIENCE", "Jwt:Audience" },
    { "JWT_EXPIRATION_HOURS", "Jwt:ExpirationHours" },
    { "SUPABASE_URL", "Supabase:Url" },
    { "SUPABASE_ANON_KEY", "Supabase:AnonKey" },
    { "SUPABASE_SERVICE_ROLE_KEY", "Supabase:ServiceRoleKey" },
    { "FRONTEND_URL", "FrontendUrl" }
};

foreach (var mapping in envMappings)
{
    var envValue = Environment.GetEnvironmentVariable(mapping.Key);
    if (!string.IsNullOrEmpty(envValue))
    {
        builder.Configuration[mapping.Value] = envValue;
    }
}

// Configure Serilog with structured logging
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("Application", "YallaBusinessAdmin")
    .Enrich.WithProperty("Environment", builder.Environment.EnvironmentName)
    .WriteTo.Console(outputTemplate:
        "[{Timestamp:HH:mm:ss} {Level:u3}] [{CorrelationId}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

builder.Host.UseSerilog();

// Add services
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// Configure JWT Authentication
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? throw new InvalidOperationException("JWT Secret not configured");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "YallaBusinessAdmin";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "YallaBusinessAdmin";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ClockSkew = TimeSpan.Zero
    };

    // Read JWT from HttpOnly cookie if not in Authorization header
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            // First check Authorization header (for backwards compatibility)
            if (context.Request.Headers.ContainsKey("Authorization"))
            {
                return Task.CompletedTask;
            }

            // Then check HttpOnly cookie
            var accessToken = context.Request.Cookies["X-Access-Token"];
            if (!string.IsNullOrEmpty(accessToken))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        },
        OnAuthenticationFailed = context =>
        {
            // Log authentication failures for security monitoring
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
            logger.LogWarning("JWT authentication failed: {Error}", context.Exception?.Message);
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

// Configure Rate Limiting for brute-force protection
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Global rate limit - 100 requests per minute per IP
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
    {
        var ipAddress = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(ipAddress, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 100,
            Window = TimeSpan.FromMinutes(1),
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 5
        });
    });

    // Strict rate limit for login endpoint - 5 attempts per minute per IP
    options.AddPolicy("login", context =>
    {
        var ipAddress = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetSlidingWindowLimiter(ipAddress, _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = 5,
            Window = TimeSpan.FromMinutes(1),
            SegmentsPerWindow = 2,
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 0
        });
    });

    // Rate limit for password reset - 3 attempts per hour per IP
    options.AddPolicy("password-reset", context =>
    {
        var ipAddress = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(ipAddress, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 3,
            Window = TimeSpan.FromHours(1),
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 0
        });
    });

    // Rate limit for API endpoints - 30 requests per minute per user
    options.AddPolicy("api", context =>
    {
        var userId = context.User?.FindFirst("sub")?.Value ??
                     context.Connection.RemoteIpAddress?.ToString() ??
                     "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(userId, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 30,
            Window = TimeSpan.FromMinutes(1),
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 2
        });
    });

    // Custom response for rate limit exceeded
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.ContentType = "application/json";

        var retryAfter = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfterValue)
            ? retryAfterValue.TotalSeconds
            : 60;

        context.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter).ToString();

        var response = new
        {
            success = false,
            error = new
            {
                code = "RATE_LIMIT_EXCEEDED",
                message = "Слишком много запросов. Попробуйте позже",
                type = "RateLimit",
                retryAfterSeconds = (int)retryAfter
            },
            path = context.HttpContext.Request.Path.Value,
            timestamp = DateTime.UtcNow
        };

        Log.Warning("Rate limit exceeded for {IP} on {Path}",
            context.HttpContext.Connection.RemoteIpAddress,
            context.HttpContext.Request.Path);

        await context.HttpContext.Response.WriteAsJsonAsync(response, cancellationToken);
    };
});

// Add Controllers with custom validation error response
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        // Customize model validation error response to match our structured format
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context.ModelState
                .Where(e => e.Value?.Errors.Count > 0)
                .ToDictionary(
                    e => e.Key,
                    e => e.Value!.Errors.Select(err => err.ErrorMessage).ToArray()
                );

            var response = new
            {
                success = false,
                error = new
                {
                    code = "VALIDATION_ERROR",
                    message = "Ошибка валидации данных",
                    type = "Validation",
                    details = errors,
                    action = "Проверьте правильность заполнения всех полей"
                },
                path = context.HttpContext.Request.Path.Value,
                timestamp = DateTime.UtcNow
            };

            return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(response);
        };
    });

// Configure CORS - strict policy for security
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            // В development разрешаем localhost и локальные IP
            policy.SetIsOriginAllowed(origin =>
                {
                    var uri = new Uri(origin);
                    return uri.Host == "localhost" ||
                           uri.Host == "127.0.0.1" ||
                           uri.Host.StartsWith("192.168.") ||
                           uri.Host.StartsWith("10.") ||
                           uri.Host.EndsWith(".local");
                })
                .AllowAnyMethod()
                .AllowAnyHeader()
                .AllowCredentials()
                .SetPreflightMaxAge(TimeSpan.FromMinutes(10)); // Cache preflight
        }
        else
        {
            // Production: strict origin whitelist
            var frontendUrl = builder.Configuration["FrontendUrl"];
            var allowedOrigins = new List<string>();

            if (!string.IsNullOrEmpty(frontendUrl))
            {
                allowedOrigins.Add(frontendUrl);
            }

            // Add Vercel preview URLs if configured
            var vercelUrls = builder.Configuration["AllowedVercelUrls"]?.Split(',', StringSplitOptions.RemoveEmptyEntries);
            if (vercelUrls != null)
            {
                allowedOrigins.AddRange(vercelUrls);
            }

            // Fallback for local development
            if (allowedOrigins.Count == 0)
            {
                allowedOrigins.Add("http://localhost:3000");
            }

            policy.WithOrigins(allowedOrigins.ToArray())
                .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .WithHeaders(
                    "Content-Type",
                    "Authorization",
                    "X-Correlation-ID",
                    "X-XSRF-TOKEN"
                )
                .AllowCredentials()
                .SetPreflightMaxAge(TimeSpan.FromHours(1)); // Cache preflight longer in prod
        }
    });
});

// Configure Swagger with API versioning
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Yalla Business Admin API",
        Version = "v1.0",
        Description = "REST API for Yalla Business Admin portal\n\n" +
                      "**API Versioning:**\n" +
                      "- URL: `/api/v1/...`\n" +
                      "- Header: `X-Api-Version: 1.0`\n" +
                      "- Query: `?api-version=1.0`",
        Contact = new OpenApiContact
        {
            Name = "Yalla Team",
            Email = "support@yalla.tj"
        }
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter your JWT token (or use HttpOnly cookies)"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });

});

// Add HttpContextAccessor for CurrentUserService
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<YallaBusinessAdmin.Application.Common.Interfaces.ICurrentUserService, YallaBusinessAdmin.Api.Services.CurrentUserService>();

// API Versioning - supports URL, header, and query string versioning
builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new Asp.Versioning.ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
    options.ApiVersionReader = Asp.Versioning.ApiVersionReader.Combine(
        new Asp.Versioning.UrlSegmentApiVersionReader(),
        new Asp.Versioning.HeaderApiVersionReader("X-Api-Version"),
        new Asp.Versioning.QueryStringApiVersionReader("api-version")
    );
})
.AddApiExplorer(options =>
{
    options.GroupNameFormat = "'v'VVV";
    options.SubstituteApiVersionInUrl = true;
});

var app = builder.Build();

// Configure middleware pipeline

// Security headers (first, to ensure all responses have them)
app.UseSecurityHeaders();

// Global exception handler with structured error responses
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.ContentType = "application/json";

        var exceptionHandlerPathFeature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerPathFeature>();
        var exception = exceptionHandlerPathFeature?.Error;

        // Special handling for MultiValidationException - return all field errors
        if (exception is YallaBusinessAdmin.Application.Common.Errors.MultiValidationException multiEx)
        {
            context.Response.StatusCode = 400;

            Log.Warning("Multiple validation errors at {Path}: {ErrorCount} errors",
                context.Request.Path, multiEx.FieldErrors.Count);

            var multiResponse = new
            {
                success = false,
                error = new
                {
                    code = "MULTI_VALIDATION_ERROR",
                    message = "Ошибки валидации",
                    type = "Validation",
                    fieldErrors = multiEx.FieldErrors.Select(e => new { e.Field, e.Code, e.Message }),
                    action = "Исправьте указанные поля"
                },
                path = context.Request.Path.Value,
                timestamp = DateTime.UtcNow
            };

            await context.Response.WriteAsJsonAsync(multiResponse);
            return;
        }

        // Determine error type and status code
        var (statusCode, errorCode, errorType, message, details) = exception switch
        {
            YallaBusinessAdmin.Application.Common.Errors.AppException appEx =>
                (GetStatusCode(appEx.Type), appEx.Code, appEx.Type.ToString(), appEx.Message, appEx.Details),

            KeyNotFoundException keyNotFound =>
                (404, "NOT_FOUND", "NotFound", keyNotFound.Message, null as Dictionary<string, object>),

            InvalidOperationException invalidOp =>
                (400, "VALIDATION_ERROR", "Validation", invalidOp.Message, null as Dictionary<string, object>),

            UnauthorizedAccessException unauthEx =>
                (401, "AUTH_INVALID_CREDENTIALS", "Forbidden", unauthEx.Message, null as Dictionary<string, object>),

            ArgumentException argEx =>
                (400, "VALIDATION_ERROR", "Validation", argEx.Message, null as Dictionary<string, object>),

            _ => (500, "INTERNAL_ERROR", "Internal",
                app.Environment.IsDevelopment() ? exception?.Message ?? "Внутренняя ошибка" : "Произошла внутренняя ошибка. Попробуйте позже",
                null as Dictionary<string, object>)
        };

        context.Response.StatusCode = statusCode;

        // Log the error with structured data
        Log.Error(exception,
            "Exception occurred: {ErrorCode} - {ErrorMessage} at {Path} (Status: {StatusCode})",
            errorCode, message, context.Request.Path, statusCode);

        // Return structured error response
        var response = new
        {
            success = false,
            error = new
            {
                code = errorCode,
                message = message,
                type = errorType,
                details = details,
                action = YallaBusinessAdmin.Application.Common.Errors.ErrorActions.GetAction(errorCode)
            },
            path = context.Request.Path.Value,
            timestamp = DateTime.UtcNow
        };

        await context.Response.WriteAsJsonAsync(response);
    });
});

// Helper function to map ErrorType to HTTP status code
static int GetStatusCode(YallaBusinessAdmin.Application.Common.ErrorType type) => type switch
{
    YallaBusinessAdmin.Application.Common.ErrorType.Validation => 400,
    YallaBusinessAdmin.Application.Common.ErrorType.NotFound => 404,
    YallaBusinessAdmin.Application.Common.ErrorType.Forbidden => 403,
    YallaBusinessAdmin.Application.Common.ErrorType.Conflict => 409,
    YallaBusinessAdmin.Application.Common.ErrorType.Internal => 500,
    _ => 500
};

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Yalla Business Admin API v1");
    });
}

// Correlation ID middleware for request tracing
app.Use(async (context, next) =>
{
    var correlationId = context.Request.Headers["X-Correlation-ID"].FirstOrDefault()
        ?? Guid.NewGuid().ToString("N")[..12];

    context.Items["CorrelationId"] = correlationId;
    context.Response.Headers["X-Correlation-ID"] = correlationId;

    using (LogContext.PushProperty("CorrelationId", correlationId))
    using (LogContext.PushProperty("UserId", context.User.FindFirst("sub")?.Value ?? "anonymous"))
    using (LogContext.PushProperty("CompanyId", context.User.FindFirst("company_id")?.Value ?? "none"))
    {
        await next();
    }
});

// Enhanced Serilog request logging with additional context
app.UseSerilogRequestLogging(options =>
{
    options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
    {
        diagnosticContext.Set("RequestHost", httpContext.Request.Host.Value);
        diagnosticContext.Set("RequestScheme", httpContext.Request.Scheme);
        diagnosticContext.Set("UserAgent", httpContext.Request.Headers["User-Agent"].FirstOrDefault() ?? "unknown");
        diagnosticContext.Set("ClientIP", httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown");

        if (httpContext.Items.TryGetValue("CorrelationId", out var correlationId))
        {
            diagnosticContext.Set("CorrelationId", correlationId);
        }
    };
});

app.UseCors("AllowFrontend");

// Apply rate limiting before authentication
app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

// CSRF protection for state-changing operations
app.UseCsrfProtection();

app.MapControllers();

// Health check endpoint
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));

// Root endpoint
app.MapGet("/", () => Results.Ok(new { message = "Yalla Business Admin API", version = "1.0.0" }));

try
{
    Log.Information("Starting Yalla Business Admin API");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

