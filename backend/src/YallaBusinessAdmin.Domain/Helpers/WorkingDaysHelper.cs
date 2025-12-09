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
}



