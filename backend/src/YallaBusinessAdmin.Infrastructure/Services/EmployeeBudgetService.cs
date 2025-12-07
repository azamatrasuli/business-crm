using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Audit;
using YallaBusinessAdmin.Application.Employees;
using YallaBusinessAdmin.Application.Employees.Dtos;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

/// <summary>
/// Service for managing employee budgets.
/// Extracted from EmployeesService for SRP compliance.
/// </summary>
public class EmployeeBudgetService : IEmployeeBudgetService
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;

    public EmployeeBudgetService(AppDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    public async Task<BudgetResponse?> GetBudgetAsync(
        Guid employeeId, 
        Guid companyId, 
        CancellationToken cancellationToken = default)
    {
        var employee = await _context.Employees
            .Include(e => e.Budget)
            .FirstOrDefaultAsync(e => e.Id == employeeId && e.CompanyId == companyId, cancellationToken);

        if (employee?.Budget == null)
            return null;

        return new BudgetResponse
        {
            TotalBudget = employee.Budget.TotalBudget,
            DailyLimit = employee.Budget.DailyLimit,
            Period = employee.Budget.Period.ToRussian(),
            AutoRenew = employee.Budget.AutoRenew
        };
    }

    public async Task UpdateBudgetAsync(
        Guid employeeId, 
        UpdateBudgetRequest request, 
        Guid companyId, 
        Guid? currentUserId = null, 
        CancellationToken cancellationToken = default)
    {
        var employee = await _context.Employees
            .Include(e => e.Budget)
            .FirstOrDefaultAsync(e => e.Id == employeeId && e.CompanyId == companyId, cancellationToken);

        if (employee == null)
        {
            throw new KeyNotFoundException("Сотрудник не найден");
        }

        var oldValues = employee.Budget != null 
            ? new { employee.Budget.TotalBudget, employee.Budget.DailyLimit, Period = employee.Budget.Period.ToRussian(), employee.Budget.AutoRenew }
            : null;

        if (employee.Budget == null)
        {
            employee.Budget = new EmployeeBudget
            {
                Id = Guid.NewGuid(),
                EmployeeId = employee.Id,
                CreatedAt = DateTime.UtcNow
            };
            await _context.EmployeeBudgets.AddAsync(employee.Budget, cancellationToken);
        }

        employee.Budget.TotalBudget = request.TotalBudget;
        employee.Budget.DailyLimit = request.DailyLimit;
        employee.Budget.Period = BudgetPeriodExtensions.FromRussian(request.Period);
        employee.Budget.AutoRenew = request.AutoRenew;
        employee.Budget.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        // Audit log
        await _auditService.LogAsync(
            currentUserId,
            AuditActions.Update,
            AuditEntityTypes.Budget,
            employee.Id,
            oldValues: oldValues,
            newValues: new { request.TotalBudget, request.DailyLimit, request.Period, request.AutoRenew },
            cancellationToken: cancellationToken);
    }

    public async Task BatchUpdateBudgetAsync(
        BatchUpdateBudgetRequest request, 
        Guid companyId, 
        Guid? currentUserId = null, 
        CancellationToken cancellationToken = default)
    {
        var employeeIds = request.EmployeeIds.ToList();
        var employees = await _context.Employees
            .Include(e => e.Budget)
            .Where(e => employeeIds.Contains(e.Id) && e.CompanyId == companyId)
            .ToListAsync(cancellationToken);

        if (employees.Count != employeeIds.Count)
        {
            throw new InvalidOperationException("Некоторые сотрудники не найдены");
        }

        var period = BudgetPeriodExtensions.FromRussian(request.Period);

        foreach (var employee in employees)
        {
            if (employee.Budget == null)
            {
                employee.Budget = new EmployeeBudget
                {
                    Id = Guid.NewGuid(),
                    EmployeeId = employee.Id,
                    CreatedAt = DateTime.UtcNow
                };
                await _context.EmployeeBudgets.AddAsync(employee.Budget, cancellationToken);
            }

            employee.Budget.TotalBudget = request.TotalBudget;
            employee.Budget.DailyLimit = request.DailyLimit;
            employee.Budget.Period = period;
            employee.Budget.AutoRenew = request.AutoRenew;
            employee.Budget.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        // Audit log for batch operation
        await _auditService.LogAsync(
            currentUserId,
            AuditActions.Update,
            AuditEntityTypes.Budget,
            newValues: new { 
                EmployeeCount = employees.Count, 
                EmployeeIds = employeeIds,
                request.TotalBudget, 
                request.DailyLimit, 
                request.Period, 
                request.AutoRenew 
            },
            cancellationToken: cancellationToken);
    }

    public async Task ResetBudgetForPeriodAsync(
        Guid employeeId, 
        Guid companyId, 
        CancellationToken cancellationToken = default)
    {
        var employee = await _context.Employees
            .Include(e => e.Budget)
            .FirstOrDefaultAsync(e => e.Id == employeeId && e.CompanyId == companyId, cancellationToken);

        if (employee?.Budget == null || !employee.Budget.AutoRenew)
            return;

        var oldValues = new { employee.Budget.TotalBudget };
        
        // Reset to initial budget (would need to store initial value separately in real implementation)
        // For now, this is a placeholder for the budget reset logic
        employee.Budget.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            null,
            AuditActions.Update,
            AuditEntityTypes.Budget,
            employee.Id,
            oldValues: oldValues,
            newValues: new { Action = "BudgetPeriodReset" },
            cancellationToken: cancellationToken);
    }
}

