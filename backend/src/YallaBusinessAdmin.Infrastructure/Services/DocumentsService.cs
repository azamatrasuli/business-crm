using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Documents;
using YallaBusinessAdmin.Application.Documents.Dtos;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class DocumentsService : IDocumentsService
{
    private readonly AppDbContext _context;

    public DocumentsService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<DocumentResponse>> GetAllAsync(
        Guid companyId,
        int page,
        int pageSize,
        string? type,
        CancellationToken cancellationToken = default)
    {
        var query = _context.CompanyDocuments
            .Where(d => d.CompanyId == companyId);

        if (!string.IsNullOrWhiteSpace(type))
        {
            var documentType = DocumentTypeExtensions.FromDatabase(type.ToUpper());
            query = query.Where(d => d.Type == documentType);
        }

        var total = await query.CountAsync(cancellationToken);
        var documents = await query
            .OrderByDescending(d => d.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = documents.Select(d => new DocumentResponse
        {
            Id = d.Id,
            Type = d.Type.ToDatabase(),
            FileUrl = d.FileUrl,
            FileName = d.FileName,
            PeriodStart = d.PeriodStart,
            PeriodEnd = d.PeriodEnd,
            CreatedAt = d.CreatedAt
        });

        return PagedResult<DocumentResponse>.Create(items, total, page, pageSize);
    }

    public async Task<DocumentResponse> GetByIdAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default)
    {
        var document = await _context.CompanyDocuments
            .FirstOrDefaultAsync(d => d.Id == id && d.CompanyId == companyId, cancellationToken);

        if (document == null)
        {
            throw new KeyNotFoundException("Документ не найден");
        }

        return new DocumentResponse
        {
            Id = document.Id,
            Type = document.Type.ToDatabase(),
            FileUrl = document.FileUrl,
            FileName = document.FileName,
            PeriodStart = document.PeriodStart,
            PeriodEnd = document.PeriodEnd,
            CreatedAt = document.CreatedAt
        };
    }

    public async Task<string> GetDownloadUrlAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default)
    {
        var document = await _context.CompanyDocuments
            .FirstOrDefaultAsync(d => d.Id == id && d.CompanyId == companyId, cancellationToken);

        if (document == null)
        {
            throw new KeyNotFoundException("Документ не найден");
        }

        // In production, this would generate a signed URL with expiration
        // For now, return the stored URL
        return document.FileUrl;
    }
}

