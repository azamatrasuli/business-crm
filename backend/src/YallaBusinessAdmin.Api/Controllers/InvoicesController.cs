using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Invoices;
using YallaBusinessAdmin.Application.Invoices.Dtos;

namespace YallaBusinessAdmin.Api.Controllers;

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

    /// <summary>
    /// Get all invoices
    /// </summary>
    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        var result = await _invoicesService.GetAllAsync(companyId.Value, page, pageSize, status, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Get invoice by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        try
        {
            var result = await _invoicesService.GetByIdAsync(id, companyId.Value, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Create a new invoice (for webhooks from Yalla CRM)
    /// </summary>
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateInvoiceRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        try
        {
            var result = await _invoicesService.CreateAsync(request, companyId.Value, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Pay an invoice
    /// </summary>
    [HttpPost("{id:guid}/pay")]
    public async Task<ActionResult> Pay(Guid id, [FromBody] PayInvoiceRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        try
        {
            var result = await _invoicesService.PayAsync(id, request, companyId.Value, cancellationToken);
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

}

