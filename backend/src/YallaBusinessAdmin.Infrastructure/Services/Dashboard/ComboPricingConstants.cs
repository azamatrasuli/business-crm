namespace YallaBusinessAdmin.Infrastructure.Services.Dashboard;

/// <summary>
/// Constants for combo pricing.
/// Single source of truth for combo prices across the application.
/// </summary>
public static class ComboPricingConstants
{
    /// <summary>
    /// Supported combo types with their prices.
    /// Only "Комбо 25" and "Комбо 35" are supported.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, decimal> ComboPrices = new Dictionary<string, decimal>
    {
        { "Комбо 25", 25.00m },
        { "Комбо 35", 35.00m }
    };

    /// <summary>
    /// Default price for unknown combo types.
    /// </summary>
    public const decimal DefaultPrice = 45.00m;

    /// <summary>
    /// Gets the price for a combo type.
    /// </summary>
    /// <param name="comboType">The combo type name.</param>
    /// <returns>The price for the combo type, or default price if not found.</returns>
    public static decimal GetPrice(string comboType)
    {
        return ComboPrices.GetValueOrDefault(comboType, DefaultPrice);
    }
}

