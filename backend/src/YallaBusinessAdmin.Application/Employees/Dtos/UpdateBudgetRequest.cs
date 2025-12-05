namespace YallaBusinessAdmin.Application.Employees.Dtos;

public class UpdateBudgetRequest
{
    public decimal TotalBudget { get; set; }
    public decimal DailyLimit { get; set; }
    public string Period { get; set; } = "в Месяц";
    public bool AutoRenew { get; set; }
}

