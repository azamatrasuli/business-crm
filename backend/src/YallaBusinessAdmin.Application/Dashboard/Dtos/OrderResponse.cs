namespace YallaBusinessAdmin.Application.Dashboard.Dtos;

public class OrderResponse
{
    public Guid Id { get; set; }
    public Guid? EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string? EmployeePhone { get; set; }
    public string Date { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    
    /// <summary>Address from project (immutable)</summary>
    public string Address { get; set; } = string.Empty;
    
    /// <summary>Project ID (address comes from project)</summary>
    public Guid ProjectId { get; set; }
    public string? ProjectName { get; set; }
    
    public string ComboType { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Type { get; set; } = string.Empty;
    
    /// <summary>Service type: LUNCH or COMPENSATION</summary>
    public string? ServiceType { get; set; }
    
    /// <summary>For compensation: daily limit</summary>
    public decimal? CompensationLimit { get; set; }
    
    /// <summary>For compensation: actual spent amount</summary>
    public decimal? CompensationAmount { get; set; }
    
    /// <summary>For compensation: restaurant name</summary>
    public string? RestaurantName { get; set; }
}

