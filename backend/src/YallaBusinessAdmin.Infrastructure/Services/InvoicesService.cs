using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Invoices;
using YallaBusinessAdmin.Application.Invoices.Dtos;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class InvoicesService : IInvoicesService
{
    private readonly AppDbContext _context;

    public InvoicesService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<InvoiceResponse>> GetAllAsync(
        Guid companyId,
        int page,
        int pageSize,
        string? status,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Invoices
            .Where(i => i.CompanyId == companyId);

        if (!string.IsNullOrWhiteSpace(status))
        {
            var invoiceStatus = InvoiceStatusExtensions.FromDatabase(status.ToUpper());
            query = query.Where(i => i.Status == invoiceStatus);
        }

        var total = await query.CountAsync(cancellationToken);
        var invoices = await query
            .OrderByDescending(i => i.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = invoices.Select(MapToResponse);
        return PagedResult<InvoiceResponse>.Create(items, total, page, pageSize);
    }

    public async Task<InvoiceResponse> GetByIdAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default)
    {
        var invoice = await _context.Invoices
            .FirstOrDefaultAsync(i => i.Id == id && i.CompanyId == companyId, cancellationToken);

        if (invoice == null)
        {
            throw new KeyNotFoundException("Счет не найден");
        }

        return MapToResponse(invoice);
    }

    public async Task<InvoiceResponse> CreateAsync(CreateInvoiceRequest request, Guid companyId, CancellationToken cancellationToken = default)
    {
        // Check for duplicate external_id (idempotency)
        if (!string.IsNullOrWhiteSpace(request.ExternalId))
        {
            var existing = await _context.Invoices
                .AnyAsync(i => i.ExternalId == request.ExternalId, cancellationToken);

            if (existing)
            {
                throw new InvalidOperationException("Счет с таким внешним ID уже существует");
            }
        }

        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            ExternalId = request.ExternalId,
            Amount = request.Amount,
            CurrencyCode = "TJS",
            Status = InvoiceStatus.Unpaid,
            DueDate = request.DueDate,
            CreatedAt = DateTime.UtcNow
        };

        await _context.Invoices.AddAsync(invoice, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        return MapToResponse(invoice);
    }

    public async Task<InvoiceResponse> PayAsync(Guid id, PayInvoiceRequest request, Guid companyId, CancellationToken cancellationToken = default)
    {
        var invoice = await _context.Invoices
            .FirstOrDefaultAsync(i => i.Id == id && i.CompanyId == companyId, cancellationToken);

        if (invoice == null)
        {
            throw new KeyNotFoundException("Счет не найден");
        }

        if (invoice.Status == InvoiceStatus.Paid)
        {
            throw new InvalidOperationException("Счет уже оплачен");
        }

        if (invoice.Status == InvoiceStatus.Cancelled)
        {
            throw new InvalidOperationException("Счет отменен");
        }

        // Get company to update balance
        var company = await _context.Companies
            .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken);

        if (company == null)
        {
            throw new KeyNotFoundException("Компания не найдена");
        }

        // Update invoice
        invoice.Status = InvoiceStatus.Paid;
        invoice.PaidAt = DateTime.UtcNow;

        // Add deposit to company balance
        company.Budget += request.Amount;
        company.UpdatedAt = DateTime.UtcNow;

        // Create transaction record (immutable ledger entry)
        var transaction = new CompanyTransaction
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            Type = TransactionType.Deposit,
            Amount = request.Amount,
            InvoiceId = invoice.Id,
            Description = invoice.ExternalId != null ? $"Счёт #{invoice.ExternalId}" : "Пополнение",
            CreatedAt = DateTime.UtcNow
        };

        await _context.CompanyTransactions.AddAsync(transaction, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        return MapToResponse(invoice);
    }

    private static InvoiceResponse MapToResponse(Invoice invoice)
    {
        return new InvoiceResponse
        {
            Id = invoice.Id,
            ExternalId = invoice.ExternalId,
            Amount = invoice.Amount,
            CurrencyCode = invoice.CurrencyCode,
            Status = invoice.Status.ToDatabase(),
            DueDate = invoice.DueDate,
            PaidAt = invoice.PaidAt,
            CreatedAt = invoice.CreatedAt
        };
    }
}

