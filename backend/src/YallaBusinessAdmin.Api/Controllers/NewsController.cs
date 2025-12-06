using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.News;

namespace YallaBusinessAdmin.Api.Controllers;

/// <summary>
/// News (Phase 2) - all exceptions handled by global exception handler
/// </summary>
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

    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        var userRole = GetUserRole();
        if (userId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _newsService.GetAllAsync(userId.Value, userRole ?? "ADMIN", page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _newsService.GetByIdAsync(id, userId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id:guid}/read")]
    public async Task<ActionResult> MarkAsRead(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        await _newsService.MarkAsReadAsync(id, userId.Value, cancellationToken);
        return Ok(new { success = true, message = "Новость отмечена как прочитанная" });
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult> GetUnreadCount(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var userRole = GetUserRole();
        if (userId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var count = await _newsService.GetUnreadCountAsync(userId.Value, userRole ?? "ADMIN", cancellationToken);
        return Ok(new { count });
    }

    private Guid? GetUserId()
    {
        var userIdClaim = User.FindFirst("sub") ?? User.FindFirst("userId") ?? User.FindFirst("user_id");
        if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
            return userId;
        return null;
    }

    private string? GetUserRole()
    {
        return User.FindFirst("role")?.Value ?? User.FindFirst("Role")?.Value;
    }
}
