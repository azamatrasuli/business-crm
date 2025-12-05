namespace YallaBusinessAdmin.Application.Documents.Dtos;

public class DocumentResponse
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string? FileName { get; set; }
    public DateTime? PeriodStart { get; set; }
    public DateTime? PeriodEnd { get; set; }
    public DateTime CreatedAt { get; set; }
}

