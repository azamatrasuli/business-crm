using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.BackgroundJobs;

/// <summary>
/// Background job that generates daily orders from meal assignments.
/// Runs daily at configured cutoff time for each project.
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

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var now = TimeOnly.FromDateTime(DateTime.UtcNow);

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

                // Skip if before cutoff time
                if (projectTimeNow < project.CutoffTime)
                    continue;

                // Get meal assignments for today that haven't been processed
                var assignments = await context.EmployeeMealAssignments
                    .Include(a => a.Employee)
                    .Include(a => a.Subscription)
                    .Where(a => 
                        a.Subscription!.ProjectId == project.Id &&
                        a.AssignmentDate == projectToday &&
                        a.Status == MealAssignmentStatus.Scheduled)
                    .ToListAsync(cancellationToken);

                if (!assignments.Any())
                    continue;

                _logger.LogInformation(
                    "Processing {Count} assignments for project {ProjectName} on {Date}",
                    assignments.Count, project.Name, projectToday);

                foreach (var assignment in assignments)
                {
                    // Check if order already exists for this employee today
                    var existingOrder = await context.Orders
                        .AnyAsync(o => 
                            o.EmployeeId == assignment.EmployeeId &&
                            o.OrderDate.Date == projectToday.ToDateTime(TimeOnly.MinValue).Date,
                            cancellationToken);

                    if (existingOrder)
                    {
                        assignment.Status = MealAssignmentStatus.Active;
                        assignment.UpdatedAt = DateTime.UtcNow;
                        continue;
                    }

                    // Create order from assignment
                    // NOTE: Address is derived from Project (one project = one address)
                    var order = new Order
                    {
                        Id = Guid.NewGuid(),
                        CompanyId = project.CompanyId,
                        ProjectId = project.Id,
                        EmployeeId = assignment.EmployeeId,
                        ComboType = assignment.ComboType,
                        Price = assignment.Price,
                        CurrencyCode = project.CurrencyCode,
                        Status = OrderStatus.Active,
                        OrderDate = projectToday.ToDateTime(TimeOnly.MinValue),
                        IsGuestOrder = false,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    context.Orders.Add(order);

                    // Update assignment status
                    assignment.Status = MealAssignmentStatus.Active;
                    assignment.UpdatedAt = DateTime.UtcNow;
                }

                // Deduct from project budget
                var totalCost = assignments.Sum(a => a.Price);
                project.Budget -= totalCost;
                project.UpdatedAt = DateTime.UtcNow;

                await context.SaveChangesAsync(cancellationToken);

                _logger.LogInformation(
                    "Generated {Count} orders for project {ProjectName}, deducted {Amount} {Currency}",
                    assignments.Count, project.Name, totalCost, project.CurrencyCode);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing project {ProjectId}", project.Id);
            }
        }
    }
}



