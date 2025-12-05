using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.BackgroundJobs;

/// <summary>
/// Background job that handles subscription auto-renewal.
/// Runs daily to check for expiring subscriptions.
/// </summary>
public class SubscriptionAutoRenewalJob : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SubscriptionAutoRenewalJob> _logger;

    public SubscriptionAutoRenewalJob(
        IServiceScopeFactory scopeFactory,
        ILogger<SubscriptionAutoRenewalJob> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("SubscriptionAutoRenewalJob started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessAutoRenewalsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SubscriptionAutoRenewalJob");
            }

            // Run once per day at midnight UTC
            var now = DateTime.UtcNow;
            var nextRun = now.Date.AddDays(1);
            var delay = nextRun - now;
            await Task.Delay(delay, stoppingToken);
        }
    }

    private async Task ProcessAutoRenewalsAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        
        // Find subscriptions ending today or expired that need renewal
        var expiringSubscriptions = await context.CompanySubscriptions
            .Include(s => s.Project)
            .Include(s => s.MealAssignments)
                .ThenInclude(a => a.Employee)
            .Where(s => 
                s.Status == SubscriptionStatus.Active &&
                s.EndDate <= today)
            .ToListAsync(cancellationToken);

        foreach (var subscription in expiringSubscriptions)
        {
            try
            {
                // Mark current subscription as completed
                subscription.Status = SubscriptionStatus.Completed;
                subscription.UpdatedAt = DateTime.UtcNow;

                // Check if project has auto-renewal enabled and sufficient budget
                var project = subscription.Project;
                if (project == null)
                    continue;

                // Get unique employees from the subscription
                // NOTE: Address is now derived from Project (one project = one address)
                var employeeAssignments = subscription.MealAssignments
                    .Where(a => a.Status != MealAssignmentStatus.Cancelled)
                    .GroupBy(a => a.EmployeeId)
                    .Select(g => new 
                    {
                        EmployeeId = g.Key,
                        ComboType = g.First().ComboType,
                        DaysCount = g.Count()
                    })
                    .ToList();

                if (!employeeAssignments.Any())
                    continue;

                // Calculate cost for renewal (same duration)
                var pricePerCombo = GetComboPrice(subscription.MealAssignments.First().ComboType);
                var totalMeals = employeeAssignments.Sum(e => e.DaysCount);
                var renewalCost = totalMeals * pricePerCombo;

                // Check budget (including overdraft)
                var availableBudget = project.Budget + project.OverdraftLimit;
                if (renewalCost > availableBudget)
                {
                    _logger.LogWarning(
                        "Insufficient budget for auto-renewal of subscription {SubscriptionId}. Required: {Required}, Available: {Available}",
                        subscription.Id, renewalCost, availableBudget);
                    continue;
                }

                // Create new subscription
                var newStartDate = subscription.EndDate.AddDays(1);
                var newEndDate = newStartDate.AddDays(subscription.TotalDays - 1);

                var newSubscription = new CompanySubscription
                {
                    Id = Guid.NewGuid(),
                    ProjectId = subscription.ProjectId,
                    StartDate = newStartDate,
                    EndDate = newEndDate,
                    TotalDays = subscription.TotalDays,
                    TotalAmount = renewalCost,
                    PaidAmount = 0,
                    IsPaid = false,
                    Status = SubscriptionStatus.Active,
                    CreatedByUserId = null, // System auto-renewal
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                context.CompanySubscriptions.Add(newSubscription);

                // Create meal assignments for new subscription
                // NOTE: Address is derived from Employee's Project (one project = one address)
                foreach (var emp in employeeAssignments)
                {
                    var dates = GetWorkingDays(newStartDate, newEndDate, emp.DaysCount);
                    foreach (var date in dates)
                    {
                        var assignment = new EmployeeMealAssignment
                        {
                            Id = Guid.NewGuid(),
                            SubscriptionId = newSubscription.Id,
                            EmployeeId = emp.EmployeeId,
                            AssignmentDate = date,
                            ComboType = emp.ComboType,
                            Price = pricePerCombo,
                            Status = MealAssignmentStatus.Scheduled,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };

                        context.EmployeeMealAssignments.Add(assignment);
                    }
                }

                await context.SaveChangesAsync(cancellationToken);

                _logger.LogInformation(
                    "Auto-renewed subscription {OldId} -> {NewId} for project {ProjectName}",
                    subscription.Id, newSubscription.Id, project.Name);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error auto-renewing subscription {SubscriptionId}", subscription.Id);
            }
        }
    }

    private static decimal GetComboPrice(string comboType)
    {
        return comboType switch
        {
            "Комбо 25" => 25,
            "Комбо 35" => 35,
            _ => 25
        };
    }

    private static List<DateOnly> GetWorkingDays(DateOnly start, DateOnly end, int maxDays)
    {
        var dates = new List<DateOnly>();
        var current = start;

        while (current <= end && dates.Count < maxDays)
        {
            if (current.DayOfWeek != DayOfWeek.Saturday && current.DayOfWeek != DayOfWeek.Sunday)
            {
                dates.Add(current);
            }
            current = current.AddDays(1);
        }

        return dates;
    }
}



