namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents a compensation transaction when employee pays at a partner restaurant.
/// Maps to table: compensation_transactions
/// </summary>
public class CompensationTransaction
{
    public Guid Id { get; set; }
    
    public Guid ProjectId { get; set; }
    public Guid EmployeeId { get; set; }
    
    /// <summary>Total amount of the bill</summary>
    public decimal TotalAmount { get; set; }
    
    /// <summary>Amount paid by the company (up to daily limit)</summary>
    public decimal CompanyPaidAmount { get; set; }
    
    /// <summary>Amount paid by the employee (excess over limit)</summary>
    public decimal EmployeePaidAmount { get; set; }
    
    /// <summary>Name of the restaurant partner</summary>
    public string? RestaurantName { get; set; }
    
    /// <summary>Optional description/notes</summary>
    public string? Description { get; set; }
    
    /// <summary>Date of the transaction</summary>
    public DateOnly TransactionDate { get; set; }
    
    public DateTime CreatedAt { get; set; }
    
    // Navigation properties
    public Project? Project { get; set; }
    public Employee? Employee { get; set; }
}










