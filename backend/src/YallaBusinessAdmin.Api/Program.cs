using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using Serilog.Context;
using YallaBusinessAdmin.Application;
using YallaBusinessAdmin.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

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
});

builder.Services.AddAuthorization();

// Add Controllers
builder.Services.AddControllers();

// Configure CORS - allow all origins in development for mobile testing
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            // В development разрешаем все origins для тестирования с мобильных устройств
            policy.SetIsOriginAllowed(_ => true)
                .AllowAnyMethod()
                .AllowAnyHeader()
                .AllowCredentials();
        }
        else
        {
            var frontendUrl = builder.Configuration["FrontendUrl"] ?? "http://localhost:3000";
            policy.WithOrigins(frontendUrl)
                .AllowAnyMethod()
                .AllowAnyHeader()
                .AllowCredentials();
        }
    });
});

// Configure Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Yalla Business Admin API",
        Version = "v1",
        Description = "REST API for Yalla Business Admin portal"
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter your JWT token"
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

var app = builder.Build();

// Configure middleware pipeline

// Global exception handler with structured error responses
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.ContentType = "application/json";
        
        var exceptionHandlerPathFeature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerPathFeature>();
        var exception = exceptionHandlerPathFeature?.Error;
        
        // Determine error type and status code
        var (statusCode, errorCode, errorType, message, details) = exception switch
        {
            YallaBusinessAdmin.Application.Common.Errors.AppException appEx => 
                (GetStatusCode(appEx.Type), appEx.Code, appEx.Type.ToString(), appEx.Message, appEx.Details),
            
            KeyNotFoundException keyNotFound => 
                (404, "NOT_FOUND", "NotFound", keyNotFound.Message, null as Dictionary<string, object>),
            
            InvalidOperationException invalidOp => 
                (400, "VALIDATION_ERROR", "Validation", invalidOp.Message, null as Dictionary<string, object>),
            
            UnauthorizedAccessException => 
                (401, "AUTH_UNAUTHORIZED", "Forbidden", "Требуется авторизация", null as Dictionary<string, object>),
            
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

app.UseAuthentication();
app.UseAuthorization();

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

