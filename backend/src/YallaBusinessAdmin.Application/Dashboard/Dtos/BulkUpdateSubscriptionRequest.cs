namespace YallaBusinessAdmin.Application.Dashboard.Dtos;

public class BulkUpdateSubscriptionRequest
{
    public IEnumerable<Guid> EmployeeIds { get; set; } = Enumerable.Empty<Guid>();
    public string? ComboType { get; set; }
    // Note: Address cannot be changed - it comes from employee's project
}

