using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Projects;
using YallaBusinessAdmin.Application.Projects.Dtos;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class ProjectsService : IProjectsService
{
    private readonly AppDbContext _context;

    public ProjectsService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<ProjectListItem>> GetAllAsync(Guid companyId)
    {
        var projects = await _context.Projects
            .Where(p => p.CompanyId == companyId && p.DeletedAt == null)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.AddressName,
                p.AddressFullAddress,
                p.Budget,
                p.OverdraftLimit,
                p.CurrencyCode,
                p.CutoffTime,
                Status = p.Status.ToDatabase(),
                ServiceType = p.ServiceType.ToDatabase(),
                p.IsHeadquarters,
                
                // Employee counts
                EmployeesCount = p.Employees.Count(e => e.DeletedAt == null),
                EmployeesWithLunch = _context.LunchSubscriptions
                    .Count(ls => ls.ProjectId == p.Id && ls.IsActive),
                EmployeesWithCompensation = _context.EmployeeBudgets
                    .Count(eb => _context.Employees
                        .Any(e => e.Id == eb.EmployeeId && e.ProjectId == p.Id && e.DeletedAt == null)),
                
                // Spending from Orders (lunch)
                SpentLunch = _context.Orders
                    .Where(o => o.ProjectId == p.Id)
                    .Sum(o => (decimal?)o.Price) ?? 0m,
                
                // Spending from CompensationTransactions
                SpentCompensation = _context.CompensationTransactions
                    .Where(ct => ct.ProjectId == p.Id)
                    .Sum(ct => (decimal?)ct.CompanyPaidAmount) ?? 0m
            })
            .ToListAsync();

        return projects.Select(p => new ProjectListItem(
            p.Id,
            p.Name,
            p.AddressName,
            p.AddressFullAddress,
            p.Budget,
            p.OverdraftLimit,
            p.CurrencyCode,
            p.CutoffTime,
            p.Status,
            p.ServiceType,
            p.IsHeadquarters,
            p.EmployeesCount,
            p.EmployeesWithLunch,
            p.EmployeesWithCompensation,
            p.SpentLunch,
            p.SpentCompensation,
            p.SpentLunch + p.SpentCompensation,
            p.Budget - (p.SpentLunch + p.SpentCompensation)
        ));
    }

    public async Task<ProjectResponse?> GetByIdAsync(Guid id)
    {
        var project = await _context.Projects
            .Include(p => p.Employees.Where(e => e.DeletedAt == null))
            .FirstOrDefaultAsync(p => p.Id == id);

        if (project == null)
            return null;

        return MapToResponse(project);
    }

    public async Task<ProjectResponse> CreateAsync(Guid companyId, CreateProjectRequest request)
    {
        var project = new Project
        {
            CompanyId = companyId,
            Name = request.Name,
            // Address (immutable after creation)
            AddressName = request.AddressName,
            AddressFullAddress = request.AddressFullAddress,
            AddressLatitude = request.AddressLatitude,
            AddressLongitude = request.AddressLongitude,
            // Finance
            Budget = request.Budget,
            OverdraftLimit = request.OverdraftLimit,
            CurrencyCode = request.CurrencyCode,
            Timezone = request.Timezone,
            CutoffTime = request.CutoffTime ?? new TimeOnly(10, 30),
            ServiceType = ServiceTypeExtensions.FromDatabase(request.ServiceType.ToUpperInvariant()),
            CompensationDailyLimit = request.CompensationDailyLimit,
            CompensationRollover = request.CompensationRollover,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Projects.Add(project);
        await _context.SaveChangesAsync();

        return MapToResponse(project);
    }

    public async Task<ProjectResponse?> UpdateAsync(Guid id, UpdateProjectRequest request)
    {
        var project = await _context.Projects
            .Include(p => p.Employees.Where(e => e.DeletedAt == null))
            .FirstOrDefaultAsync(p => p.Id == id);

        if (project == null)
            return null;

        // NOTE: Address is IMMUTABLE - cannot be changed after creation
        // If address needs to change, create a new project
        
        if (request.Name != null)
            project.Name = request.Name;
        
        if (request.Budget.HasValue)
            project.Budget = request.Budget.Value;
        
        if (request.OverdraftLimit.HasValue)
            project.OverdraftLimit = request.OverdraftLimit.Value;
        
        if (request.CurrencyCode != null)
            project.CurrencyCode = request.CurrencyCode;
        
        if (request.Status != null)
            project.Status = CompanyStatusExtensions.FromDatabase(request.Status.ToUpperInvariant());
        
        if (request.Timezone != null)
            project.Timezone = request.Timezone;
        
        if (request.CutoffTime.HasValue)
            project.CutoffTime = request.CutoffTime.Value;
        
        if (request.ServiceType != null)
            project.ServiceType = ServiceTypeExtensions.FromDatabase(request.ServiceType.ToUpperInvariant());
        
        if (request.CompensationDailyLimit.HasValue)
            project.CompensationDailyLimit = request.CompensationDailyLimit.Value;
        
        if (request.CompensationRollover.HasValue)
            project.CompensationRollover = request.CompensationRollover.Value;

        project.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return MapToResponse(project);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var project = await _context.Projects.FindAsync(id);

        if (project == null)
            return false;

        project.DeletedAt = DateTime.UtcNow;
        project.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<ProjectStatsResponse> GetStatsAsync(Guid projectId)
    {
        var project = await _context.Projects
            .FirstOrDefaultAsync(p => p.Id == projectId);

        if (project == null)
            throw new KeyNotFoundException($"Project {projectId} not found");

        var today = DateTime.UtcNow.Date;

        var activeEmployees = await _context.Employees
            .CountAsync(e => e.ProjectId == projectId && e.IsActive && e.DeletedAt == null);

        var totalOrders = await _context.Orders
            .CountAsync(o => _context.Employees
                .Any(e => e.Id == o.EmployeeId && e.ProjectId == projectId));

        var todayOrders = await _context.Orders
            .CountAsync(o => o.OrderDate.Date == today && 
                _context.Employees.Any(e => e.Id == o.EmployeeId && e.ProjectId == projectId));

        // Calculate total spent from orders
        var totalSpent = await _context.Orders
            .Where(o => _context.Employees
                .Any(e => e.Id == o.EmployeeId && e.ProjectId == projectId))
            .SumAsync(o => o.Price);

        return new ProjectStatsResponse(
            project.Id,
            project.Name,
            project.Budget,
            totalSpent,
            activeEmployees,
            totalOrders,
            todayOrders
        );
    }

    private static ProjectResponse MapToResponse(Project project)
    {
        return new ProjectResponse(
            project.Id,
            project.CompanyId,
            project.Name,
            project.AddressName,
            project.AddressFullAddress,
            project.AddressLatitude,
            project.AddressLongitude,
            project.Budget,
            project.OverdraftLimit,
            project.CurrencyCode,
            project.Status.ToDatabase(),
            project.Timezone,
            project.CutoffTime,
            project.ServiceType.ToDatabase(),
            project.CompensationDailyLimit,
            project.CompensationRollover,
            project.CreatedAt,
            project.UpdatedAt,
            project.Employees?.Count ?? 0
        );
    }
}




