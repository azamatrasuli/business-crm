using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.News.Dtos;

namespace YallaBusinessAdmin.Application.News;

public interface INewsService
{
    Task<PagedResult<NewsResponse>> GetAllAsync(
        Guid userId,
        string userRole,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
    
    Task<NewsResponse> GetByIdAsync(Guid id, Guid userId, CancellationToken cancellationToken = default);
    
    Task MarkAsReadAsync(Guid newsId, Guid userId, CancellationToken cancellationToken = default);
    
    Task<int> GetUnreadCountAsync(Guid userId, string userRole, CancellationToken cancellationToken = default);
}

