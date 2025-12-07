namespace YallaBusinessAdmin.Application.Common.Interfaces;

/// <summary>
/// Interface for caching service to improve performance
/// </summary>
public interface ICacheService
{
    /// <summary>
    /// Get value from cache
    /// </summary>
    T? Get<T>(string key);
    
    /// <summary>
    /// Set value in cache with sliding expiration
    /// </summary>
    void Set<T>(string key, T value, TimeSpan? slidingExpiration = null);
    
    /// <summary>
    /// Get or create cached value
    /// </summary>
    Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? slidingExpiration = null);
    
    /// <summary>
    /// Remove value from cache
    /// </summary>
    void Remove(string key);
    
    /// <summary>
    /// Remove all values matching pattern
    /// </summary>
    void RemoveByPrefix(string prefix);
}

