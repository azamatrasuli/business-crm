namespace YallaBusinessAdmin.Application.News.Dtos;

public class NewsResponse
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public bool IsPublished { get; set; }
    public DateTime? PublishedAt { get; set; }
    public string[] TargetRoles { get; set; } = Array.Empty<string>();
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}

