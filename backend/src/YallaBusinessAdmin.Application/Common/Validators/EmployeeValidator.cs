namespace YallaBusinessAdmin.Application.Common.Validators;

/// <summary>
/// Validation utilities for Employee entity
/// </summary>
public static class EmployeeValidator
{
    /// <summary>
    /// Valid day of week values (0 = Sunday, 6 = Saturday)
    /// </summary>
    private static readonly HashSet<int> ValidDaysOfWeek = new() { 0, 1, 2, 3, 4, 5, 6 };

    /// <summary>
    /// Validate working days array
    /// </summary>
    /// <param name="workingDays">Array of day numbers</param>
    /// <returns>Validation result with error message if invalid</returns>
    public static (bool IsValid, string? ErrorMessage) ValidateWorkingDays(int[]? workingDays)
    {
        if (workingDays == null || workingDays.Length == 0)
            return (true, null); // Empty is valid (no schedule restriction)

        if (workingDays.Length > 7)
            return (false, "Рабочих дней не может быть больше 7");

        var invalidDays = workingDays.Where(d => !ValidDaysOfWeek.Contains(d)).ToList();
        if (invalidDays.Any())
        {
            return (false, $"Недопустимые значения дней недели: {string.Join(", ", invalidDays)}. " +
                          "Допустимые значения: 0 (воскресенье) - 6 (суббота)");
        }

        if (workingDays.Distinct().Count() != workingDays.Length)
            return (false, "Рабочие дни не должны повторяться");

        return (true, null);
    }

    /// <summary>
    /// Validate time string and parse to TimeOnly
    /// </summary>
    public static (bool IsValid, TimeOnly? Time, string? ErrorMessage) ValidateAndParseTime(string? timeString, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(timeString))
            return (true, null, null); // Empty is valid

        if (TimeOnly.TryParse(timeString, out var time))
            return (true, time, null);

        return (false, null, $"Неверный формат времени для поля '{fieldName}'. Ожидается формат HH:mm (например, 09:00)");
    }

    /// <summary>
    /// Validate that work start time is before work end time (unless overnight shift)
    /// </summary>
    public static (bool IsValid, string? ErrorMessage) ValidateWorkTimeRange(TimeOnly? startTime, TimeOnly? endTime)
    {
        if (!startTime.HasValue || !endTime.HasValue)
            return (true, null); // Partial schedule is valid

        // If same time, it's invalid (0 hour shift)
        if (startTime == endTime)
            return (false, "Время начала и окончания работы не могут совпадать");

        // We allow overnight shifts (e.g., 22:00 - 06:00), so no further validation needed
        return (true, null);
    }

    /// <summary>
    /// Validate email format (basic validation)
    /// </summary>
    public static (bool IsValid, string? ErrorMessage) ValidateEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return (true, null); // Empty email is valid (optional field)

        email = email.Trim();
        
        // Basic email format check
        if (!email.Contains('@') || !email.Contains('.'))
            return (false, "Неверный формат email адреса");

        var atIndex = email.IndexOf('@');
        if (atIndex == 0 || atIndex == email.Length - 1)
            return (false, "Неверный формат email адреса");

        var dotAfterAt = email.IndexOf('.', atIndex);
        if (dotAfterAt == -1 || dotAfterAt == email.Length - 1)
            return (false, "Неверный формат email адреса");

        return (true, null);
    }
}

