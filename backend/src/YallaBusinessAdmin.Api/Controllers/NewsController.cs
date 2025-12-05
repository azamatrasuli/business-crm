using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.News;

namespace YallaBusinessAdmin.Api.Controllers;

[ApiController]
[Route("api/news")]
[Authorize]
public class NewsController : ControllerBase
{
    private readonly INewsService _newsService;

    public NewsController(INewsService newsService)
    {
        _newsService = newsService;
    }

    /// <summary>
    /// Get all published news for the current user
    /// </summary>
    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        var userRole = GetUserRole();
        if (userId == null) return Unauthorized();

        var result = await _newsService.GetAllAsync(userId.Value, userRole ?? "ADMIN", page, pageSize, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Get news by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var result = await _newsService.GetByIdAsync(id, userId.Value, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Mark a news item as read
    /// </summary>
    [HttpPost("{id:guid}/read")]
    public async Task<ActionResult> MarkAsRead(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        try
        {
            await _newsService.MarkAsReadAsync(id, userId.Value, cancellationToken);
            return Ok(new { message = "Новость отмечена как прочитанная" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Get unread news count for the current user
    /// </summary>
    [HttpGet("unread-count")]
    public async Task<ActionResult> GetUnreadCount(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var userRole = GetUserRole();
        if (userId == null) return Unauthorized();

        var count = await _newsService.GetUnreadCountAsync(userId.Value, userRole ?? "ADMIN", cancellationToken);
        return Ok(new { count });
    }

    private Guid? GetUserId()
    {
        var userIdClaim = User.FindFirst("sub") ?? User.FindFirst("userId") ?? User.FindFirst("user_id");
        if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return userId;
        }
        return null;
    }

    private string? GetUserRole()
    {
        return User.FindFirst("role")?.Value ?? User.FindFirst("Role")?.Value;
    }
}

