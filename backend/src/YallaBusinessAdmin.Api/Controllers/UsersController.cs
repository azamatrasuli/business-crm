using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Users;
using YallaBusinessAdmin.Application.Users.Dtos;

namespace YallaBusinessAdmin.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController : BaseApiController
{
    private readonly IUsersService _usersService;

    public UsersController(IUsersService usersService)
    {
        _usersService = usersService;
    }

    /// <summary>
    /// Get all users for current company with search and filters
    /// </summary>
    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? role = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool sortDesc = true,
        CancellationToken cancellationToken = default)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        var result = await _usersService.GetAllAsync(
            page, pageSize, companyId.Value, 
            search, status, role, sortBy, sortDesc, 
            cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Get user by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        try
        {
            var result = await _usersService.GetByIdAsync(id, companyId.Value, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Create a new user
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<UserResponse>> Create([FromBody] CreateUserRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        var currentUserId = GetUserId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        try
        {
            var result = await _usersService.CreateAsync(request, companyId.Value, currentUserId, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Update user
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<UserResponse>> Update(Guid id, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        var currentUserId = GetUserId();
        if (companyId == null)
        {
            return Unauthorized();
        }

        try
        {
            var result = await _usersService.UpdateAsync(id, request, companyId.Value, currentUserId, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Delete user (soft delete)
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        var currentUserId = GetUserId();
        if (companyId == null || currentUserId == null)
        {
            return Unauthorized();
        }

        try
        {
            await _usersService.DeleteAsync(id, companyId.Value, currentUserId.Value, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Get all admins across all companies (SUPER_ADMIN only)
    /// </summary>
    [HttpGet("all-admins")]
    [Authorize(Roles = "SUPER_ADMIN")]
    public async Task<ActionResult<IEnumerable<AdminListItem>>> GetAllAdmins(
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var admins = await _usersService.GetAllAdminsAsync(search, cancellationToken);
        return Ok(admins);
    }

    /// <summary>
    /// Get available permission routes
    /// </summary>
    [HttpGet("permissions/routes")]
    public ActionResult<IEnumerable<string>> GetRoutes()
    {
        var routes = _usersService.GetAvailableRoutes();
        return Ok(routes);
    }

    /// <summary>
    /// Get available user statuses
    /// </summary>
    [HttpGet("statuses")]
    public ActionResult<IEnumerable<string>> GetStatuses()
    {
        var statuses = new[] { "Активный", "Не активный", "Заблокирован" };
        return Ok(statuses);
    }

    /// <summary>
    /// Get available user roles
    /// </summary>
    [HttpGet("roles")]
    public ActionResult<IEnumerable<string>> GetRoles()
    {
        var roles = new[] { "admin", "manager" };
        return Ok(roles);
    }

}
