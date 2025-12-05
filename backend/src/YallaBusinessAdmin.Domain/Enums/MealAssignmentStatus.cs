namespace YallaBusinessAdmin.Domain.Enums;

/// <summary>
/// Status of a meal assignment for an employee
/// Maps to Postgres enum: meal_assignment_status
/// </summary>
public enum MealAssignmentStatus
{
    Scheduled,
    Active,
    Frozen,
    Delivered,
    Cancelled,
    Paused
}

public static class MealAssignmentStatusExtensions
{
    public static string ToDatabase(this MealAssignmentStatus status) => status switch
    {
        MealAssignmentStatus.Scheduled => "SCHEDULED",
        MealAssignmentStatus.Active => "ACTIVE",
        MealAssignmentStatus.Frozen => "FROZEN",
        MealAssignmentStatus.Delivered => "DELIVERED",
        MealAssignmentStatus.Cancelled => "CANCELLED",
        MealAssignmentStatus.Paused => "PAUSED",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };

    public static MealAssignmentStatus FromDatabase(string value) => value switch
    {
        "SCHEDULED" => MealAssignmentStatus.Scheduled,
        "ACTIVE" => MealAssignmentStatus.Active,
        "FROZEN" => MealAssignmentStatus.Frozen,
        "DELIVERED" => MealAssignmentStatus.Delivered,
        "CANCELLED" => MealAssignmentStatus.Cancelled,
        "PAUSED" => MealAssignmentStatus.Paused,
        _ => throw new ArgumentOutOfRangeException(nameof(value))
    };

    public static string ToRussian(this MealAssignmentStatus status) => status switch
    {
        MealAssignmentStatus.Scheduled => "Запланирован",
        MealAssignmentStatus.Active => "Активен",
        MealAssignmentStatus.Frozen => "Заморожен",
        MealAssignmentStatus.Delivered => "Доставлен",
        MealAssignmentStatus.Cancelled => "Отменён",
        MealAssignmentStatus.Paused => "Приостановлен",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };
}


