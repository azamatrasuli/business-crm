using YallaBusinessAdmin.Domain.Enums;

namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents a budget configuration for an employee.
/// Maps to table: employee_budgets
/// </summary>
public class EmployeeBudget
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public decimal TotalBudget { get; set; }
    public decimal SpentThisPeriod { get; set; } // Amount spent in current period
    public BudgetPeriod Period { get; set; } = BudgetPeriod.Monthly;
    public decimal DailyLimit { get; set; }
    public bool AutoRenew { get; set; }
    public DateTime? PeriodStartDate { get; set; }
    public DateTime? PeriodEndDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation properties
    public Employee? Employee { get; set; }
    
    // Computed property for remaining budget
    public decimal RemainingBudget => TotalBudget - SpentThisPeriod;
}

