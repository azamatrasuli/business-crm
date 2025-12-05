using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.News;
using YallaBusinessAdmin.Application.News.Dtos;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class NewsService : INewsService
{
    private readonly AppDbContext _context;

    public NewsService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<NewsResponse>> GetAllAsync(
        Guid userId,
        string userRole,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _context.SystemNews
            .Where(n => n.IsPublished)
            .Where(n => n.TargetRoles.Length == 0 || n.TargetRoles.Contains(userRole.ToUpper()));

        var total = await query.CountAsync(cancellationToken);
        var news = await query
            .OrderByDescending(n => n.PublishedAt ?? n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        // Get read statuses for the user
        var newsIds = news.Select(n => n.Id).ToList();
        var readStatuses = await _context.NewsReadStatuses
            .Where(r => r.UserId == userId && newsIds.Contains(r.NewsId))
            .Select(r => r.NewsId)
            .ToListAsync(cancellationToken);

        var items = news.Select(n => MapToResponse(n, readStatuses.Contains(n.Id)));
        return PagedResult<NewsResponse>.Create(items, total, page, pageSize);
    }

    public async Task<NewsResponse> GetByIdAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var newsItem = await _context.SystemNews
            .FirstOrDefaultAsync(n => n.Id == id && n.IsPublished, cancellationToken);

        if (newsItem == null)
        {
            throw new KeyNotFoundException("Новость не найдена");
        }

        var isRead = await _context.NewsReadStatuses
            .AnyAsync(r => r.NewsId == id && r.UserId == userId, cancellationToken);

        return MapToResponse(newsItem, isRead);
    }

    public async Task MarkAsReadAsync(Guid newsId, Guid userId, CancellationToken cancellationToken = default)
    {
        var exists = await _context.SystemNews
            .AnyAsync(n => n.Id == newsId && n.IsPublished, cancellationToken);

        if (!exists)
        {
            throw new KeyNotFoundException("Новость не найдена");
        }

        var alreadyRead = await _context.NewsReadStatuses
            .AnyAsync(r => r.NewsId == newsId && r.UserId == userId, cancellationToken);

        if (!alreadyRead)
        {
            var readStatus = new NewsReadStatus
            {
                NewsId = newsId,
                UserId = userId,
                ReadAt = DateTime.UtcNow
            };

            await _context.NewsReadStatuses.AddAsync(readStatus, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<int> GetUnreadCountAsync(Guid userId, string userRole, CancellationToken cancellationToken = default)
    {
        var publishedNewsIds = await _context.SystemNews
            .Where(n => n.IsPublished)
            .Where(n => n.TargetRoles.Length == 0 || n.TargetRoles.Contains(userRole.ToUpper()))
            .Select(n => n.Id)
            .ToListAsync(cancellationToken);

        var readCount = await _context.NewsReadStatuses
            .Where(r => r.UserId == userId && publishedNewsIds.Contains(r.NewsId))
            .CountAsync(cancellationToken);

        return publishedNewsIds.Count - readCount;
    }

    private static NewsResponse MapToResponse(SystemNews news, bool isRead)
    {
        return new NewsResponse
        {
            Id = news.Id,
            Title = news.Title,
            Content = news.Content,
            IsPublished = news.IsPublished,
            PublishedAt = news.PublishedAt,
            TargetRoles = news.TargetRoles,
            IsRead = isRead,
            CreatedAt = news.CreatedAt
        };
    }
}

