using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Common.Constants;
using YallaBusinessAdmin.Application.Common.Interfaces;
using YallaBusinessAdmin.Application.Compensation;
using YallaBusinessAdmin.Application.Compensation.Dtos;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class CompensationService : ICompensationService
{
    private readonly AppDbContext _context;
    private readonly IBudgetService _budgetService;
    private readonly IIdempotencyService _idempotencyService;

    public CompensationService(
        AppDbContext context, 
        IBudgetService budgetService,
        IIdempotencyService idempotencyService)
    {
        _context = context;
        _budgetService = budgetService;
        _idempotencyService = idempotencyService;
    }

    public async Task<CompensationSettingsResponse> GetSettingsAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        var project = await _context.Projects
            .FirstOrDefaultAsync(p => p.Id == projectId && p.ServiceTypes.Contains("COMPENSATION"), cancellationToken);

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
            .FirstOrDefaultAsync(p => p.Id == projectId && p.ServiceTypes.Contains("COMPENSATION"), cancellationToken);

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

        if (employee.Project == null || !employee.Project.ServiceTypes.Contains("COMPENSATION"))
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
        // ═══════════════════════════════════════════════════════════════
        // VALIDATION: Amount must be positive
        // ═══════════════════════════════════════════════════════════════
        if (request.Amount <= 0)
            throw new ArgumentException("Сумма транзакции должна быть положительной");

        if (request.Amount > 1_000_000) // Reasonable upper limit
            throw new ArgumentException("Сумма транзакции превышает допустимый лимит");

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // ═══════════════════════════════════════════════════════════════
        // IDEMPOTENCY: Prevent duplicate transactions
        // ═══════════════════════════════════════════════════════════════
        var idempotencyKey = IdempotencyKeys.CompensationTransaction(
            request.EmployeeId, 
            DateTime.UtcNow, 
            request.Amount, 
            request.RestaurantName);
        
        return await _idempotencyService.ExecuteOnceAsync(idempotencyKey, async () =>
        {
            // ═══════════════════════════════════════════════════════════════
            // VALIDATION: Employee exists, not deleted, is active
            // ═══════════════════════════════════════════════════════════════
            var employee = await _context.Employees
                .Include(e => e.Project)
                .FirstOrDefaultAsync(e => e.Id == request.EmployeeId, cancellationToken);

            if (employee == null)
                throw new KeyNotFoundException("Сотрудник не найден");

            if (employee.DeletedAt.HasValue)
                throw new InvalidOperationException("Невозможно создать транзакцию для удалённого сотрудника");

            if (!employee.IsActive)
                throw new InvalidOperationException("Невозможно создать транзакцию для неактивного сотрудника");

            // ═══════════════════════════════════════════════════════════════
            // VALIDATION: ServiceType must be COMPENSATION
            // ═══════════════════════════════════════════════════════════════
            if (employee.ServiceType != ServiceType.Compensation)
                throw new InvalidOperationException("Тип услуги сотрудника должен быть 'Компенсация'");

            if (employee.Project == null || !employee.Project.ServiceTypes.Contains("COMPENSATION"))
                throw new InvalidOperationException("Сотрудник не привязан к проекту компенсации");

            var project = employee.Project;

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

            // ═══════════════════════════════════════════════════════════════
            // ATOMIC BUDGET DEDUCTION via BudgetService
            // ═══════════════════════════════════════════════════════════════
            if (companyPays > 0)
            {
                await _budgetService.DeductProjectBudgetAsync(
                    project.Id, 
                    companyPays, // Positive = deduction amount
                    $"Компенсация: {request.RestaurantName ?? "ресторан"}",
                    cancellationToken: cancellationToken);
            }

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
        }, TimeSpan.FromMinutes(5)); // Idempotency window: 5 minutes
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











