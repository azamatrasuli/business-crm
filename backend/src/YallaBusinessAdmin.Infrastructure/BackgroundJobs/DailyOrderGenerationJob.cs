using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Domain.Helpers;
using YallaBusinessAdmin.Infrastructure.Persistence;
using YallaBusinessAdmin.Infrastructure.Services.Dashboard;

namespace YallaBusinessAdmin.Infrastructure.BackgroundJobs;

/// <summary>
/// Background job that generates daily orders from lunch subscriptions.
/// Runs daily at configured cutoff time for each project.
/// Creates orders for employees with active subscriptions on their working days.
/// </summary>
public class DailyOrderGenerationJob : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DailyOrderGenerationJob> _logger;

    public DailyOrderGenerationJob(
        IServiceScopeFactory scopeFactory,
        ILogger<DailyOrderGenerationJob> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("DailyOrderGenerationJob started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessDailyOrdersAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in DailyOrderGenerationJob");
            }

            // Run every hour to check for cutoff times
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }

    private async Task ProcessDailyOrdersAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Get all projects with active subscriptions
        var projects = await context.Projects
            .Where(p => p.DeletedAt == null && p.Status == CompanyStatus.Active)
            .ToListAsync(cancellationToken);

        foreach (var project in projects)
        {
            try
            {
                // ═══════════════════════════════════════════════════════════════
                // SKIP projects without delivery address
                // ═══════════════════════════════════════════════════════════════
                if (string.IsNullOrWhiteSpace(project.AddressFullAddress))
                {
                    _logger.LogWarning(
                        "Skipping project {ProjectName} (ID: {ProjectId}) - no delivery address configured",
                        project.Name, project.Id);
                    continue;
                }

                // Convert to project's timezone
                var tz = TimeZoneInfo.FindSystemTimeZoneById(project.Timezone);
                var projectNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
                var projectTimeNow = TimeOnly.FromDateTime(projectNow);
                var projectToday = DateOnly.FromDateTime(projectNow);

                // Skip if before cutoff time
                if (projectTimeNow < project.CutoffTime)
                    continue;

                // ═══════════════════════════════════════════════════════════════
                // PROCESS LUNCH SUBSCRIPTIONS (individual employee subscriptions)
                // ═══════════════════════════════════════════════════════════════
                var lunchSubscriptions = await context.LunchSubscriptions
                    .Include(ls => ls.Employee)
                    .Where(ls => 
                        ls.ProjectId == project.Id &&
                        ls.IsActive &&
                        ls.Status == SubscriptionStatus.Active &&
                        ls.Employee != null &&
                        ls.Employee.IsActive &&
                        ls.Employee.DeletedAt == null &&
                        // Check if subscription period is valid
                        (ls.StartDate == null || ls.StartDate <= projectToday) &&
                        (ls.EndDate == null || ls.EndDate >= projectToday))
                    .ToListAsync(cancellationToken);

                var ordersCreated = 0;
                var totalCost = 0m;

                foreach (var subscription in lunchSubscriptions)
                {
                    var employee = subscription.Employee!;

                    // CRITICAL FIX: Skip CUSTOM schedule type subscriptions
                    // For CUSTOM, orders are created at subscription creation time with specific dates.
                    // We should NOT auto-generate daily orders for CUSTOM subscriptions.
                    // Normalize schedule type to handle legacy WEEKDAYS → EVERY_DAY
                    var normalizedScheduleType = ScheduleTypeHelper.Normalize(subscription.ScheduleType);
                    if (normalizedScheduleType == ScheduleTypeHelper.Custom)
                    {
                        continue; // Custom schedules have pre-created orders
                    }

                    // Check if today should have an order based on schedule type:
                    // - EVERY_DAY: all working days (Mon-Fri or employee's schedule)
                    // - EVERY_OTHER_DAY: Mon, Wed, Fri only (if they're working days)
                    if (!WorkingDaysHelper.ShouldCreateOrderForDate(normalizedScheduleType, employee.WorkingDays, projectToday))
                    {
                        continue; // Skip days that don't match the schedule
                    }

                    // Check if order already exists for this employee today
                    // CRITICAL FIX: Use UTC DateTime for Postgres compatibility
                    var todayUtc = DateTime.SpecifyKind(projectToday.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
                    var existingOrder = await context.Orders
                        .AnyAsync(o => 
                            o.EmployeeId == employee.Id &&
                            o.OrderDate.Date == todayUtc.Date,
                            cancellationToken);

                    if (existingOrder)
                        continue;

                    // Get combo price from centralized constants
                    var price = ComboPricingConstants.GetPrice(subscription.ComboType);

                    // Create order from lunch subscription
                    var order = new Order
                    {
                        Id = Guid.NewGuid(),
                        CompanyId = project.CompanyId,
                        ProjectId = project.Id,
                        EmployeeId = employee.Id,
                        ComboType = subscription.ComboType,
                        Price = price,
                        CurrencyCode = project.CurrencyCode,
                        Status = OrderStatus.Active,
                        OrderDate = projectToday.ToDateTime(TimeOnly.Parse("12:00")),
                        IsGuestOrder = false,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    context.Orders.Add(order);
                    ordersCreated++;
                    totalCost += price;
                }

                if (ordersCreated > 0)
                {
                    // Deduct from project budget
                    project.Budget -= totalCost;
                    project.UpdatedAt = DateTime.UtcNow;

                    await context.SaveChangesAsync(cancellationToken);

                    _logger.LogInformation(
                        "Generated {Count} orders for project {ProjectName}, deducted {Amount} {Currency}",
                        ordersCreated, project.Name, totalCost, project.CurrencyCode);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing project {ProjectId}", project.Id);
            }
        }
    }
}



