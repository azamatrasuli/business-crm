using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using YallaBusinessAdmin.Application.Common.Interfaces;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

/// <summary>
/// Business configuration service with in-memory caching.
/// Reads from database, caches for 5 minutes.
/// </summary>
public class BusinessConfigService : IBusinessConfigService
{
    private readonly AppDbContext _context;
    private readonly IMemoryCache _cache;
    private const string CacheKeyPrefix = "BusinessConfig_";
    private const string AllConfigCacheKey = "BusinessConfig_All";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

    public BusinessConfigService(AppDbContext context, IMemoryCache cache)
    {
        _context = context;
        _cache = cache;
    }

    public async Task<int> GetIntAsync(string key, int defaultValue = 0, CancellationToken cancellationToken = default)
    {
        var value = await GetRawValueAsync(key, cancellationToken);
        if (value == null) return defaultValue;
        
        if (value is JsonElement je)
            return je.TryGetInt32(out var i) ? i : defaultValue;
            
        return Convert.ToInt32(value);
    }

    public async Task<decimal> GetDecimalAsync(string key, decimal defaultValue = 0, CancellationToken cancellationToken = default)
    {
        var value = await GetRawValueAsync(key, cancellationToken);
        if (value == null) return defaultValue;
        
        if (value is JsonElement je)
            return je.TryGetDecimal(out var d) ? d : defaultValue;
            
        return Convert.ToDecimal(value);
    }

    public async Task<bool> GetBoolAsync(string key, bool defaultValue = false, CancellationToken cancellationToken = default)
    {
        var value = await GetRawValueAsync(key, cancellationToken);
        if (value == null) return defaultValue;
        
        if (value is JsonElement je)
            return je.ValueKind == JsonValueKind.True;
            
        return Convert.ToBoolean(value);
    }

    public async Task<string?> GetStringAsync(string key, string? defaultValue = null, CancellationToken cancellationToken = default)
    {
        var value = await GetRawValueAsync(key, cancellationToken);
        if (value == null) return defaultValue;
        
        if (value is JsonElement je)
            return je.GetString() ?? defaultValue;
            
        return value.ToString();
    }

    public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default) where T : class
    {
        var value = await GetRawValueAsync(key, cancellationToken);
        if (value == null) return null;
        
        if (value is JsonElement je)
            return je.Deserialize<T>();
            
        return value as T;
    }

    public async Task<Dictionary<string, object>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        if (_cache.TryGetValue(AllConfigCacheKey, out Dictionary<string, object>? cached) && cached != null)
            return cached;

        var configs = await _context.Database
            .SqlQuery<ConfigRow>($"SELECT key, value FROM public.business_config")
            .ToListAsync(cancellationToken);

        var result = new Dictionary<string, object>();
        foreach (var config in configs)
        {
            try
            {
                var jsonElement = JsonSerializer.Deserialize<JsonElement>(config.value);
                result[config.key] = ConvertJsonElement(jsonElement);
            }
            catch
            {
                result[config.key] = config.value;
            }
        }

        _cache.Set(AllConfigCacheKey, result, CacheDuration);
        return result;
    }

    public async Task SetAsync(string key, object value, Guid? updatedBy = null, CancellationToken cancellationToken = default)
    {
        var jsonValue = JsonSerializer.Serialize(value);
        
        await _context.Database.ExecuteSqlRawAsync(
            @"INSERT INTO public.business_config (key, value, updated_at, updated_by) 
              VALUES ({0}, {1}::jsonb, NOW(), {2})
              ON CONFLICT (key) DO UPDATE SET 
                value = EXCLUDED.value, 
                updated_at = NOW(), 
                updated_by = EXCLUDED.updated_by",
            key, jsonValue, updatedBy);

        // Clear cache
        ClearCache();
    }

    public void ClearCache()
    {
        // Clear all config cache entries
        _cache.Remove(AllConfigCacheKey);
        // Note: Individual keys are also invalidated when AllConfig is refreshed
    }

    private async Task<object?> GetRawValueAsync(string key, CancellationToken cancellationToken)
    {
        var cacheKey = CacheKeyPrefix + key;
        
        if (_cache.TryGetValue(cacheKey, out object? cached))
            return cached;

        var result = await _context.Database
            .SqlQuery<ConfigRow>($"SELECT key, value FROM public.business_config WHERE key = {key}")
            .FirstOrDefaultAsync(cancellationToken);

        if (result == null) return null;

        try
        {
            var value = JsonSerializer.Deserialize<JsonElement>(result.value);
            _cache.Set(cacheKey, value, CacheDuration);
            return value;
        }
        catch
        {
            _cache.Set(cacheKey, result.value, CacheDuration);
            return result.value;
        }
    }

    private static object ConvertJsonElement(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Number when element.TryGetInt32(out var i) => i,
            JsonValueKind.Number when element.TryGetDecimal(out var d) => d,
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String => element.GetString() ?? "",
            JsonValueKind.Object => element.Deserialize<Dictionary<string, object>>() ?? new(),
            JsonValueKind.Array => element.Deserialize<object[]>() ?? Array.Empty<object>(),
            _ => element.ToString()
        };
    }

    private record ConfigRow(string key, string value);
}

