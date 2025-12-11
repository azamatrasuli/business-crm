using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Common.Interfaces;

namespace YallaBusinessAdmin.Api.Controllers;

/// <summary>
/// Business configuration API.
/// Returns all business rules from the single source of truth (database).
/// Frontend should use this instead of hardcoded values.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ConfigController : ControllerBase
{
    private readonly IBusinessConfigService _configService;

    public ConfigController(IBusinessConfigService configService)
    {
        _configService = configService;
    }

    /// <summary>
    /// Get all business configuration.
    /// This endpoint is public and cacheable.
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    [ResponseCache(Duration = 300)] // 5 minutes cache
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var config = await _configService.GetAllAsync(cancellationToken);
        
        // Transform to frontend-friendly format
        var response = new
        {
            subscription = new
            {
                minDays = config.GetValueOrDefault(ConfigKeys.SubscriptionMinDays, 5),
                maxFreezesPerWeek = config.GetValueOrDefault(ConfigKeys.SubscriptionMaxFreezesPerWeek, 2)
            },
            order = new
            {
                cutoffOffsetHours = config.GetValueOrDefault(ConfigKeys.OrderCutoffOffsetHours, 0)
            },
            budget = new
            {
                allowOverdraft = config.GetValueOrDefault(ConfigKeys.BudgetAllowOverdraft, true)
            },
            combo = new
            {
                prices = config.GetValueOrDefault(ConfigKeys.ComboPrices, new Dictionary<string, object>
                {
                    { "STANDARD", 25 },
                    { "PREMIUM", 35 },
                    { "DIET", 30 }
                })
            }
        };

        return Ok(response);
    }

    /// <summary>
    /// Get raw config values (admin only)
    /// </summary>
    [HttpGet("raw")]
    [Authorize]
    public async Task<IActionResult> GetRaw(CancellationToken cancellationToken)
    {
        var config = await _configService.GetAllAsync(cancellationToken);
        return Ok(config);
    }

    /// <summary>
    /// Update config value (admin only)
    /// </summary>
    [HttpPut("{key}")]
    [Authorize]
    public async Task<IActionResult> Update(string key, [FromBody] UpdateConfigRequest request, CancellationToken cancellationToken)
    {
        var adminId = User.FindFirst("sub")?.Value;
        Guid? adminGuid = adminId != null ? Guid.Parse(adminId) : null;

        await _configService.SetAsync(key, request.Value, adminGuid, cancellationToken);
        
        return Ok(new { message = "Config updated", key, value = request.Value });
    }

    /// <summary>
    /// Clear config cache (admin only)
    /// </summary>
    [HttpPost("clear-cache")]
    [Authorize]
    public IActionResult ClearCache()
    {
        _configService.ClearCache();
        return Ok(new { message = "Cache cleared" });
    }
}

public record UpdateConfigRequest(object Value);







