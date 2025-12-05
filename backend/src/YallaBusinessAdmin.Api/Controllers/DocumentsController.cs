using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Documents;

namespace YallaBusinessAdmin.Api.Controllers;

[ApiController]
[Route("api/documents")]
[Authorize]
public class DocumentsController : ControllerBase
{
    private readonly IDocumentsService _documentsService;

    public DocumentsController(IDocumentsService documentsService)
    {
        _documentsService = documentsService;
    }

    /// <summary>
    /// Get all documents for the company
    /// </summary>
    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? type = null,
        CancellationToken cancellationToken = default)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        var result = await _documentsService.GetAllAsync(companyId.Value, page, pageSize, type, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Get document by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        try
        {
            var result = await _documentsService.GetByIdAsync(id, companyId.Value, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Get download URL for a document
    /// </summary>
    [HttpGet("{id:guid}/download")]
    public async Task<ActionResult> GetDownloadUrl(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        try
        {
            var url = await _documentsService.GetDownloadUrlAsync(id, companyId.Value, cancellationToken);
            return Ok(new { url });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    private Guid? GetCompanyId()
    {
        var companyIdClaim = User.FindFirst("company_id") ?? User.FindFirst("companyId");
        if (companyIdClaim != null && Guid.TryParse(companyIdClaim.Value, out var companyId))
        {
            return companyId;
        }
        return null;
    }
}

