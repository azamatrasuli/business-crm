// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// FREEZE FUNCTIONALITY DISABLED
// This controller is temporarily disabled as part of status system refactoring.
// The freeze endpoints will be re-enabled in future versions when courier integration is added.
// Last updated: 2025-01-09
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

/*
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Orders;
using YallaBusinessAdmin.Application.Orders.Dtos;

namespace YallaBusinessAdmin.Api.Controllers;

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

    [HttpPost("{id:guid}/freeze")]
    public async Task<ActionResult> FreezeOrder(Guid id, [FromBody] FreezeOrderRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _orderFreezeService.FreezeOrderAsync(id, request, companyId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id:guid}/unfreeze")]
    public async Task<ActionResult> UnfreezeOrder(Guid id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _orderFreezeService.UnfreezeOrderAsync(id, companyId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpPost("freeze-period")]
    public async Task<ActionResult> FreezePeriod([FromBody] FreezePeriodRequest request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _orderFreezeService.FreezePeriodAsync(request, companyId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpGet("employee/{employeeId:guid}/freeze-info")]
    public async Task<ActionResult> GetEmployeeFreezeInfo(Guid employeeId, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == null)
            return Unauthorized(new { success = false, error = new { code = "AUTH_UNAUTHORIZED", message = "Требуется авторизация", type = "Forbidden" } });

        var result = await _orderFreezeService.GetEmployeeFreezeInfoAsync(employeeId, companyId.Value, cancellationToken);
        return Ok(result);
    }

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
*/
