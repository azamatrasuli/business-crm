using YallaBusinessAdmin.Application.Compensation.Dtos;

namespace YallaBusinessAdmin.Application.Compensation;

/// <summary>
/// Service for handling compensation-type projects
/// (where employees pay at partner restaurants and get reimbursed)
/// </summary>
public interface ICompensationService
{
    /// <summary>Get compensation settings for a project</summary>
    Task<CompensationSettingsResponse> GetSettingsAsync(Guid projectId, CancellationToken cancellationToken = default);
    
    /// <summary>Update compensation settings for a project</summary>
    Task<CompensationSettingsResponse> UpdateSettingsAsync(
        Guid projectId, 
        UpdateCompensationSettingsRequest request, 
        CancellationToken cancellationToken = default);
    
    /// <summary>Get employee's current compensation balance</summary>
    Task<EmployeeCompensationResponse> GetEmployeeBalanceAsync(
        Guid employeeId, 
        CancellationToken cancellationToken = default);
    
    /// <summary>Process a compensation transaction (when employee pays at restaurant)</summary>
    Task<CompensationTransactionResponse> ProcessTransactionAsync(
        CreateCompensationTransactionRequest request, 
        CancellationToken cancellationToken = default);
    
    /// <summary>Get compensation transactions for an employee</summary>
    Task<IEnumerable<CompensationTransactionResponse>> GetTransactionsAsync(
        Guid employeeId, 
        DateOnly? fromDate = null, 
        DateOnly? toDate = null,
        CancellationToken cancellationToken = default);
    
    /// <summary>Get daily summary of compensations for a project</summary>
    Task<DailyCompensationSummary> GetDailySummaryAsync(
        Guid projectId, 
        DateOnly date, 
        CancellationToken cancellationToken = default);
}











