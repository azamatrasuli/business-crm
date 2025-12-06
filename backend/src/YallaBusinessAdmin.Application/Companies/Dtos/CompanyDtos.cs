namespace YallaBusinessAdmin.Application.Companies.Dtos;

public record CompanyListItem(
    Guid Id,
    string Name,
    decimal Budget,
    string Status,
    int ProjectsCount,
    int EmployeesCount
);

public record CompanyResponse(
    Guid Id,
    string Name,
    decimal Budget,
    decimal OverdraftLimit,
    string CurrencyCode,
    string Timezone,
    TimeOnly CutoffTime,
    string Status,
    DateTime CreatedAt
);


