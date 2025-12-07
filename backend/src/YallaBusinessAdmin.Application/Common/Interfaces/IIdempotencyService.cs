namespace YallaBusinessAdmin.Application.Common.Interfaces;

/// <summary>
/// Service for handling idempotent operations
/// Prevents duplicate processing of the same request
/// </summary>
public interface IIdempotencyService
{
    /// <summary>
    /// Check if operation with given key was already executed
    /// </summary>
    /// <param name="key">Unique idempotency key (e.g., "order:employee:{id}:date:{date}")</param>
    /// <returns>True if already executed</returns>
    Task<bool> IsExecutedAsync(string key, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Mark operation as executed and store result
    /// </summary>
    /// <typeparam name="T">Result type</typeparam>
    /// <param name="key">Unique idempotency key</param>
    /// <param name="result">Operation result to store</param>
    /// <param name="ttl">Time-to-live for the key (default: 24 hours)</param>
    Task SetExecutedAsync<T>(string key, T result, TimeSpan? ttl = null, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Get stored result for idempotent operation
    /// </summary>
    /// <typeparam name="T">Result type</typeparam>
    /// <param name="key">Unique idempotency key</param>
    /// <returns>Stored result or default</returns>
    Task<T?> GetResultAsync<T>(string key, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Execute operation idempotently - returns cached result if already executed
    /// </summary>
    /// <typeparam name="T">Result type</typeparam>
    /// <param name="key">Unique idempotency key</param>
    /// <param name="operation">Operation to execute if not already done</param>
    /// <param name="ttl">Time-to-live for the key</param>
    /// <returns>Operation result (cached or fresh)</returns>
    Task<T> ExecuteOnceAsync<T>(string key, Func<Task<T>> operation, TimeSpan? ttl = null, CancellationToken cancellationToken = default);
}

