using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Projects;
using YallaBusinessAdmin.Application.Projects.Dtos;

namespace YallaBusinessAdmin.Api.Controllers;

/// <summary>
/// Projects - all exceptions handled by global exception handler
/// Critical: Address is IMMUTABLE after creation!
/// </summary>
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

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProjectListItem>>> GetAll()
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var projects = await _projectsService.GetAllAsync(companyId.Value);
        return Ok(projects);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProjectResponse>> GetById(Guid id)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var project = await _projectsService.GetByIdAsync(id);
        
        if (project == null)
            throw new KeyNotFoundException("Проект не найден");

        if (project.CompanyId != companyId.Value)
            throw new InvalidOperationException("Проект не принадлежит вашей компании");

        return Ok(project);
    }

    [HttpPost]
    public async Task<ActionResult<ProjectResponse>> Create([FromBody] CreateProjectRequest request)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var project = await _projectsService.CreateAsync(companyId.Value, request);
        return CreatedAtAction(nameof(GetById), new { id = project.Id }, project);
    }

    /// <summary>
    /// Update project - NOTE: Address cannot be changed!
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProjectResponse>> Update(Guid id, [FromBody] UpdateProjectRequest request)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var existing = await _projectsService.GetByIdAsync(id);
        if (existing == null)
            throw new KeyNotFoundException("Проект не найден");
        if (existing.CompanyId != companyId.Value)
            throw new InvalidOperationException("Проект не принадлежит вашей компании");

        var project = await _projectsService.UpdateAsync(id, request);
        return Ok(project);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var existing = await _projectsService.GetByIdAsync(id);
        if (existing == null)
            throw new KeyNotFoundException("Проект не найден");
        if (existing.CompanyId != companyId.Value)
            throw new InvalidOperationException("Проект не принадлежит вашей компании");

        var deleted = await _projectsService.DeleteAsync(id);
        if (!deleted)
            throw new KeyNotFoundException("Проект не найден");

        return NoContent();
    }

    [HttpGet("{id:guid}/stats")]
    public async Task<ActionResult<ProjectStatsResponse>> GetStats(Guid id)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var existing = await _projectsService.GetByIdAsync(id);
        if (existing == null)
            throw new KeyNotFoundException("Проект не найден");
        if (existing.CompanyId != companyId.Value)
            throw new InvalidOperationException("Проект не принадлежит вашей компании");

        var stats = await _projectsService.GetStatsAsync(id);
        return Ok(stats);
    }

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
