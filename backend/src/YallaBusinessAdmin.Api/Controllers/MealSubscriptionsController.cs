using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.MealSubscriptions;
using YallaBusinessAdmin.Application.MealSubscriptions.Dtos;

namespace YallaBusinessAdmin.Api.Controllers;

[ApiController]
[Route("api/meal-subscriptions")]
[Authorize]
public class MealSubscriptionsController : ControllerBase
{
    private readonly IMealSubscriptionsService _subscriptionsService;

    public MealSubscriptionsController(IMealSubscriptionsService subscriptionsService)
    {
        _subscriptionsService = subscriptionsService;
    }

    #region Subscriptions

    /// <summary>
    /// Get all subscriptions for a project
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<SubscriptionResponse>>> GetAll([FromQuery] Guid projectId)
    {
        var subscriptions = await _subscriptionsService.GetAllAsync(projectId);
        return Ok(subscriptions);
    }

    /// <summary>
    /// Get subscription by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SubscriptionResponse>> GetById(Guid id)
    {
        var subscription = await _subscriptionsService.GetByIdAsync(id);
        if (subscription == null)
            return NotFound(new { message = "Подписка не найдена" });
        return Ok(subscription);
    }

    /// <summary>
    /// Create a new subscription
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<SubscriptionResponse>> Create([FromBody] CreateSubscriptionRequest request)
    {
        try
        {
            var userId = GetUserId();
            var subscription = await _subscriptionsService.CreateAsync(request, userId);
            return CreatedAtAction(nameof(GetById), new { id = subscription.Id }, subscription);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Cancel a subscription
    /// </summary>
    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult> Cancel(Guid id)
    {
        var result = await _subscriptionsService.CancelAsync(id);
        if (!result)
            return NotFound(new { message = "Подписка не найдена" });
        return Ok(new { message = "Подписка отменена" });
    }

    /// <summary>
    /// Pause a subscription
    /// </summary>
    [HttpPost("{id:guid}/pause")]
    public async Task<ActionResult> Pause(Guid id)
    {
        var result = await _subscriptionsService.PauseAsync(id);
        if (!result)
            return NotFound(new { message = "Подписка не найдена" });
        return Ok(new { message = "Подписка приостановлена" });
    }

    /// <summary>
    /// Resume a subscription
    /// </summary>
    [HttpPost("{id:guid}/resume")]
    public async Task<ActionResult> Resume(Guid id)
    {
        var result = await _subscriptionsService.ResumeAsync(id);
        if (!result)
            return NotFound(new { message = "Подписка не найдена" });
        return Ok(new { message = "Подписка возобновлена" });
    }

    /// <summary>
    /// Calculate price preview
    /// </summary>
    [HttpPost("price-preview")]
    public async Task<ActionResult<decimal>> PricePreview([FromBody] CreateSubscriptionRequest request)
    {
        var price = await _subscriptionsService.CalculateTotalPriceAsync(request);
        return Ok(new { totalAmount = price });
    }

    #endregion

    #region Assignments

    /// <summary>
    /// Get assignments for a subscription
    /// </summary>
    [HttpGet("{id:guid}/assignments")]
    public async Task<ActionResult<IEnumerable<MealAssignmentResponse>>> GetAssignments(
        Guid id,
        [FromQuery] DateOnly? fromDate = null,
        [FromQuery] DateOnly? toDate = null)
    {
        var assignments = await _subscriptionsService.GetAssignmentsAsync(id, fromDate, toDate);
        return Ok(assignments);
    }

    /// <summary>
    /// Get assignments for an employee
    /// </summary>
    [HttpGet("employees/{employeeId:guid}/assignments")]
    public async Task<ActionResult<IEnumerable<MealAssignmentResponse>>> GetEmployeeAssignments(
        Guid employeeId,
        [FromQuery] DateOnly? fromDate = null,
        [FromQuery] DateOnly? toDate = null)
    {
        var assignments = await _subscriptionsService.GetEmployeeAssignmentsAsync(employeeId, fromDate, toDate);
        return Ok(assignments);
    }

    /// <summary>
    /// Get assignments for a project
    /// </summary>
    [HttpGet("projects/{projectId:guid}/assignments")]
    public async Task<ActionResult<IEnumerable<MealAssignmentResponse>>> GetProjectAssignments(
        Guid projectId,
        [FromQuery] DateOnly? fromDate = null,
        [FromQuery] DateOnly? toDate = null)
    {
        var assignments = await _subscriptionsService.GetProjectAssignmentsAsync(projectId, fromDate, toDate);
        return Ok(assignments);
    }

    /// <summary>
    /// Update an assignment
    /// NOTE: Address cannot be changed - it comes from employee's project
    /// </summary>
    [HttpPut("assignments/{assignmentId:guid}")]
    public async Task<ActionResult<MealAssignmentResponse>> UpdateAssignment(
        Guid assignmentId,
        [FromBody] UpdateAssignmentRequest request)
    {
        // NOTE: Address is immutable - comes from employee's project
        var assignment = await _subscriptionsService.UpdateAssignmentAsync(
            assignmentId, request.ComboType);
        if (assignment == null)
            return NotFound(new { message = "Назначение не найдено" });
        return Ok(assignment);
    }

    /// <summary>
    /// Cancel an assignment
    /// </summary>
    [HttpPost("assignments/{assignmentId:guid}/cancel")]
    public async Task<ActionResult> CancelAssignment(Guid assignmentId)
    {
        var result = await _subscriptionsService.CancelAssignmentAsync(assignmentId);
        if (!result)
            return NotFound(new { message = "Назначение не найдено" });
        return Ok(new { message = "Назначение отменено" });
    }

    #endregion

    #region Freeze

    /// <summary>
    /// Get freeze info for an employee
    /// </summary>
    [HttpGet("employees/{employeeId:guid}/freeze-info")]
    public async Task<ActionResult<FreezeInfoResponse>> GetFreezeInfo(Guid employeeId)
    {
        var info = await _subscriptionsService.GetFreezeInfoAsync(employeeId);
        return Ok(info);
    }

    /// <summary>
    /// Freeze an assignment
    /// </summary>
    [HttpPost("assignments/{assignmentId:guid}/freeze")]
    public async Task<ActionResult<MealAssignmentResponse>> FreezeAssignment(
        Guid assignmentId,
        [FromBody] FreezeRequest? request = null)
    {
        try
        {
            var assignment = await _subscriptionsService.FreezeAssignmentAsync(assignmentId, request?.Reason);
            if (assignment == null)
                return NotFound(new { message = "Назначение не найдено" });
            return Ok(assignment);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Unfreeze an assignment
    /// </summary>
    [HttpPost("assignments/{assignmentId:guid}/unfreeze")]
    public async Task<ActionResult<MealAssignmentResponse>> UnfreezeAssignment(Guid assignmentId)
    {
        var assignment = await _subscriptionsService.UnfreezeAssignmentAsync(assignmentId);
        if (assignment == null)
            return NotFound(new { message = "Назначение не найдено" });
        return Ok(assignment);
    }

    #endregion

    #region Calendar

    /// <summary>
    /// Get calendar view for a project
    /// </summary>
    [HttpGet("calendar")]
    public async Task<ActionResult<IEnumerable<CalendarDayResponse>>> GetCalendar(
        [FromQuery] Guid projectId,
        [FromQuery] DateOnly startDate,
        [FromQuery] DateOnly endDate)
    {
        var calendar = await _subscriptionsService.GetCalendarAsync(projectId, startDate, endDate);
        return Ok(calendar);
    }

    #endregion

    private Guid? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst(JwtRegisteredClaimNames.Sub);
        if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return userId;
        }
        return null;
    }
}

public record UpdateAssignmentRequest(string? ComboType = null, Guid? DeliveryAddressId = null);
public record FreezeRequest(string? Reason = null);


