namespace YallaBusinessAdmin.Application.Employees.Dtos;

public class EmployeeOrderResponse
{
    public Guid Id { get; set; }
    public string Date { get; set; } = string.Empty;
    public string Type { get; set; } = "Сотрудник"; // Сотрудник / Гость
    public string Status { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? Address { get; set; }
    
    // Service type
    public string ServiceType { get; set; } = "LUNCH"; // LUNCH / COMPENSATION
    
    // Lunch fields
    public string? ComboType { get; set; } // Комбо 25 / Комбо 35
    
    // Compensation fields
    public decimal? CompensationLimit { get; set; } // Daily limit
    public decimal? CompensationSpent { get; set; } // Spent amount
    public string? RestaurantName { get; set; } // Restaurant name
}
