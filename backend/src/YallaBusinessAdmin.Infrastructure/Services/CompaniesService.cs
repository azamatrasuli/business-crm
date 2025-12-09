using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Companies;
using YallaBusinessAdmin.Application.Companies.Dtos;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class CompaniesService : ICompaniesService
{
    private readonly AppDbContext _context;

    public CompaniesService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<CompanyListItem>> GetAllAsync()
    {
        // First query: get raw data that EF Core can translate to SQL
        var rawData = await _context.Companies
            .Where(c => c.DeletedAt == null)
            .OrderBy(c => c.Name)
            .Select(c => new {
                c.Id,
                c.Name,
                c.Budget,
                c.Status,
                ProjectsCount = c.Projects.Count(p => p.DeletedAt == null),
                EmployeesCount = c.Employees.Count(e => e.DeletedAt == null)
            })
            .ToListAsync();

        // Then map to DTO in memory (Status.ToRussian() can't be translated to SQL)
        return rawData.Select(c => new CompanyListItem(
            c.Id,
            c.Name,
            c.Budget,
            c.Status.ToRussian(),
            c.ProjectsCount,
            c.EmployeesCount
        ));
    }

    public async Task<CompanyResponse?> GetByIdAsync(Guid id)
    {
        var company = await _context.Companies
            .Where(c => c.Id == id && c.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (company == null)
            return null;

        return new CompanyResponse(
            company.Id,
            company.Name,
            company.Budget,
            company.OverdraftLimit,
            company.CurrencyCode,
            company.Timezone,
            company.CutoffTime,
            company.Status.ToRussian(),
            company.CreatedAt
        );
    }
}

