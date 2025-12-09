namespace YallaBusinessAdmin.Application.Dashboard.Dtos;

/// <summary>
/// Represents an order in the dashboard view.
/// Can be a lunch order or compensation transaction.
/// </summary>
public class OrderResponse
{
    /// <summary>Unique identifier of the order.</summary>
    public Guid Id { get; set; }

    /// <summary>Employee identifier (null for guest orders).</summary>
    public Guid? EmployeeId { get; set; }

    /// <summary>Employee or guest name.</summary>
    public string EmployeeName { get; set; } = string.Empty;

    /// <summary>Employee phone number (null for guests).</summary>
    public string? EmployeePhone { get; set; }

    /// <summary>Order date in yyyy-MM-dd format.</summary>
    public string Date { get; set; } = string.Empty;

    /// <summary>Order status in Russian (Активен, Приостановлен, Заморожен, Выходной, Доставлен, Выполнен, Отменён).</summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>Delivery address from project (immutable).</summary>
    public string Address { get; set; } = string.Empty;

    /// <summary>Project identifier (address is derived from project).</summary>
    public Guid ProjectId { get; set; }

    /// <summary>Project name.</summary>
    public string? ProjectName { get; set; }

    /// <summary>Type of combo ordered (e.g., "Комбо 25", "Комбо 35").</summary>
    public string ComboType { get; set; } = string.Empty;

    /// <summary>Order amount in local currency.</summary>
    public decimal Amount { get; set; }

    /// <summary>Order type: "Сотрудник" or "Гость".</summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>Service type: LUNCH or COMPENSATION.</summary>
    public string? ServiceType { get; set; }

    /// <summary>Daily compensation limit (for compensation orders only).</summary>
    public decimal? CompensationLimit { get; set; }

    /// <summary>Company-paid amount for compensation.</summary>
    public decimal? CompensationAmount { get; set; }

    /// <summary>Restaurant name (for compensation orders only).</summary>
    public string? RestaurantName { get; set; }
}
