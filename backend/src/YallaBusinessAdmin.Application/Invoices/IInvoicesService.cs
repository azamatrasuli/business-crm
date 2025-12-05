using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Invoices.Dtos;

namespace YallaBusinessAdmin.Application.Invoices;

public interface IInvoicesService
{
    Task<PagedResult<InvoiceResponse>> GetAllAsync(
        Guid companyId,
        int page,
        int pageSize,
        string? status,
        CancellationToken cancellationToken = default);
    
    Task<InvoiceResponse> GetByIdAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default);
    
    Task<InvoiceResponse> CreateAsync(CreateInvoiceRequest request, Guid companyId, CancellationToken cancellationToken = default);
    
    Task<InvoiceResponse> PayAsync(Guid id, PayInvoiceRequest request, Guid companyId, CancellationToken cancellationToken = default);
}

