namespace YallaBusinessAdmin.Application.MealSubscriptions.Dtos;

public record SubscriptionResponse(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    string AddressName,
    string AddressFullAddress,
    DateOnly StartDate,
    DateOnly EndDate,
    int TotalDays,
    decimal TotalAmount,
    decimal PaidAmount,
    bool IsPaid,
    string Status,
    DateTime CreatedAt,
    int TotalAssignments,
    int ActiveAssignments,
    int FrozenAssignments,
    int PausedAssignments,
    DateTime? PausedAt,
    int PausedDaysCount
);

public record MealAssignmentResponse(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    DateOnly AssignmentDate,
    string ComboType,
    decimal Price,
    string Status,
    // Address comes from employee's project
    string AddressName,
    string AddressFullAddress,
    DateTime? FrozenAt,
    string? FrozenReason,
    DateOnly? ReplacementDate
);

public record CalendarDayResponse(
    DateOnly Date,
    int TotalAssignments,
    int ActiveAssignments,
    int FrozenAssignments,
    int DeliveredAssignments,
    bool IsWeekend,
    bool IsPast
);

public record FreezeInfoResponse(
    Guid EmployeeId,
    int RemainingFreezes,
    int UsedThisWeek,
    int WeekLimit
);




