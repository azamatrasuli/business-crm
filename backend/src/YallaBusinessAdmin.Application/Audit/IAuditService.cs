namespace YallaBusinessAdmin.Application.Audit;

public interface IAuditService
{
    Task LogAsync(
        Guid? userId,
        string action,
        string entityType,
        Guid? entityId = null,
        object? oldValues = null,
        object? newValues = null,
        string? ipAddress = null,
        string? userAgent = null,
        CancellationToken cancellationToken = default);
}

