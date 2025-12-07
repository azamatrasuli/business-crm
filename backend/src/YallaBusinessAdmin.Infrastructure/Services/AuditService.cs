using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using YallaBusinessAdmin.Application.Audit;
using YallaBusinessAdmin.Application.Common.Security;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class AuditService : IAuditService
{
    private readonly AppDbContext _context;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<AuditService> _logger;

    public AuditService(AppDbContext context, IHttpContextAccessor httpContextAccessor, ILogger<AuditService> logger)
    {
        _context = context;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    public async Task LogAsync(
        Guid? userId,
        string action,
        string entityType,
        Guid? entityId = null,
        object? oldValues = null,
        object? newValues = null,
        string? ipAddress = null,
        string? userAgent = null,
        CancellationToken cancellationToken = default)
    {
        // Get IP and UserAgent from HttpContext if not provided
        var httpContext = _httpContextAccessor.HttpContext;
        ipAddress ??= httpContext?.Connection.RemoteIpAddress?.ToString();
        userAgent ??= httpContext?.Request.Headers["User-Agent"].FirstOrDefault();
        
        var correlationId = httpContext?.Items["CorrelationId"]?.ToString();

        // Mask sensitive data before storing in database
        // Note: Full data is stored for compliance, but logging uses masked version
        var maskedOldValues = oldValues != null ? MaskSensitiveData(oldValues) : null;
        var maskedNewValues = newValues != null ? MaskSensitiveData(newValues) : null;

        var auditLog = new AuditLog
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            // Store original values for compliance (database has its own access controls)
            OldValues = oldValues != null ? JsonSerializer.Serialize(oldValues, new JsonSerializerOptions { WriteIndented = false }) : null,
            NewValues = newValues != null ? JsonSerializer.Serialize(newValues, new JsonSerializerOptions { WriteIndented = false }) : null,
            // Mask IP address in storage
            IpAddress = PiiMasker.MaskIpAddress(ipAddress),
            UserAgent = TruncateUserAgent(userAgent),
            CreatedAt = DateTime.UtcNow
        };

        // Log MASKED data for real-time monitoring (no PII in logs)
        _logger.LogInformation(
            "[AUDIT] {Action} {EntityType} {EntityId} by User {UserId} from {MaskedIP} (CorrelationId: {CorrelationId})",
            action, entityType, entityId, userId, PiiMasker.MaskIpAddress(ipAddress), correlationId);

        // Log detailed changes at Debug level (masked)
        if (maskedNewValues != null)
        {
            _logger.LogDebug(
                "[AUDIT DETAIL] {Action} {EntityType} NewValues: {MaskedNewValues}",
                action, entityType, JsonSerializer.Serialize(maskedNewValues));
        }

        await _context.AuditLogs.AddAsync(auditLog, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Mask sensitive data in an object for logging
    /// </summary>
    private static Dictionary<string, object?> MaskSensitiveData(object obj)
    {
        if (obj is Dictionary<string, object?> dict)
        {
            return MaskDictionary(dict);
        }

        return PiiMasker.MaskSensitiveFields(obj);
    }

    private static Dictionary<string, object?> MaskDictionary(Dictionary<string, object?> input)
    {
        var result = new Dictionary<string, object?>();
        
        foreach (var kvp in input)
        {
            var key = kvp.Key.ToLowerInvariant();
            var value = kvp.Value;

            if (IsSensitiveKey(key))
            {
                result[kvp.Key] = value switch
                {
                    string str when key.Contains("phone") => PiiMasker.MaskPhone(str),
                    string str when key.Contains("email") => PiiMasker.MaskEmail(str),
                    string str when key.Contains("name") && !key.Contains("company") && !key.Contains("project") => PiiMasker.MaskName(str),
                    string when key.Contains("password") || key.Contains("secret") || key.Contains("token") || key.Contains("hash") => "***",
                    string str when key.Contains("ip") => PiiMasker.MaskIpAddress(str),
                    null => null,
                    _ => "***"
                };
            }
            else
            {
                result[kvp.Key] = value;
            }
        }

        return result;
    }

    private static bool IsSensitiveKey(string key)
    {
        var sensitiveKeys = new[]
        {
            "password", "secret", "token", "key", "phone", "email",
            "name", "address", "ip", "hash"
        };
        
        return sensitiveKeys.Any(s => key.Contains(s));
    }

    private static string? TruncateUserAgent(string? userAgent)
    {
        // Truncate long user agents to prevent log bloat
        if (string.IsNullOrEmpty(userAgent))
            return null;

        return userAgent.Length > 200 ? userAgent[..200] + "..." : userAgent;
    }

    // ═══════════════════════════════════════════════════════════════
    // Convenience methods for common operations
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Log entity creation
    /// </summary>
    public Task LogCreateAsync<T>(Guid? userId, Guid entityId, T entity, CancellationToken cancellationToken = default)
        where T : class
    {
        return LogAsync(
            userId,
            AuditActions.Create,
            typeof(T).Name.ToUpper(),
            entityId,
            newValues: entity,
            cancellationToken: cancellationToken);
    }

    /// <summary>
    /// Log entity update with old and new values
    /// </summary>
    public Task LogUpdateAsync<T>(Guid? userId, Guid entityId, T oldEntity, T newEntity, CancellationToken cancellationToken = default)
        where T : class
    {
        return LogAsync(
            userId,
            AuditActions.Update,
            typeof(T).Name.ToUpper(),
            entityId,
            oldValues: oldEntity,
            newValues: newEntity,
            cancellationToken: cancellationToken);
    }

    /// <summary>
    /// Log entity deletion
    /// </summary>
    public Task LogDeleteAsync<T>(Guid? userId, Guid entityId, T entity, CancellationToken cancellationToken = default)
        where T : class
    {
        return LogAsync(
            userId,
            AuditActions.Delete,
            typeof(T).Name.ToUpper(),
            entityId,
            oldValues: entity,
            cancellationToken: cancellationToken);
    }

    /// <summary>
    /// Log subscription action (pause, resume, cancel, freeze, unfreeze)
    /// </summary>
    public Task LogSubscriptionActionAsync(
        Guid? userId, 
        string action, 
        Guid subscriptionId, 
        object? details = null,
        CancellationToken cancellationToken = default)
    {
        return LogAsync(
            userId,
            action,
            AuditEntityTypes.Subscription,
            subscriptionId,
            newValues: details,
            cancellationToken: cancellationToken);
    }

    /// <summary>
    /// Log order action (create, cancel, freeze, unfreeze)
    /// </summary>
    public Task LogOrderActionAsync(
        Guid? userId,
        string action,
        Guid orderId,
        object? details = null,
        CancellationToken cancellationToken = default)
    {
        return LogAsync(
            userId,
            action,
            AuditEntityTypes.Order,
            orderId,
            newValues: details,
            cancellationToken: cancellationToken);
    }

    /// <summary>
    /// Log budget change
    /// </summary>
    public Task LogBudgetChangeAsync(
        Guid? userId,
        Guid employeeId,
        decimal oldAmount,
        decimal newAmount,
        string reason,
        CancellationToken cancellationToken = default)
    {
        return LogAsync(
            userId,
            AuditActions.Update,
            AuditEntityTypes.Budget,
            employeeId,
            oldValues: new { amount = oldAmount },
            newValues: new { amount = newAmount, reason },
            cancellationToken: cancellationToken);
    }

    /// <summary>
    /// Log data export
    /// </summary>
    public Task LogExportAsync(
        Guid? userId,
        string exportType,
        int recordCount,
        CancellationToken cancellationToken = default)
    {
        return LogAsync(
            userId,
            "EXPORT",
            exportType,
            newValues: new { recordCount, exportedAt = DateTime.UtcNow },
            cancellationToken: cancellationToken);
    }

    /// <summary>
    /// Log impersonation start/stop
    /// </summary>
    public Task LogImpersonationAsync(
        Guid superAdminId,
        Guid targetUserId,
        bool isStart,
        CancellationToken cancellationToken = default)
    {
        return LogAsync(
            superAdminId,
            isStart ? "IMPERSONATION_START" : "IMPERSONATION_STOP",
            AuditEntityTypes.User,
            targetUserId,
            newValues: new { superAdminId, targetUserId, timestamp = DateTime.UtcNow },
            cancellationToken: cancellationToken);
    }
}

/// <summary>
/// Extended audit actions
/// </summary>
public static class ExtendedAuditActions
{
    // Subscription actions
    public const string SubscriptionCreate = "SUBSCRIPTION_CREATE";
    public const string SubscriptionPause = "SUBSCRIPTION_PAUSE";
    public const string SubscriptionResume = "SUBSCRIPTION_RESUME";
    public const string SubscriptionCancel = "SUBSCRIPTION_CANCEL";
    
    // Freeze actions
    public const string AssignmentFreeze = "ASSIGNMENT_FREEZE";
    public const string AssignmentUnfreeze = "ASSIGNMENT_UNFREEZE";
    
    // Order actions
    public const string OrderCreate = "ORDER_CREATE";
    public const string OrderCancel = "ORDER_CANCEL";
    public const string GuestOrderCreate = "GUEST_ORDER_CREATE";
    
    // Bulk actions
    public const string BulkPause = "BULK_PAUSE";
    public const string BulkResume = "BULK_RESUME";
    public const string BulkCancel = "BULK_CANCEL";
    public const string BulkBudgetUpdate = "BULK_BUDGET_UPDATE";
    
    // Export actions
    public const string ExportEmployees = "EXPORT_EMPLOYEES";
    public const string ExportOrders = "EXPORT_ORDERS";
}
