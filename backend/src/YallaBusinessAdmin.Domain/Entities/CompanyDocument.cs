using YallaBusinessAdmin.Domain.Enums;

namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents a document stored for a company.
/// Maps to table: company_documents
/// </summary>
public class CompanyDocument
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    
    /// <summary>Project this document belongs to (each project has isolated documents)</summary>
    public Guid? ProjectId { get; set; }
    
    public DocumentType Type { get; set; }
    public string FileUrl { get; set; } = string.Empty; // S3 URL
    public string? FileName { get; set; }
    public DateTime? PeriodStart { get; set; }
    public DateTime? PeriodEnd { get; set; }
    public DateTime CreatedAt { get; set; }

    // Navigation properties
    public Company? Company { get; set; }
    public Project? Project { get; set; }
}

