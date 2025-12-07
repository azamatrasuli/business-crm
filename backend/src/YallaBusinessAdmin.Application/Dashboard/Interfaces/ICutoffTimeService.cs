namespace YallaBusinessAdmin.Application.Dashboard;

/// <summary>
/// Service for managing order cutoff time settings.
/// </summary>
public interface ICutoffTimeService
{
    /// <summary>
    /// Gets the current cutoff time for a company.
    /// </summary>
    /// <param name="companyId">The company identifier.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Cutoff time information.</returns>
    Task<CutoffTimeInfo> GetCutoffTimeAsync(
        Guid companyId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates the cutoff time for a company.
    /// </summary>
    /// <param name="companyId">The company identifier.</param>
    /// <param name="time">New cutoff time (HH:mm format).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Updated cutoff time information.</returns>
    Task<CutoffTimeInfo> UpdateCutoffTimeAsync(
        Guid companyId,
        string time,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Cutoff time information.
/// </summary>
public record CutoffTimeInfo(string Time, string? Message = null);

