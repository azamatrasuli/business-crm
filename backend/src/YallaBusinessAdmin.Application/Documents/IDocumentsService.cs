using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Documents.Dtos;

namespace YallaBusinessAdmin.Application.Documents;

public interface IDocumentsService
{
    Task<PagedResult<DocumentResponse>> GetAllAsync(
        Guid companyId,
        int page,
        int pageSize,
        string? type,
        CancellationToken cancellationToken = default);
    
    Task<DocumentResponse> GetByIdAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Gets a signed URL for downloading a document
    /// </summary>
    Task<string> GetDownloadUrlAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default);
}

