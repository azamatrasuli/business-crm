using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Documents;

namespace YallaBusinessAdmin.Api.Controllers;

/// <summary>
/// Documents - all exceptions handled by global exception handler
/// </summary>
[ApiController]
[Route("api/documents")]
[Authorize]
public class DocumentsController : BaseApiController
{
    private readonly IDocumentsService _documentsService;

    public DocumentsController(IDocumentsService documentsService)
    {
        _documentsService = documentsService;
    }

    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? type = null,
        CancellationToken cancellationToken = default)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _documentsService.GetAllAsync(companyId.Value, page, pageSize, type, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _documentsService.GetByIdAsync(id, companyId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}/download")]
    public async Task<ActionResult> GetDownloadUrl(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var url = await _documentsService.GetDownloadUrlAsync(id, companyId.Value, cancellationToken);
        return Ok(new { url });
    }
}
