namespace YallaBusinessAdmin.Domain.Enums;

/// <summary>
/// Invitation status for an employee.
/// Maps to Postgres enum: employee_invite_status
/// </summary>
public enum EmployeeInviteStatus
{
    /// <summary>Принято - Accepted</summary>
    Accepted,
    /// <summary>Ожидает - Pending</summary>
    Pending,
    /// <summary>Отклонено - Rejected</summary>
    Rejected
}

public static class EmployeeInviteStatusExtensions
{
    public static string ToRussian(this EmployeeInviteStatus status) => status switch
    {
        EmployeeInviteStatus.Accepted => "Принято",
        EmployeeInviteStatus.Pending => "Ожидает",
        EmployeeInviteStatus.Rejected => "Отклонено",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };

    public static EmployeeInviteStatus FromRussian(string value) => value switch
    {
        "Принято" => EmployeeInviteStatus.Accepted,
        "Ожидает" => EmployeeInviteStatus.Pending,
        "Отклонено" => EmployeeInviteStatus.Rejected,
        _ => throw new ArgumentOutOfRangeException(nameof(value))
    };
}

