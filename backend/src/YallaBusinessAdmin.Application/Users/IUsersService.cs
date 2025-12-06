using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Users.Dtos;

namespace YallaBusinessAdmin.Application.Users;

public interface IUsersService
{
    Task<PagedResult<UserResponse>> GetAllAsync(
        int page, 
        int pageSize, 
        Guid companyId, 
        string? search = null,
        string? status = null,
        string? role = null,
        string? sortBy = null,
        bool sortDesc = true,
        CancellationToken cancellationToken = default);
    Task<UserResponse> GetByIdAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default);
    Task<UserResponse> CreateAsync(CreateUserRequest request, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default);
    Task<UserResponse> UpdateAsync(Guid id, UpdateUserRequest request, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, Guid companyId, Guid currentUserId, CancellationToken cancellationToken = default);
    IEnumerable<string> GetAvailableRoutes();
    
    /// <summary>
    /// Get all admins across all companies (SUPER_ADMIN only)
    /// </summary>
    Task<IEnumerable<AdminListItem>> GetAllAdminsAsync(string? search = null, CancellationToken cancellationToken = default);
}

