using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Subscriptions;
using YallaBusinessAdmin.Application.Subscriptions.Dtos;

namespace YallaBusinessAdmin.Api.Controllers;

[ApiController]
[Route("api/subscriptions")]
[Authorize]
public class SubscriptionsController : BaseApiController
{
    private readonly ISubscriptionsService _subscriptionsService;

    public SubscriptionsController(ISubscriptionsService subscriptionsService)
    {
        _subscriptionsService = subscriptionsService;
    }

    /// <summary>
    /// Get all lunch subscriptions
    /// </summary>
    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] bool? isActive = null,
        CancellationToken cancellationToken = default)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        var result = await _subscriptionsService.GetAllAsync(companyId.Value, page, pageSize, search, isActive, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Get subscription by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        try
        {
            var result = await _subscriptionsService.GetByIdAsync(id, companyId.Value, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Get subscription by employee ID
    /// </summary>
    [HttpGet("employee/{employeeId:guid}")]
    public async Task<ActionResult> GetByEmployeeId(Guid employeeId, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        try
        {
            var result = await _subscriptionsService.GetByEmployeeIdAsync(employeeId, companyId.Value, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Create a new subscription
    /// </summary>
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateSubscriptionRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        try
        {
            var result = await _subscriptionsService.CreateAsync(request, companyId.Value, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
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
    /// Update a subscription
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult> Update(Guid id, [FromBody] UpdateSubscriptionDetailsRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        try
        {
            var result = await _subscriptionsService.UpdateAsync(id, request, companyId.Value, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Delete a subscription
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        try
        {
            await _subscriptionsService.DeleteAsync(id, companyId.Value, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Bulk create subscriptions
    /// </summary>
    [HttpPost("bulk")]
    public async Task<ActionResult> BulkCreate([FromBody] BulkCreateSubscriptionRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        var result = await _subscriptionsService.BulkCreateAsync(request, companyId.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Bulk update subscriptions
    /// </summary>
    [HttpPut("bulk")]
    public async Task<ActionResult> BulkUpdate([FromBody] BulkUpdateSubscriptionRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        var result = await _subscriptionsService.BulkUpdateAsync(request, companyId.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Pause a subscription
    /// </summary>
    [HttpPost("{id:guid}/pause")]
    public async Task<ActionResult> Pause(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        try
        {
            var result = await _subscriptionsService.PauseAsync(id, companyId.Value, cancellationToken);
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
    /// Resume a subscription
    /// </summary>
    [HttpPost("{id:guid}/resume")]
    public async Task<ActionResult> Resume(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        try
        {
            var result = await _subscriptionsService.ResumeAsync(id, companyId.Value, cancellationToken);
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
    /// Bulk pause subscriptions
    /// </summary>
    [HttpPost("bulk/pause")]
    public async Task<ActionResult> BulkPause([FromBody] BulkSubscriptionActionRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        var result = await _subscriptionsService.BulkPauseAsync(request.SubscriptionIds, companyId.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Bulk resume subscriptions
    /// </summary>
    [HttpPost("bulk/resume")]
    public async Task<ActionResult> BulkResume([FromBody] BulkSubscriptionActionRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        var result = await _subscriptionsService.BulkResumeAsync(request.SubscriptionIds, companyId.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Preview price change before updating subscription
    /// </summary>
    [HttpGet("{id:guid}/price-preview")]
    public async Task<ActionResult> GetPricePreview(Guid id, [FromQuery] string comboType, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(comboType))
        {
            return BadRequest(new { message = "Тип комбо обязателен" });
        }

        try
        {
            var result = await _subscriptionsService.GetPricePreviewAsync(id, comboType, companyId.Value, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

}

