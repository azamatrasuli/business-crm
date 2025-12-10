namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Business configuration stored in database.
/// Single source of truth for all business rules.
/// </summary>
public class BusinessConfig
{
    public required string Key { get; set; }
    public required object Value { get; set; }
    public string? Description { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Guid? UpdatedBy { get; set; }
}


