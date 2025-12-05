namespace YallaBusinessAdmin.Application.Projects.Dtos;

public record ProjectResponse(
    Guid Id,
    Guid CompanyId,
    string Name,
    
    // Address (immutable)
    string AddressName,
    string AddressFullAddress,
    double? AddressLatitude,
    double? AddressLongitude,
    
    decimal Budget,
    decimal OverdraftLimit,
    string CurrencyCode,
    string Status,
    string Timezone,
    TimeOnly CutoffTime,
    string ServiceType,
    decimal CompensationDailyLimit,
    bool CompensationRollover,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    int EmployeesCount
);

/// <summary>
/// Project list item with detailed statistics for dashboard
/// </summary>
public record ProjectListItem(
    Guid Id,
    string Name,
    
    // Address (immutable)
    string AddressName,
    string AddressFullAddress,
    
    // Budget
    decimal Budget,
    decimal OverdraftLimit,
    string CurrencyCode,
    TimeOnly CutoffTime,
    string Status,
    string ServiceType,
    bool IsHeadquarters,
    
    // Employee counts
    int EmployeesCount,
    int EmployeesWithLunch,
    int EmployeesWithCompensation,
    
    // Spending
    decimal SpentLunch,
    decimal SpentCompensation,
    decimal SpentTotal,
    
    // Remaining
    decimal BudgetRemaining
);




