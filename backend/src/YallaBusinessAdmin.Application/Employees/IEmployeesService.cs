using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Employees.Dtos;

namespace YallaBusinessAdmin.Application.Employees;

public interface IEmployeesService
{
    Task<PagedResult<EmployeeResponse>> GetAllAsync(
        int page,
        int pageSize,
        string? search,
        string? statusFilter,
        string? inviteStatusFilter,
        string? orderStatusFilter,
        Guid companyId,
        string? sortBy = null,
        bool sortDesc = true,
        decimal? minBudget = null,
        decimal? maxBudget = null,
        bool? hasSubscription = null,
        Guid? projectId = null,
        CancellationToken cancellationToken = default);

    Task<EmployeeResponse> GetByIdAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default);
    Task<EmployeeResponse> CreateAsync(CreateEmployeeRequest request, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default);
    Task<EmployeeResponse> UpdateAsync(Guid id, UpdateEmployeeRequest request, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default);
    Task<EmployeeResponse> ToggleActivationAsync(Guid id, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default);
    Task UpdateBudgetAsync(Guid id, UpdateBudgetRequest request, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default);
    Task BatchUpdateBudgetAsync(BatchUpdateBudgetRequest request, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default);
    
    Task<PagedResult<EmployeeOrderResponse>> GetEmployeeOrdersAsync(
        Guid id, 
        int page, 
        int pageSize, 
        Guid companyId,
        string? dateFrom = null,
        string? dateTo = null,
        string? status = null,
        CancellationToken cancellationToken = default);
}

