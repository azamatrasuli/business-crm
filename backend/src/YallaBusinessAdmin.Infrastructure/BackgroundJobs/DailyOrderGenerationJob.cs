using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

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
                // Convert to project's timezone
                var tz = TimeZoneInfo.FindSystemTimeZoneById(project.Timezone);
                var projectNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
                var projectTimeNow = TimeOnly.FromDateTime(projectNow);
                var projectToday = DateOnly.FromDateTime(projectNow);
                var dayOfWeek = (int)projectNow.DayOfWeek; // 0 = Sunday

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
                        ls.Status == "Активна" &&
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

                    // Check if today is a working day for this employee
                    if (employee.WorkingDays != null && employee.WorkingDays.Length > 0)
                    {
                        if (!employee.WorkingDays.Contains(dayOfWeek))
                        {
                            continue; // Skip non-working days
                        }
                    }

                    // Check if order already exists for this employee today
                    var existingOrder = await context.Orders
                        .AnyAsync(o => 
                            o.EmployeeId == employee.Id &&
                            o.OrderDate.Date == projectToday.ToDateTime(TimeOnly.MinValue).Date,
                            cancellationToken);

                    if (existingOrder)
                        continue;

                    // Get combo price
                    var price = subscription.ComboType switch
                    {
                        "Комбо 25" => 25m,
                        "Комбо 35" => 35m,
                        _ => 25m
                    };

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



