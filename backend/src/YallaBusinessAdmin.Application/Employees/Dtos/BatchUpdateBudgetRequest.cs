using System.ComponentModel.DataAnnotations;

namespace YallaBusinessAdmin.Application.Employees.Dtos;

public class BatchUpdateBudgetRequest
{
    [Required(ErrorMessage = "Список ID сотрудников обязателен")]
    [MinLength(1, ErrorMessage = "Должен быть указан хотя бы один сотрудник")]
    public IEnumerable<Guid> EmployeeIds { get; set; } = Enumerable.Empty<Guid>();
    
    [Required(ErrorMessage = "Общий бюджет обязателен")]
    [Range(0, double.MaxValue, ErrorMessage = "Бюджет не может быть отрицательным")]
    public decimal TotalBudget { get; set; }
    
    [Required(ErrorMessage = "Дневной лимит обязателен")]
    [Range(0, double.MaxValue, ErrorMessage = "Лимит не может быть отрицательным")]
    public decimal DailyLimit { get; set; }
    
    [Required(ErrorMessage = "Период обязателен")]
    public string Period { get; set; } = "в Месяц";
    
    public bool AutoRenew { get; set; }
}

