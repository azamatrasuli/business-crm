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
        var companies = await _context.Companies
            .Where(c => c.DeletedAt == null)
            .OrderBy(c => c.Name) // OrderBy BEFORE Select!
            .Select(c => new CompanyListItem(
                c.Id,
                c.Name,
                c.Budget,
                c.Status.ToDatabase(),
                c.Projects.Count(p => p.DeletedAt == null),
                c.Employees.Count(e => e.DeletedAt == null)
            ))
            .ToListAsync();

        return companies;
    }

    public async Task<CompanyResponse?> GetByIdAsync(Guid id)
    {
        var company = await _context.Companies
            .Where(c => c.Id == id && c.DeletedAt == null)
            .Select(c => new CompanyResponse(
                c.Id,
                c.Name,
                c.Budget,
                c.OverdraftLimit,
                c.CurrencyCode,
                c.Timezone,
                c.CutoffTime,
                c.Status.ToDatabase(), // Use extension method
                c.CreatedAt
            ))
            .FirstOrDefaultAsync();

        return company;
    }
}

