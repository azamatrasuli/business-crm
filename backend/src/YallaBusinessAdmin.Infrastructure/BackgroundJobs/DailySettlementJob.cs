using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using YallaBusinessAdmin.Application.Common.Interfaces;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.BackgroundJobs;

/// <summary>
/// Background job that settles daily orders at the end of each day.
///
/// BUSINESS LOGIC:
/// 1. Runs after cutoff time for each project (timezone-aware)
/// 2. Finds all Active orders for today
/// 3. Marks them as Completed (delivered)
/// 4. Deducts budget via BudgetService (atomic, with audit trail)
///
/// This implements "end-of-day settlement" pattern:
/// - Orders are created without budget deduction
/// - Budget is deducted only when order is actually delivered (Completed)
/// - Cancellations before settlement = no refund needed
/// - Cancellations after settlement = refund required
/// </summary>
public class DailySettlementJob : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DailySettlementJob> _logger;

    /// <summary>
    /// How often to check for settlements (every 30 minutes)
    /// </summary>
    private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(30);

    public DailySettlementJob(
        IServiceScopeFactory scopeFactory,
        ILogger<DailySettlementJob> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("DailySettlementJob started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessSettlementsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in DailySettlementJob");
            }

            await Task.Delay(CheckInterval, stoppingToken);
        }
    }

    private async Task ProcessSettlementsAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var budgetService = scope.ServiceProvider.GetRequiredService<IBudgetService>();

        // Get all active projects
        var projects = await context.Projects
            .Where(p => p.DeletedAt == null && p.Status == CompanyStatus.Active)
            .ToListAsync(cancellationToken);

        foreach (var project in projects)
        {
            try
            {
                await ProcessProjectSettlementAsync(context, budgetService, project, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing settlement for project {ProjectId}", project.Id);
            }
        }
    }

    private async Task ProcessProjectSettlementAsync(
        AppDbContext context,
        IBudgetService budgetService,
        Project project,
        CancellationToken cancellationToken)
    {
        // ═══════════════════════════════════════════════════════════════
        // TIMEZONE-AWARE: Use project's timezone for "today" and cutoff
        // ═══════════════════════════════════════════════════════════════
        var tz = TimeZoneInfo.FindSystemTimeZoneById(project.Timezone ?? "Asia/Dushanbe");
        var projectNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        var projectTimeNow = TimeOnly.FromDateTime(projectNow);
        var projectToday = DateOnly.FromDateTime(projectNow);

        // ═══════════════════════════════════════════════════════════════
        // SETTLEMENT WINDOW: Only settle AFTER cutoff time
        // This ensures orders can still be modified until cutoff
        // ═══════════════════════════════════════════════════════════════
        if (projectTimeNow < project.CutoffTime)
        {
            return; // Too early for settlement
        }

        // ═══════════════════════════════════════════════════════════════
        // FIND ORDERS TO SETTLE:
        // - Active status (not already Completed/Cancelled/Paused)
        // - Order date = today (in project's timezone)
        // - Belongs to this project
        // ═══════════════════════════════════════════════════════════════
        var todayStart = projectToday.ToDateTime(TimeOnly.MinValue);
        var todayEnd = projectToday.AddDays(1).ToDateTime(TimeOnly.MinValue);

        // Convert to UTC for database query
        var todayStartUtc = DateTime.SpecifyKind(todayStart, DateTimeKind.Utc);
        var todayEndUtc = DateTime.SpecifyKind(todayEnd, DateTimeKind.Utc);

        var ordersToSettle = await context.Orders
            .Where(o =>
                o.ProjectId == project.Id &&
                o.Status == OrderStatus.Active &&
                o.OrderDate >= todayStartUtc &&
                o.OrderDate < todayEndUtc)
            .ToListAsync(cancellationToken);

        if (ordersToSettle.Count == 0)
        {
            return; // Nothing to settle
        }

        // ═══════════════════════════════════════════════════════════════
        // ATOMIC SETTLEMENT: Mark as Completed and deduct budget
        // ═══════════════════════════════════════════════════════════════
        var totalAmount = ordersToSettle.Sum(o => o.Price);
        var employeeCount = ordersToSettle.Where(o => !o.IsGuestOrder).Select(o => o.EmployeeId).Distinct().Count();
        var guestCount = ordersToSettle.Count(o => o.IsGuestOrder);

        // Mark all orders as Completed
        foreach (var order in ordersToSettle)
        {
            order.Status = OrderStatus.Completed;
            order.UpdatedAt = DateTime.UtcNow;
        }

        // Build description - only info NOT in other columns (no date, no amount)
        var descriptionParts = new List<string>();
        if (employeeCount > 0)
        {
            var word = employeeCount == 1 ? "сотрудник" : 
                       employeeCount < 5 ? "сотрудника" : "сотрудников";
            descriptionParts.Add($"{employeeCount} {word}");
        }
        if (guestCount > 0)
        {
            var word = guestCount == 1 ? "гость" : 
                       guestCount < 5 ? "гостя" : "гостей";
            descriptionParts.Add($"{guestCount} {word}");
        }
        var description = string.Join(", ", descriptionParts);

        // Atomic budget deduction with audit trail
        await budgetService.DeductProjectBudgetAsync(
            project.Id,
            totalAmount,
            description,
            null, // No single order ID - this is a batch settlement
            cancellationToken);

        await context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Settlement completed for project {ProjectName}: {OrderCount} orders, {Amount} {Currency}",
            project.Name,
            ordersToSettle.Count,
            totalAmount,
            project.CurrencyCode);
    }
}




