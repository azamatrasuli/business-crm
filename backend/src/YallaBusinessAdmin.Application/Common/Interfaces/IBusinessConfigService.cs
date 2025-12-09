namespace YallaBusinessAdmin.Application.Common.Interfaces;

/// <summary>
/// Service for accessing business configuration.
/// Provides cached access to configuration values stored in database.
/// This is the SINGLE SOURCE OF TRUTH for all business rules.
/// </summary>
public interface IBusinessConfigService
{
    /// <summary>Get integer config value</summary>
    Task<int> GetIntAsync(string key, int defaultValue = 0, CancellationToken cancellationToken = default);
    
    /// <summary>Get decimal config value</summary>
    Task<decimal> GetDecimalAsync(string key, decimal defaultValue = 0, CancellationToken cancellationToken = default);
    
    /// <summary>Get boolean config value</summary>
    Task<bool> GetBoolAsync(string key, bool defaultValue = false, CancellationToken cancellationToken = default);
    
    /// <summary>Get string config value</summary>
    Task<string?> GetStringAsync(string key, string? defaultValue = null, CancellationToken cancellationToken = default);
    
    /// <summary>Get typed config value</summary>
    Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default) where T : class;
    
    /// <summary>Get all config as dictionary for API response</summary>
    Task<Dictionary<string, object>> GetAllAsync(CancellationToken cancellationToken = default);
    
    /// <summary>Update config value (admin only)</summary>
    Task SetAsync(string key, object value, Guid? updatedBy = null, CancellationToken cancellationToken = default);
    
    /// <summary>Clear config cache</summary>
    void ClearCache();
}

/// <summary>
/// Well-known configuration keys
/// </summary>
public static class ConfigKeys
{
    public const string SubscriptionMinDays = "subscription.min_days";
    public const string SubscriptionMaxFreezesPerWeek = "subscription.max_freezes_per_week";
    public const string OrderCutoffOffsetHours = "order.cutoff_offset_hours";
    public const string BudgetAllowOverdraft = "budget.allow_overdraft";
    public const string ComboPrices = "combo.prices";
}

