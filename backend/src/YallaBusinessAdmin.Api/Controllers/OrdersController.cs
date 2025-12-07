using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Orders;
using YallaBusinessAdmin.Application.Orders.Dtos;

namespace YallaBusinessAdmin.Api.Controllers;

/// <summary>
/// Orders management - freeze/unfreeze orders functionality
/// Critical business rules:
/// - Max 2 freezes per week per employee
/// - Frozen orders extend subscription end date
/// - Only active orders for today or future can be frozen
/// </summary>
[ApiController]
[Route("api/orders")]
[Authorize]
public class OrdersController : BaseApiController
{
    private readonly IOrderFreezeService _orderFreezeService;

    public OrdersController(IOrderFreezeService orderFreezeService)
    {
        _orderFreezeService = orderFreezeService;
    }

    /// <summary>
    /// Заморозить заказ (отменить обед с переносом в конец подписки)
    /// </summary>
    [HttpPost("{id:guid}/freeze")]
    public async Task<ActionResult> FreezeOrder(Guid id, [FromBody] FreezeOrderRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _orderFreezeService.FreezeOrderAsync(id, request, companyId.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Разморозить заказ (вернуть в активное состояние)
    /// </summary>
    [HttpPost("{id:guid}/unfreeze")]
    public async Task<ActionResult> UnfreezeOrder(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _orderFreezeService.UnfreezeOrderAsync(id, companyId.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Заморозить период (отпуск и т.д.)
    /// </summary>
    [HttpPost("freeze-period")]
    public async Task<ActionResult> FreezePeriod([FromBody] FreezePeriodRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _orderFreezeService.FreezePeriodAsync(request, companyId.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Получить информацию о заморозках сотрудника
    /// </summary>
    [HttpGet("employee/{employeeId:guid}/freeze-info")]
    public async Task<ActionResult> GetEmployeeFreezeInfo(Guid employeeId, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _orderFreezeService.GetEmployeeFreezeInfoAsync(employeeId, companyId.Value, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Получить заказы сотрудника
    /// </summary>
    [HttpGet("employee/{employeeId:guid}")]
    public async Task<ActionResult> GetEmployeeOrders(
        Guid employeeId,
        [FromQuery] DateOnly? startDate,
        [FromQuery] DateOnly? endDate,
        CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _orderFreezeService.GetEmployeeOrdersAsync(employeeId, startDate, endDate, companyId.Value, cancellationToken);
        return Ok(result);
    }
}

