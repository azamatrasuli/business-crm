using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using YallaBusinessAdmin.Application.Common.Constants;
using YallaBusinessAdmin.Application.Common.Interfaces;
using YallaBusinessAdmin.Application.Dashboard;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services.Dashboard;

/// <summary>
/// Service for managing order cutoff time settings.
/// </summary>
public sealed class CutoffTimeService : ICutoffTimeService
{
    private readonly AppDbContext _context;
    private readonly ICacheService _cache;
    private readonly ILogger<CutoffTimeService> _logger;

    /// <summary>
    /// Cache duration for cutoff time (30 minutes).
    /// </summary>
    private static readonly TimeSpan CutoffTimeCacheDuration = TimeSpan.FromMinutes(30);

    public CutoffTimeService(
        AppDbContext context,
        ICacheService cache,
        ILogger<CutoffTimeService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc />
    public async Task<CutoffTimeInfo> GetCutoffTimeAsync(
        Guid companyId,
        CancellationToken cancellationToken = default)
    {
        var cacheKey = CacheKeys.CutoffTime(companyId);

        var result = await _cache.GetOrCreateAsync(cacheKey, async () =>
        {
            var company = await _context.Companies
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken)
                ?? throw new KeyNotFoundException("Компания не найдена");

            return new CutoffTimeInfo(company.CutoffTime.ToString("HH:mm"));
        }, CutoffTimeCacheDuration);

        return result!;
    }

    /// <inheritdoc />
    public async Task<CutoffTimeInfo> UpdateCutoffTimeAsync(
        Guid companyId,
        string time,
        CancellationToken cancellationToken = default)
    {
        if (!TimeOnly.TryParse(time, out var parsedTime))
        {
            throw new ArgumentException("Неверный формат времени. Используйте формат HH:mm", nameof(time));
        }

        var company = await _context.Companies
            .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken)
            ?? throw new KeyNotFoundException("Компания не найдена");

        var oldTime = company.CutoffTime.ToString("HH:mm");
        company.CutoffTime = parsedTime;
        company.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        // Invalidate cache
        _cache.Remove(CacheKeys.CutoffTime(companyId));

        _logger.LogInformation(
            "Cutoff time updated for company {CompanyId} from {OldTime} to {NewTime}",
            companyId, oldTime, parsedTime.ToString("HH:mm"));

        return new CutoffTimeInfo(
            parsedTime.ToString("HH:mm"),
            "Время отсечки обновлено"
        );
    }
}

