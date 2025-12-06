using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Projects;
using YallaBusinessAdmin.Application.Projects.Dtos;

namespace YallaBusinessAdmin.Api.Controllers;

[ApiController]
[Route("api/projects")]
[Authorize]
public class ProjectsController : BaseApiController
{
    private readonly IProjectsService _projectsService;

    public ProjectsController(IProjectsService projectsService)
    {
        _projectsService = projectsService;
    }

    /// <summary>
    /// Get all projects for the current company
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProjectListItem>>> GetAll()
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        var projects = await _projectsService.GetAllAsync(companyId.Value);
        return Ok(projects);
    }

    /// <summary>
    /// Get project by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProjectResponse>> GetById(Guid id)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        var project = await _projectsService.GetByIdAsync(id);
        
        if (project == null)
        {
            return NotFound(new { message = "Проект не найден" });
        }

        // Verify project belongs to user's company
        if (project.CompanyId != companyId.Value)
        {
            return Forbid();
        }

        return Ok(project);
    }

    /// <summary>
    /// Create a new project
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ProjectResponse>> Create([FromBody] CreateProjectRequest request)
    {
        var readOnlyCheck = CheckReadOnlyMode();
        if (readOnlyCheck != null) return readOnlyCheck;
        
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        try
        {
            var project = await _projectsService.CreateAsync(companyId.Value, request);
            return CreatedAtAction(nameof(GetById), new { id = project.Id }, project);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Update a project
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProjectResponse>> Update(Guid id, [FromBody] UpdateProjectRequest request)
    {
        var readOnlyCheck = CheckReadOnlyMode();
        if (readOnlyCheck != null) return readOnlyCheck;
        
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        // First check if project exists and belongs to company
        var existing = await _projectsService.GetByIdAsync(id);
        if (existing == null)
        {
            return NotFound(new { message = "Проект не найден" });
        }
        if (existing.CompanyId != companyId.Value)
        {
            return Forbid();
        }

        try
        {
            var project = await _projectsService.UpdateAsync(id, request);
            return Ok(project);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Delete a project (soft delete)
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id)
    {
        var readOnlyCheck = CheckReadOnlyMode();
        if (readOnlyCheck != null) return readOnlyCheck;
        
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        // First check if project exists and belongs to company
        var existing = await _projectsService.GetByIdAsync(id);
        if (existing == null)
        {
            return NotFound(new { message = "Проект не найден" });
        }
        if (existing.CompanyId != companyId.Value)
        {
            return Forbid();
        }

        var deleted = await _projectsService.DeleteAsync(id);
        if (!deleted)
        {
            return NotFound(new { message = "Проект не найден" });
        }

        return NoContent();
    }

    /// <summary>
    /// Get project statistics (for dashboard)
    /// </summary>
    [HttpGet("{id:guid}/stats")]
    public async Task<ActionResult<ProjectStatsResponse>> GetStats(Guid id)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        // First check if project exists and belongs to company
        var existing = await _projectsService.GetByIdAsync(id);
        if (existing == null)
        {
            return NotFound(new { message = "Проект не найден" });
        }
        if (existing.CompanyId != companyId.Value)
        {
            return Forbid();
        }

        try
        {
            var stats = await _projectsService.GetStatsAsync(id);
            return Ok(stats);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Get available service types
    /// </summary>
    [HttpGet("service-types")]
    [AllowAnonymous]
    public ActionResult<IEnumerable<object>> GetServiceTypes()
    {
        var types = new[]
        {
            new { value = "LUNCH", label = "Ланч (комплексные обеды)" },
            new { value = "COMPENSATION", label = "Компенсация" }
        };
        return Ok(types);
    }

}












