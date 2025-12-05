namespace YallaBusinessAdmin.Application.Export;

public interface IExportService
{
    Task<byte[]> ExportEmployeesToCsvAsync(Guid companyId, CancellationToken cancellationToken = default);
    
    Task<byte[]> ExportOrdersToCsvAsync(
        Guid companyId,
        string? statusFilter,
        string? dateFilter,
        CancellationToken cancellationToken = default);
}

