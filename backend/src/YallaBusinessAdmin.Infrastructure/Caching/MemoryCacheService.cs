using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;
using YallaBusinessAdmin.Application.Common.Interfaces;

namespace YallaBusinessAdmin.Infrastructure.Caching;

/// <summary>
/// In-memory cache implementation using IMemoryCache
/// </summary>
public class MemoryCacheService : ICacheService
{
    private readonly IMemoryCache _cache;
    private readonly ConcurrentDictionary<string, byte> _keys;
    private static readonly TimeSpan DefaultExpiration = TimeSpan.FromMinutes(5);

    public MemoryCacheService(IMemoryCache cache)
    {
        _cache = cache;
        _keys = new ConcurrentDictionary<string, byte>();
    }

    public T? Get<T>(string key)
    {
        return _cache.TryGetValue(key, out T? value) ? value : default;
    }

    public void Set<T>(string key, T value, TimeSpan? slidingExpiration = null)
    {
        var options = new MemoryCacheEntryOptions
        {
            SlidingExpiration = slidingExpiration ?? DefaultExpiration
        };
        
        options.RegisterPostEvictionCallback((evictedKey, _, _, _) =>
        {
            _keys.TryRemove(evictedKey.ToString()!, out _);
        });
        
        _cache.Set(key, value, options);
        _keys.TryAdd(key, 0);
    }

    public async Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? slidingExpiration = null)
    {
        if (_cache.TryGetValue(key, out T? cachedValue) && cachedValue != null)
        {
            return cachedValue;
        }

        var value = await factory();
        Set(key, value, slidingExpiration);
        return value;
    }

    public void Remove(string key)
    {
        _cache.Remove(key);
        _keys.TryRemove(key, out _);
    }

    public void RemoveByPrefix(string prefix)
    {
        var keysToRemove = _keys.Keys.Where(k => k.StartsWith(prefix)).ToList();
        foreach (var key in keysToRemove)
        {
            Remove(key);
        }
    }
}

