namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents a news item from Yalla Lunch.
/// Maps to table: system_news
/// </summary>
public class SystemNews
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public bool IsPublished { get; set; }
    public DateTime? PublishedAt { get; set; }
    public string[] TargetRoles { get; set; } = Array.Empty<string>(); // e.g., ['ADMIN', 'ACCOUNTANT']
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation properties
    public ICollection<NewsReadStatus> ReadStatuses { get; set; } = new List<NewsReadStatus>();
}

