using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Subscriptions;
using YallaBusinessAdmin.Application.Subscriptions.Dtos;

namespace YallaBusinessAdmin.Api.Controllers;

/// <summary>
/// Subscriptions management - all exceptions handled by global exception handler
/// Critical business rules:
/// - Min 5 days subscription period
/// - Cannot create for past dates
/// - Pause/Resume validation
/// </summary>
[ApiController]
[Route("api/subscriptions")]
[Authorize]
public class SubscriptionsController : BaseApiController
{
    private readonly ISubscriptionsService _subscriptionsService;
    private readonly ILogger<SubscriptionsController> _logger;

    public SubscriptionsController(ISubscriptionsService subscriptionsService, ILogger<SubscriptionsController> logger)
    {
        _subscriptionsService = subscriptionsService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] bool? isActive = null,
        CancellationToken cancellationToken = default)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _subscriptionsService.GetAllAsync(companyId.Value, page, pageSize, search, isActive, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _subscriptionsService.GetByIdAsync(id, companyId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpGet("employee/{employeeId:guid}")]
    public async Task<ActionResult> GetByEmployeeId(Guid employeeId, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _subscriptionsService.GetByEmployeeIdAsync(employeeId, companyId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateSubscriptionRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _subscriptionsService.CreateAsync(request, companyId.Value, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult> Update(Guid id, [FromBody] UpdateSubscriptionDetailsRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _subscriptionsService.UpdateAsync(id, request, companyId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        await _subscriptionsService.DeleteAsync(id, companyId.Value, cancellationToken);
        return NoContent();
    }

    [HttpPost("bulk")]
    public async Task<ActionResult> BulkCreate([FromBody] BulkCreateSubscriptionRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        try
        {
            var result = await _subscriptionsService.BulkCreateAsync(request, companyId.Value, cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            var innerMessage = ex.InnerException?.Message ?? "No inner exception";
            var innerInner = ex.InnerException?.InnerException?.Message ?? "No inner-inner exception";
            _logger.LogError(ex, "Error in BulkCreate for company {CompanyId}: {Message}. Inner: {Inner}. InnerInner: {InnerInner}", 
                companyId.Value, ex.Message, innerMessage, innerInner);
            return StatusCode(500, new { 
                success = false, 
                error = new { 
                    code = "SUBSCRIPTION_CREATE_ERROR", 
                    message = $"{ex.Message} | Inner: {innerMessage} | InnerInner: {innerInner}",
                    type = "ServerError" 
                } 
            });
        }
    }

    [HttpPut("bulk")]
    public async Task<ActionResult> BulkUpdate([FromBody] BulkUpdateSubscriptionRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _subscriptionsService.BulkUpdateAsync(request, companyId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id:guid}/pause")]
    public async Task<ActionResult> Pause(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _subscriptionsService.PauseAsync(id, companyId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id:guid}/resume")]
    public async Task<ActionResult> Resume(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _subscriptionsService.ResumeAsync(id, companyId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpPost("bulk/pause")]
    public async Task<ActionResult> BulkPause([FromBody] BulkSubscriptionActionRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _subscriptionsService.BulkPauseAsync(request.SubscriptionIds, companyId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpPost("bulk/resume")]
    public async Task<ActionResult> BulkResume([FromBody] BulkSubscriptionActionRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _subscriptionsService.BulkResumeAsync(request.SubscriptionIds, companyId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}/price-preview")]
    public async Task<ActionResult> GetPricePreview(Guid id, [FromQuery] string comboType, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null) 
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        if (string.IsNullOrWhiteSpace(comboType))
            throw new ArgumentException("Тип комбо обязателен");

        var result = await _subscriptionsService.GetPricePreviewAsync(id, comboType, companyId.Value, cancellationToken);
        return Ok(result);
    }
}
