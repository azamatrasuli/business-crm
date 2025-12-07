namespace YallaBusinessAdmin.Application.Orders.Dtos;

public class FreezePeriodRequest
{
    /// <summary>ID сотрудника</summary>
    public Guid EmployeeId { get; set; }
    
    /// <summary>Начало периода заморозки</summary>
    public DateOnly StartDate { get; set; }
    
    /// <summary>Конец периода заморозки</summary>
    public DateOnly EndDate { get; set; }
    
    /// <summary>Причина заморозки (опционально)</summary>
    public string? Reason { get; set; }
}

