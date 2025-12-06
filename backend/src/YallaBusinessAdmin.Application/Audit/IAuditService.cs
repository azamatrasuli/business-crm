namespace YallaBusinessAdmin.Application.Audit;

public interface IAuditService
{
    /// <summary>
    /// Log an audit event
    /// </summary>
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

    /// <summary>
    /// Log entity creation
    /// </summary>
    Task LogCreateAsync<T>(Guid? userId, Guid entityId, T entity, CancellationToken cancellationToken = default)
        where T : class;

    /// <summary>
    /// Log entity update
    /// </summary>
    Task LogUpdateAsync<T>(Guid? userId, Guid entityId, T oldEntity, T newEntity, CancellationToken cancellationToken = default)
        where T : class;

    /// <summary>
    /// Log entity deletion
    /// </summary>
    Task LogDeleteAsync<T>(Guid? userId, Guid entityId, T entity, CancellationToken cancellationToken = default)
        where T : class;

    /// <summary>
    /// Log subscription action
    /// </summary>
    Task LogSubscriptionActionAsync(Guid? userId, string action, Guid subscriptionId, object? details = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Log order action
    /// </summary>
    Task LogOrderActionAsync(Guid? userId, string action, Guid orderId, object? details = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Log budget change
    /// </summary>
    Task LogBudgetChangeAsync(Guid? userId, Guid employeeId, decimal oldAmount, decimal newAmount, string reason, CancellationToken cancellationToken = default);

    /// <summary>
    /// Log data export
    /// </summary>
    Task LogExportAsync(Guid? userId, string exportType, int recordCount, CancellationToken cancellationToken = default);

    /// <summary>
    /// Log impersonation
    /// </summary>
    Task LogImpersonationAsync(Guid superAdminId, Guid targetUserId, bool isStart, CancellationToken cancellationToken = default);
}
