using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.MealSubscriptions;
using YallaBusinessAdmin.Application.MealSubscriptions.Dtos;

namespace YallaBusinessAdmin.Api.Controllers;

/// <summary>
/// Meal Subscriptions - КРИТИЧЕСКИЙ КОНТРОЛЛЕР для Lunch функционала
/// Все исключения обрабатываются глобальным обработчиком
/// 
/// Важные бизнес-правила:
/// - Минимум 5 дней подписки
/// - Нельзя создать подписку на прошедшие даты  
/// - Freeze limit: 2 в неделю
/// - Cutoff time блокирует изменения на сегодня
/// - Адрес наследуется от проекта сотрудника (immutable)
/// </summary>
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

    [HttpGet]
    public async Task<ActionResult<IEnumerable<SubscriptionResponse>>> GetAll([FromQuery] Guid projectId)
    {
        var subscriptions = await _subscriptionsService.GetAllAsync(projectId);
        return Ok(subscriptions);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SubscriptionResponse>> GetById(Guid id)
    {
        var subscription = await _subscriptionsService.GetByIdAsync(id);
        if (subscription == null)
            throw new KeyNotFoundException("Подписка не найдена");
        return Ok(subscription);
    }

    /// <summary>
    /// Create subscription - validates min 5 days, no past dates, budget
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<SubscriptionResponse>> Create([FromBody] CreateSubscriptionRequest request)
    {
        var userId = GetUserId();
        var subscription = await _subscriptionsService.CreateAsync(request, userId);
        return CreatedAtAction(nameof(GetById), new { id = subscription.Id }, subscription);
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult> Cancel(Guid id)
    {
        var result = await _subscriptionsService.CancelAsync(id);
        if (!result)
            throw new KeyNotFoundException("Подписка не найдена");
        return Ok(new { success = true, message = "Подписка отменена" });
    }

    [HttpPost("{id:guid}/pause")]
    public async Task<ActionResult> Pause(Guid id)
    {
        var result = await _subscriptionsService.PauseAsync(id);
        if (!result)
            throw new KeyNotFoundException("Подписка не найдена");
        return Ok(new { success = true, message = "Подписка приостановлена" });
    }

    [HttpPost("{id:guid}/resume")]
    public async Task<ActionResult> Resume(Guid id)
    {
        var result = await _subscriptionsService.ResumeAsync(id);
        if (!result)
            throw new KeyNotFoundException("Подписка не найдена");
        return Ok(new { success = true, message = "Подписка возобновлена" });
    }

    [HttpPost("price-preview")]
    public async Task<ActionResult<decimal>> PricePreview([FromBody] CreateSubscriptionRequest request)
    {
        var price = await _subscriptionsService.CalculateTotalPriceAsync(request);
        return Ok(new { totalAmount = price });
    }

    #endregion

    #region Assignments

    [HttpGet("{id:guid}/assignments")]
    public async Task<ActionResult<IEnumerable<MealAssignmentResponse>>> GetAssignments(
        Guid id,
        [FromQuery] DateOnly? fromDate = null,
        [FromQuery] DateOnly? toDate = null)
    {
        var assignments = await _subscriptionsService.GetAssignmentsAsync(id, fromDate, toDate);
        return Ok(assignments);
    }

    [HttpGet("employees/{employeeId:guid}/assignments")]
    public async Task<ActionResult<IEnumerable<MealAssignmentResponse>>> GetEmployeeAssignments(
        Guid employeeId,
        [FromQuery] DateOnly? fromDate = null,
        [FromQuery] DateOnly? toDate = null)
    {
        var assignments = await _subscriptionsService.GetEmployeeAssignmentsAsync(employeeId, fromDate, toDate);
        return Ok(assignments);
    }

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
    /// Update assignment - Address is IMMUTABLE
    /// </summary>
    [HttpPut("assignments/{assignmentId:guid}")]
    public async Task<ActionResult<MealAssignmentResponse>> UpdateAssignment(
        Guid assignmentId,
        [FromBody] UpdateAssignmentRequest request)
    {
        var assignment = await _subscriptionsService.UpdateAssignmentAsync(assignmentId, request.ComboType);
        if (assignment == null)
            throw new KeyNotFoundException("Назначение не найдено");
        return Ok(assignment);
    }

    [HttpPost("assignments/{assignmentId:guid}/cancel")]
    public async Task<ActionResult> CancelAssignment(Guid assignmentId)
    {
        var result = await _subscriptionsService.CancelAssignmentAsync(assignmentId);
        if (!result)
            throw new KeyNotFoundException("Назначение не найдено");
        return Ok(new { success = true, message = "Назначение отменено" });
    }

    #endregion

    #region Freeze

    [HttpGet("employees/{employeeId:guid}/freeze-info")]
    public async Task<ActionResult<FreezeInfoResponse>> GetFreezeInfo(Guid employeeId)
    {
        var info = await _subscriptionsService.GetFreezeInfoAsync(employeeId);
        return Ok(info);
    }

    /// <summary>
    /// Freeze assignment - LIMIT: 2 per week!
    /// Throws FREEZE_LIMIT_EXCEEDED if exceeded
    /// </summary>
    [HttpPost("assignments/{assignmentId:guid}/freeze")]
    public async Task<ActionResult<MealAssignmentResponse>> FreezeAssignment(
        Guid assignmentId,
        [FromBody] FreezeRequest? request = null)
    {
        var assignment = await _subscriptionsService.FreezeAssignmentAsync(assignmentId, request?.Reason);
        if (assignment == null)
            throw new KeyNotFoundException("Назначение не найдено");
        return Ok(assignment);
    }

    [HttpPost("assignments/{assignmentId:guid}/unfreeze")]
    public async Task<ActionResult<MealAssignmentResponse>> UnfreezeAssignment(Guid assignmentId)
    {
        var assignment = await _subscriptionsService.UnfreezeAssignmentAsync(assignmentId);
        if (assignment == null)
            throw new KeyNotFoundException("Назначение не найдено");
        return Ok(assignment);
    }

    #endregion

    #region Calendar

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
            return userId;
        return null;
    }
}

public record UpdateAssignmentRequest(string? ComboType = null, Guid? DeliveryAddressId = null);
public record FreezeRequest(string? Reason = null);
