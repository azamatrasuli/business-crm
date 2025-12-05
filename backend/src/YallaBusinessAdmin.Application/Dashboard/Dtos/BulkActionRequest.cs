namespace YallaBusinessAdmin.Application.Dashboard.Dtos;

public class BulkActionRequest
{
    public IEnumerable<Guid> OrderIds { get; set; } = Enumerable.Empty<Guid>();
    public string Action { get; set; } = string.Empty; // pause, resume, changeCombo, cancel (no changeAddress - address is immutable per project)
    public string? ComboType { get; set; } // For changeCombo action
}

