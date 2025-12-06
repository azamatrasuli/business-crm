namespace YallaBusinessAdmin.Application.Compensation.Dtos;

public record CompensationSettingsResponse(
    Guid ProjectId,
    string ProjectName,
    decimal DailyLimit,
    bool RolloverEnabled,
    string CurrencyCode
);

public record UpdateCompensationSettingsRequest(
    decimal DailyLimit,
    bool RolloverEnabled
);

public record EmployeeCompensationResponse(
    Guid EmployeeId,
    string EmployeeName,
    decimal DailyLimit,
    decimal UsedToday,
    decimal RemainingToday,
    decimal AccumulatedBalance,
    bool RolloverEnabled
);

public record CreateCompensationTransactionRequest(
    Guid EmployeeId,
    Guid ProjectId,
    decimal Amount,
    string? RestaurantName,
    string? Description
);

public record CompensationTransactionResponse(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    decimal Amount,
    decimal CompanyPaid,
    decimal EmployeePaid,
    string? RestaurantName,
    string? Description,
    DateTime TransactionTime
);

public record DailyCompensationSummary(
    DateOnly Date,
    Guid ProjectId,
    int TotalTransactions,
    decimal TotalAmount,
    decimal TotalCompanyPaid,
    decimal TotalEmployeePaid,
    int EmployeesUsed,
    IEnumerable<EmployeeDailySummary> ByEmployee
);

public record EmployeeDailySummary(
    Guid EmployeeId,
    string EmployeeName,
    decimal TotalUsed,
    decimal DailyLimit,
    int TransactionCount
);











