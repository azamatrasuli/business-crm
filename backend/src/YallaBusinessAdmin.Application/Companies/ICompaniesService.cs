using YallaBusinessAdmin.Application.Companies.Dtos;

namespace YallaBusinessAdmin.Application.Companies;

public interface ICompaniesService
{
    /// <summary>
    /// Get all companies (SUPER_ADMIN only)
    /// </summary>
    Task<IEnumerable<CompanyListItem>> GetAllAsync();
    
    /// <summary>
    /// Get company by ID
    /// </summary>
    Task<CompanyResponse?> GetByIdAsync(Guid id);
}


