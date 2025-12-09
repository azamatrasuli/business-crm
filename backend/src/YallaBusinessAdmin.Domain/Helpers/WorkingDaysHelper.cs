namespace YallaBusinessAdmin.Domain.Helpers;

/// <summary>
/// Helper class for working with employee working days.
/// Provides consistent handling of working days across the application.
/// </summary>
public static class WorkingDaysHelper
{
    /// <summary>
    /// Default working days: Monday to Friday (1-5 in DayOfWeek enum where 0=Sunday)
    /// </summary>
    public static readonly int[] DefaultWorkingDays = { 1, 2, 3, 4, 5 }; // Mon, Tue, Wed, Thu, Fri
    
    /// <summary>
    /// Every other day pattern: Monday, Wednesday, Friday (1, 3, 5 in DayOfWeek enum)
    /// Used for EVERY_OTHER_DAY schedule type.
    /// </summary>
    public static readonly int[] EveryOtherDayPattern = { 1, 3, 5 }; // Mon, Wed, Fri

    /// <summary>
    /// Gets effective working days for an employee.
    /// Returns employee's working days if set, otherwise returns default (Mon-Fri).
    /// </summary>
    /// <param name="employeeWorkingDays">Employee's configured working days array</param>
    /// <returns>Array of working days (0=Sunday, 1=Monday, ..., 6=Saturday)</returns>
    public static int[] GetEffectiveWorkingDays(int[]? employeeWorkingDays)
    {
        if (employeeWorkingDays != null && employeeWorkingDays.Length > 0)
        {
            return employeeWorkingDays;
        }
        return DefaultWorkingDays;
    }

    /// <summary>
    /// Checks if a given date is a working day for the employee.
    /// </summary>
    /// <param name="employeeWorkingDays">Employee's configured working days array</param>
    /// <param name="date">Date to check</param>
    /// <returns>True if the date is a working day</returns>
    public static bool IsWorkingDay(int[]? employeeWorkingDays, DateOnly date)
    {
        var effectiveWorkingDays = GetEffectiveWorkingDays(employeeWorkingDays);
        var dayOfWeek = (int)date.DayOfWeek; // 0 = Sunday
        return effectiveWorkingDays.Contains(dayOfWeek);
    }

    /// <summary>
    /// Checks if a given date is a working day for the employee.
    /// </summary>
    /// <param name="employeeWorkingDays">Employee's configured working days array</param>
    /// <param name="date">DateTime to check</param>
    /// <returns>True if the date is a working day</returns>
    public static bool IsWorkingDay(int[]? employeeWorkingDays, DateTime date)
    {
        return IsWorkingDay(employeeWorkingDays, DateOnly.FromDateTime(date));
    }

    /// <summary>
    /// Counts working days in a date range.
    /// </summary>
    /// <param name="employeeWorkingDays">Employee's configured working days array</param>
    /// <param name="startDate">Start date (inclusive)</param>
    /// <param name="endDate">End date (inclusive)</param>
    /// <returns>Number of working days in the range</returns>
    public static int CountWorkingDays(int[]? employeeWorkingDays, DateOnly startDate, DateOnly endDate)
    {
        if (endDate < startDate)
            return 0;

        var effectiveWorkingDays = GetEffectiveWorkingDays(employeeWorkingDays);
        var count = 0;

        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            var dayOfWeek = (int)date.DayOfWeek;
            if (effectiveWorkingDays.Contains(dayOfWeek))
            {
                count++;
            }
        }

        return count;
    }

    /// <summary>
    /// Gets working dates in a date range.
    /// </summary>
    /// <param name="employeeWorkingDays">Employee's configured working days array</param>
    /// <param name="startDate">Start date (inclusive)</param>
    /// <param name="endDate">End date (inclusive)</param>
    /// <returns>List of working dates in the range</returns>
    public static List<DateOnly> GetWorkingDates(int[]? employeeWorkingDays, DateOnly startDate, DateOnly endDate)
    {
        var dates = new List<DateOnly>();
        
        if (endDate < startDate)
            return dates;

        var effectiveWorkingDays = GetEffectiveWorkingDays(employeeWorkingDays);

        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            var dayOfWeek = (int)date.DayOfWeek;
            if (effectiveWorkingDays.Contains(dayOfWeek))
            {
                dates.Add(date);
            }
        }

        return dates;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // EVERY_OTHER_DAY Support (Mon, Wed, Fri pattern)
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>
    /// Checks if a given date matches the EVERY_OTHER_DAY pattern (Mon, Wed, Fri).
    /// Also validates that the day is a working day for the employee.
    /// </summary>
    /// <param name="employeeWorkingDays">Employee's configured working days array</param>
    /// <param name="date">Date to check</param>
    /// <returns>True if the date is Mon/Wed/Fri AND is a working day for employee</returns>
    public static bool IsEveryOtherDay(int[]? employeeWorkingDays, DateOnly date)
    {
        var dayOfWeek = (int)date.DayOfWeek;
        
        // Must be Mon (1), Wed (3), or Fri (5)
        if (!EveryOtherDayPattern.Contains(dayOfWeek))
            return false;
            
        // Also must be a working day for the employee
        return IsWorkingDay(employeeWorkingDays, date);
    }
    
    /// <summary>
    /// Checks if a given DateTime matches the EVERY_OTHER_DAY pattern.
    /// </summary>
    public static bool IsEveryOtherDay(int[]? employeeWorkingDays, DateTime date)
    {
        return IsEveryOtherDay(employeeWorkingDays, DateOnly.FromDateTime(date));
    }
    
    /// <summary>
    /// Counts EVERY_OTHER_DAY dates (Mon, Wed, Fri) in a date range.
    /// </summary>
    /// <param name="employeeWorkingDays">Employee's configured working days array</param>
    /// <param name="startDate">Start date (inclusive)</param>
    /// <param name="endDate">End date (inclusive)</param>
    /// <returns>Number of Mon/Wed/Fri days that are also working days</returns>
    public static int CountEveryOtherDays(int[]? employeeWorkingDays, DateOnly startDate, DateOnly endDate)
    {
        if (endDate < startDate)
            return 0;

        var count = 0;

        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            if (IsEveryOtherDay(employeeWorkingDays, date))
            {
                count++;
            }
        }

        return count;
    }
    
    /// <summary>
    /// Gets EVERY_OTHER_DAY dates (Mon, Wed, Fri) in a date range.
    /// </summary>
    /// <param name="employeeWorkingDays">Employee's configured working days array</param>
    /// <param name="startDate">Start date (inclusive)</param>
    /// <param name="endDate">End date (inclusive)</param>
    /// <returns>List of Mon/Wed/Fri dates that are also working days</returns>
    public static List<DateOnly> GetEveryOtherDates(int[]? employeeWorkingDays, DateOnly startDate, DateOnly endDate)
    {
        var dates = new List<DateOnly>();
        
        if (endDate < startDate)
            return dates;

        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            if (IsEveryOtherDay(employeeWorkingDays, date))
            {
                dates.Add(date);
            }
        }

        return dates;
    }
    
    /// <summary>
    /// Checks if a date should have an order created based on schedule type.
    /// This is the main method to use when creating orders.
    /// </summary>
    /// <param name="scheduleType">EVERY_DAY, EVERY_OTHER_DAY, or CUSTOM</param>
    /// <param name="employeeWorkingDays">Employee's configured working days</param>
    /// <param name="date">Date to check</param>
    /// <returns>True if order should be created for this date</returns>
    public static bool ShouldCreateOrderForDate(string? scheduleType, int[]? employeeWorkingDays, DateOnly date)
    {
        var normalizedScheduleType = ScheduleTypeHelper.Normalize(scheduleType);
        
        return normalizedScheduleType switch
        {
            "EVERY_OTHER_DAY" => IsEveryOtherDay(employeeWorkingDays, date),
            "EVERY_DAY" => IsWorkingDay(employeeWorkingDays, date),
            // CUSTOM is handled separately with explicit dates
            _ => IsWorkingDay(employeeWorkingDays, date)
        };
    }
    
    /// <summary>
    /// Counts days for order creation based on schedule type.
    /// </summary>
    public static int CountOrderDays(string? scheduleType, int[]? employeeWorkingDays, DateOnly startDate, DateOnly endDate)
    {
        var normalizedScheduleType = ScheduleTypeHelper.Normalize(scheduleType);
        
        return normalizedScheduleType switch
        {
            "EVERY_OTHER_DAY" => CountEveryOtherDays(employeeWorkingDays, startDate, endDate),
            "EVERY_DAY" => CountWorkingDays(employeeWorkingDays, startDate, endDate),
            // CUSTOM is handled separately
            _ => CountWorkingDays(employeeWorkingDays, startDate, endDate)
        };
    }
}

