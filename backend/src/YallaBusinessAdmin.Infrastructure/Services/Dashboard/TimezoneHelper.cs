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
    
    /// <summary>
    /// Gets today's date in the specified timezone.
    /// IMPORTANT: Use this instead of DateTime.UtcNow.Date when comparing with order dates!
    /// </summary>
    /// <param name="timezone">The timezone identifier.</param>
    /// <returns>Today's date in the specified timezone.</returns>
    public static DateTime GetLocalToday(string? timezone)
    {
        var localNow = ToLocalTime(DateTime.UtcNow, timezone);
        return localNow.Date;
    }
    
    /// <summary>
    /// Gets today's date as DateOnly in the specified timezone.
    /// </summary>
    /// <param name="timezone">The timezone identifier.</param>
    /// <returns>Today's date as DateOnly.</returns>
    public static DateOnly GetLocalTodayDate(string? timezone)
    {
        return DateOnly.FromDateTime(GetLocalToday(timezone));
    }
    
    /// <summary>
    /// Checks if the given date is "today" in the specified timezone.
    /// </summary>
    /// <param name="orderDate">The order date to check.</param>
    /// <param name="timezone">The timezone identifier.</param>
    /// <returns>True if the date is today in the specified timezone.</returns>
    public static bool IsToday(DateTime orderDate, string? timezone)
    {
        var localToday = GetLocalToday(timezone);
        return orderDate.Date == localToday;
    }
    
    /// <summary>
    /// Checks if the given date is in the past (before today) in the specified timezone.
    /// </summary>
    /// <param name="orderDate">The order date to check.</param>
    /// <param name="timezone">The timezone identifier.</param>
    /// <returns>True if the date is in the past.</returns>
    public static bool IsPastDate(DateTime orderDate, string? timezone)
    {
        var localToday = GetLocalToday(timezone);
        return orderDate.Date < localToday;
    }
    
    /// <summary>
    /// Checks if the given date is today or in the future in the specified timezone.
    /// </summary>
    /// <param name="orderDate">The order date to check.</param>
    /// <param name="timezone">The timezone identifier.</param>
    /// <returns>True if the date is today or future.</returns>
    public static bool IsTodayOrFuture(DateTime orderDate, string? timezone)
    {
        var localToday = GetLocalToday(timezone);
        return orderDate.Date >= localToday;
    }
}

