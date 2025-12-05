using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Compensation;
using YallaBusinessAdmin.Application.Compensation.Dtos;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class CompensationService : ICompensationService
{
    private readonly AppDbContext _context;

    public CompensationService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<CompensationSettingsResponse> GetSettingsAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        var project = await _context.Projects
            .FirstOrDefaultAsync(p => p.Id == projectId && p.ServiceType == ServiceType.Compensation, cancellationToken);

        if (project == null)
            throw new KeyNotFoundException("Проект компенсации не найден");

        return new CompensationSettingsResponse(
            project.Id,
            project.Name,
            project.CompensationDailyLimit,
            project.CompensationRollover,
            project.CurrencyCode
        );
    }

    public async Task<CompensationSettingsResponse> UpdateSettingsAsync(
        Guid projectId, 
        UpdateCompensationSettingsRequest request, 
        CancellationToken cancellationToken = default)
    {
        var project = await _context.Projects
            .FirstOrDefaultAsync(p => p.Id == projectId && p.ServiceType == ServiceType.Compensation, cancellationToken);

        if (project == null)
            throw new KeyNotFoundException("Проект компенсации не найден");

        project.CompensationDailyLimit = request.DailyLimit;
        project.CompensationRollover = request.RolloverEnabled;
        project.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return new CompensationSettingsResponse(
            project.Id,
            project.Name,
            project.CompensationDailyLimit,
            project.CompensationRollover,
            project.CurrencyCode
        );
    }

    public async Task<EmployeeCompensationResponse> GetEmployeeBalanceAsync(
        Guid employeeId, 
        CancellationToken cancellationToken = default)
    {
        var employee = await _context.Employees
            .Include(e => e.Project)
            .FirstOrDefaultAsync(e => e.Id == employeeId, cancellationToken);

        if (employee == null)
            throw new KeyNotFoundException("Сотрудник не найден");

        if (employee.Project == null || employee.Project.ServiceType != ServiceType.Compensation)
            throw new InvalidOperationException("Сотрудник не привязан к проекту компенсации");

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var dailyLimit = employee.Project.CompensationDailyLimit;
        var rolloverEnabled = employee.Project.CompensationRollover;

        // Calculate used today
        var usedToday = await _context.CompensationTransactions
            .Where(t => t.EmployeeId == employeeId && t.TransactionDate == today)
            .SumAsync(t => t.CompanyPaidAmount, cancellationToken);

        // Get accumulated balance if rollover is enabled
        decimal accumulatedBalance = 0;
        if (rolloverEnabled)
        {
            var balance = await _context.EmployeeCompensationBalances
                .FirstOrDefaultAsync(b => b.EmployeeId == employeeId && b.ProjectId == employee.ProjectId, cancellationToken);
            accumulatedBalance = balance?.AccumulatedBalance ?? 0;
        }

        var effectiveLimit = dailyLimit + accumulatedBalance;
        var remaining = Math.Max(0, effectiveLimit - usedToday);

        return new EmployeeCompensationResponse(
            employee.Id,
            employee.FullName,
            dailyLimit,
            usedToday,
            remaining,
            accumulatedBalance,
            rolloverEnabled
        );
    }

    public async Task<CompensationTransactionResponse> ProcessTransactionAsync(
        CreateCompensationTransactionRequest request, 
        CancellationToken cancellationToken = default)
    {
        var employee = await _context.Employees
            .Include(e => e.Project)
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId, cancellationToken);

        if (employee == null)
            throw new KeyNotFoundException("Сотрудник не найден");

        if (employee.Project == null || employee.Project.ServiceType != ServiceType.Compensation)
            throw new InvalidOperationException("Сотрудник не привязан к проекту компенсации");

        var project = employee.Project;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Calculate available limit
        var usedToday = await _context.CompensationTransactions
            .Where(t => t.EmployeeId == request.EmployeeId && t.TransactionDate == today)
            .SumAsync(t => t.CompanyPaidAmount, cancellationToken);

        decimal accumulatedBalance = 0;
        if (project.CompensationRollover)
        {
            var balance = await _context.EmployeeCompensationBalances
                .FirstOrDefaultAsync(b => b.EmployeeId == request.EmployeeId && b.ProjectId == project.Id, cancellationToken);
            accumulatedBalance = balance?.AccumulatedBalance ?? 0;
        }

        var effectiveLimit = project.CompensationDailyLimit + accumulatedBalance;
        var availableLimit = Math.Max(0, effectiveLimit - usedToday);

        // Calculate split
        var companyPays = Math.Min(request.Amount, availableLimit);
        var employeePays = request.Amount - companyPays;

        // Check project budget
        if (companyPays > project.Budget + project.OverdraftLimit)
            throw new InvalidOperationException("Недостаточно средств на балансе проекта");

        // Create transaction
        var transaction = new CompensationTransaction
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            EmployeeId = request.EmployeeId,
            TotalAmount = request.Amount,
            CompanyPaidAmount = companyPays,
            EmployeePaidAmount = employeePays,
            RestaurantName = request.RestaurantName,
            Description = request.Description,
            TransactionDate = today,
            CreatedAt = DateTime.UtcNow
        };

        _context.CompensationTransactions.Add(transaction);

        // Deduct from project budget
        project.Budget -= companyPays;
        project.UpdatedAt = DateTime.UtcNow;

        // Update accumulated balance if rollover was used
        if (project.CompensationRollover && accumulatedBalance > 0 && companyPays > project.CompensationDailyLimit)
        {
            var usedFromAccumulated = companyPays - project.CompensationDailyLimit;
            var balance = await _context.EmployeeCompensationBalances
                .FirstOrDefaultAsync(b => b.EmployeeId == request.EmployeeId && b.ProjectId == project.Id, cancellationToken);
            
            if (balance != null)
            {
                balance.AccumulatedBalance = Math.Max(0, balance.AccumulatedBalance - usedFromAccumulated);
                balance.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new CompensationTransactionResponse(
            transaction.Id,
            employee.Id,
            employee.FullName,
            transaction.TotalAmount,
            transaction.CompanyPaidAmount,
            transaction.EmployeePaidAmount,
            transaction.RestaurantName,
            transaction.Description,
            transaction.CreatedAt
        );
    }

    public async Task<IEnumerable<CompensationTransactionResponse>> GetTransactionsAsync(
        Guid employeeId, 
        DateOnly? fromDate = null, 
        DateOnly? toDate = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.CompensationTransactions
            .Include(t => t.Employee)
            .Where(t => t.EmployeeId == employeeId);

        if (fromDate.HasValue)
            query = query.Where(t => t.TransactionDate >= fromDate.Value);
        if (toDate.HasValue)
            query = query.Where(t => t.TransactionDate <= toDate.Value);

        var transactions = await query
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(cancellationToken);

        return transactions.Select(t => new CompensationTransactionResponse(
            t.Id,
            t.EmployeeId,
            t.Employee?.FullName ?? "",
            t.TotalAmount,
            t.CompanyPaidAmount,
            t.EmployeePaidAmount,
            t.RestaurantName,
            t.Description,
            t.CreatedAt
        ));
    }

    public async Task<DailyCompensationSummary> GetDailySummaryAsync(
        Guid projectId, 
        DateOnly date, 
        CancellationToken cancellationToken = default)
    {
        var project = await _context.Projects
            .FirstOrDefaultAsync(p => p.Id == projectId, cancellationToken);

        if (project == null)
            throw new KeyNotFoundException("Проект не найден");

        var transactions = await _context.CompensationTransactions
            .Include(t => t.Employee)
            .Where(t => t.ProjectId == projectId && t.TransactionDate == date)
            .ToListAsync(cancellationToken);

        var byEmployee = transactions
            .GroupBy(t => t.EmployeeId)
            .Select(g => new EmployeeDailySummary(
                g.Key,
                g.First().Employee?.FullName ?? "",
                g.Sum(t => t.CompanyPaidAmount),
                project.CompensationDailyLimit,
                g.Count()
            ))
            .ToList();

        return new DailyCompensationSummary(
            date,
            projectId,
            transactions.Count,
            transactions.Sum(t => t.TotalAmount),
            transactions.Sum(t => t.CompanyPaidAmount),
            transactions.Sum(t => t.EmployeePaidAmount),
            byEmployee.Count,
            byEmployee
        );
    }
}










