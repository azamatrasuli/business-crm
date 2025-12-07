using YallaBusinessAdmin.Application.Employees.Dtos;

namespace YallaBusinessAdmin.Application.Employees;

/// <summary>
/// Service for managing employee budgets.
/// Separated from IEmployeesService for SRP compliance.
/// </summary>
public interface IEmployeeBudgetService
{
    /// <summary>
    /// Updates the budget for a specific employee.
    /// </summary>
    Task UpdateBudgetAsync(
        Guid employeeId, 
        UpdateBudgetRequest request, 
        Guid companyId, 
        Guid? currentUserId = null, 
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates budgets for multiple employees at once.
    /// </summary>
    Task BatchUpdateBudgetAsync(
        BatchUpdateBudgetRequest request, 
        Guid companyId, 
        Guid? currentUserId = null, 
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets budget details for a specific employee.
    /// </summary>
    Task<BudgetResponse?> GetBudgetAsync(
        Guid employeeId, 
        Guid companyId, 
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Resets budget for the new period (monthly/weekly).
    /// </summary>
    Task ResetBudgetForPeriodAsync(
        Guid employeeId, 
        Guid companyId, 
        CancellationToken cancellationToken = default);
}

