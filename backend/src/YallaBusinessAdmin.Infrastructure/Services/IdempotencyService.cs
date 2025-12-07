using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using YallaBusinessAdmin.Application.Common.Interfaces;

namespace YallaBusinessAdmin.Infrastructure.Services;

/// <summary>
/// In-memory implementation of idempotency service
/// For production, consider using Redis for distributed scenarios
/// </summary>
public class IdempotencyService : IIdempotencyService
{
    private readonly IMemoryCache _cache;
    private static readonly TimeSpan DefaultTtl = TimeSpan.FromHours(24);
    private const string KeyPrefix = "idempotency:";

    public IdempotencyService(IMemoryCache cache)
    {
        _cache = cache;
    }

    public Task<bool> IsExecutedAsync(string key, CancellationToken cancellationToken = default)
    {
        var cacheKey = KeyPrefix + key;
        var exists = _cache.TryGetValue(cacheKey, out _);
        return Task.FromResult(exists);
    }

    public Task SetExecutedAsync<T>(string key, T result, TimeSpan? ttl = null, CancellationToken cancellationToken = default)
    {
        var cacheKey = KeyPrefix + key;
        var options = new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = ttl ?? DefaultTtl
        };
        
        // Store serialized result
        var serialized = JsonSerializer.Serialize(result);
        _cache.Set(cacheKey, serialized, options);
        
        return Task.CompletedTask;
    }

    public Task<T?> GetResultAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        var cacheKey = KeyPrefix + key;
        
        if (_cache.TryGetValue(cacheKey, out string? serialized) && serialized != null)
        {
            try
            {
                return Task.FromResult(JsonSerializer.Deserialize<T>(serialized));
            }
            catch
            {
                return Task.FromResult<T?>(default);
            }
        }
        
        return Task.FromResult<T?>(default);
    }

    public async Task<T> ExecuteOnceAsync<T>(string key, Func<Task<T>> operation, TimeSpan? ttl = null, CancellationToken cancellationToken = default)
    {
        // Check if already executed
        var existing = await GetResultAsync<T>(key, cancellationToken);
        if (existing != null)
        {
            return existing;
        }
        
        // Execute operation
        var result = await operation();
        
        // Store result
        await SetExecutedAsync(key, result, ttl, cancellationToken);
        
        return result;
    }
}

