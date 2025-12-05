namespace YallaBusinessAdmin.Application.Dashboard.Dtos;

public class AssignMealsRequest
{
    public IEnumerable<Guid> EmployeeIds { get; set; } = Enumerable.Empty<Guid>();
    public string ComboType { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    // Note: Address is derived from each employee's project
}

