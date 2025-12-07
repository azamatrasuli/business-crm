namespace YallaBusinessAdmin.Infrastructure.Services.Dashboard;

/// <summary>
/// Helper class for timezone operations.
/// </summary>
public static class TimezoneHelper
{
    /// <summary>
    /// Default timezone used when company timezone is not specified.
    /// </summary>
    public const string DefaultTimezone = "Asia/Dushanbe";

    /// <summary>
    /// Gets TimeZoneInfo for the specified timezone identifier.
    /// </summary>
    /// <param name="timezone">The timezone identifier (e.g., "Asia/Dushanbe").</param>
    /// <returns>TimeZoneInfo for the timezone, or UTC if not found.</returns>
    public static TimeZoneInfo GetTimeZoneInfo(string? timezone)
    {
        if (string.IsNullOrWhiteSpace(timezone))
        {
            timezone = DefaultTimezone;
        }

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timezone);
        }
        catch (TimeZoneNotFoundException)
        {
            // Fallback to UTC if timezone not found
            return TimeZoneInfo.Utc;
        }
        catch (InvalidTimeZoneException)
        {
            // Fallback to UTC if timezone data is corrupted
            return TimeZoneInfo.Utc;
        }
    }

    /// <summary>
    /// Gets the local time for a specific timezone.
    /// </summary>
    /// <param name="utcTime">The UTC time.</param>
    /// <param name="timezone">The timezone identifier.</param>
    /// <returns>The local time in the specified timezone.</returns>
    public static DateTime ToLocalTime(DateTime utcTime, string? timezone)
    {
        var tzInfo = GetTimeZoneInfo(timezone);
        return TimeZoneInfo.ConvertTimeFromUtc(utcTime, tzInfo);
    }

    /// <summary>
    /// Checks if the cutoff time has passed for today.
    /// </summary>
    /// <param name="cutoffTime">The cutoff time.</param>
    /// <param name="timezone">The timezone identifier.</param>
    /// <returns>True if cutoff has passed, false otherwise.</returns>
    public static bool IsCutoffPassed(TimeOnly cutoffTime, string? timezone)
    {
        var localNow = ToLocalTime(DateTime.UtcNow, timezone);
        var cutoffToday = localNow.Date.Add(cutoffTime.ToTimeSpan());
        return localNow > cutoffToday;
    }
}

