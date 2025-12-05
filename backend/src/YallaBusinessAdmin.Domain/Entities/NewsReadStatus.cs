namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents the read status of a news item by a user.
/// Maps to table: news_read_status
/// </summary>
public class NewsReadStatus
{
    public Guid NewsId { get; set; }
    public Guid UserId { get; set; }
    public DateTime ReadAt { get; set; }

    // Navigation properties
    public SystemNews? News { get; set; }
    public AdminUser? User { get; set; }
}

