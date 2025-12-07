using YallaBusinessAdmin.Application.Projects.Dtos;

namespace YallaBusinessAdmin.Application.Projects;

public interface IProjectsService
{
    /// <summary>Get all projects for a company</summary>
    Task<IEnumerable<ProjectListItem>> GetAllAsync(Guid companyId);
    
    /// <summary>Get project by ID</summary>
    Task<ProjectResponse?> GetByIdAsync(Guid id);
    
    /// <summary>Create a new project</summary>
    Task<ProjectResponse> CreateAsync(Guid companyId, CreateProjectRequest request);
    
    /// <summary>Update a project</summary>
    Task<ProjectResponse?> UpdateAsync(Guid id, UpdateProjectRequest request);
    
    /// <summary>Soft delete a project</summary>
    Task<bool> DeleteAsync(Guid id);
    
    /// <summary>Get project statistics (for dashboard)</summary>
    Task<ProjectStatsResponse> GetStatsAsync(Guid projectId);
}

public record ProjectStatsResponse(
    Guid ProjectId,
    string ProjectName,
    decimal Budget,
    decimal TotalSpent,
    int ActiveEmployees,
    int TotalOrders,
    int TodayOrders
);













