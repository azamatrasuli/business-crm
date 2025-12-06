using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Invoices;
using YallaBusinessAdmin.Application.Invoices.Dtos;

namespace YallaBusinessAdmin.Api.Controllers;

/// <summary>
/// Invoices - all exceptions handled by global exception handler
/// </summary>
[ApiController]
[Route("api/invoices")]
[Authorize]
public class InvoicesController : BaseApiController
{
    private readonly IInvoicesService _invoicesService;

    public InvoicesController(IInvoicesService invoicesService)
    {
        _invoicesService = invoicesService;
    }

    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _invoicesService.GetAllAsync(companyId.Value, page, pageSize, status, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _invoicesService.GetByIdAsync(id, companyId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateInvoiceRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _invoicesService.CreateAsync(request, companyId.Value, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPost("{id:guid}/pay")]
    public async Task<ActionResult> Pay(Guid id, [FromBody] PayInvoiceRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _invoicesService.PayAsync(id, request, companyId.Value, cancellationToken);
        return Ok(result);
    }
}
