using System.Globalization;
using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.MealSubscriptions;
using YallaBusinessAdmin.Application.MealSubscriptions.Dtos;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class MealSubscriptionsService : IMealSubscriptionsService
{
    private readonly AppDbContext _context;
    
    private static readonly Dictionary<string, decimal> ComboPrices = new()
    {
        ["Комбо 25"] = 25,
        ["Комбо 35"] = 35
    };

    public MealSubscriptionsService(AppDbContext context)
    {
        _context = context;
    }

    #region Subscription Management

    public async Task<IEnumerable<SubscriptionResponse>> GetAllAsync(Guid projectId)
    {
        var subscriptions = await _context.CompanySubscriptions
            .Include(s => s.Project)
            .Include(s => s.MealAssignments)
            .Where(s => s.ProjectId == projectId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        return subscriptions.Select(MapToResponse);
    }

    public async Task<SubscriptionResponse?> GetByIdAsync(Guid id)
    {
        var subscription = await _context.CompanySubscriptions
            .Include(s => s.Project)
            .Include(s => s.MealAssignments)
            .FirstOrDefaultAsync(s => s.Id == id);

        return subscription == null ? null : MapToResponse(subscription);
    }

    public async Task<SubscriptionResponse> CreateAsync(CreateSubscriptionRequest request, Guid? userId)
    {
        // Validate minimum 5 days
        var totalDays = (request.EndDate.ToDateTime(TimeOnly.MinValue) - request.StartDate.ToDateTime(TimeOnly.MinValue)).Days + 1;
        if (totalDays < 5)
        {
            throw new InvalidOperationException("Минимальный период подписки - 5 дней");
        }

        // Calculate total amount
        var totalAmount = await CalculateTotalPriceAsync(request);

        // Create subscription
        var subscription = new CompanySubscription
        {
            Id = Guid.NewGuid(),
            ProjectId = request.ProjectId,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            TotalDays = totalDays,
            TotalAmount = totalAmount,
            PaidAmount = 0,
            IsPaid = false,
            Status = SubscriptionStatus.Active,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.CompanySubscriptions.Add(subscription);

        // Create meal assignments
        // Address is derived from employee's project (one project = one address)
        foreach (var empReq in request.Employees)
        {
            var dates = GetAssignmentDates(request.StartDate, request.EndDate, empReq.Pattern, empReq.CustomDates);
            var price = ComboPrices.GetValueOrDefault(empReq.ComboType, 25);

            foreach (var date in dates)
            {
                var assignment = new EmployeeMealAssignment
                {
                    Id = Guid.NewGuid(),
                    SubscriptionId = subscription.Id,
                    EmployeeId = empReq.EmployeeId,
                    AssignmentDate = date,
                    ComboType = empReq.ComboType,
                    Price = price,
                    Status = MealAssignmentStatus.Scheduled,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.EmployeeMealAssignments.Add(assignment);
            }
        }

        await _context.SaveChangesAsync();

        // Reload with includes
        var created = await _context.CompanySubscriptions
            .Include(s => s.Project)
            .Include(s => s.MealAssignments)
            .FirstAsync(s => s.Id == subscription.Id);

        return MapToResponse(created);
    }

    public async Task<bool> CancelAsync(Guid id)
    {
        var subscription = await _context.CompanySubscriptions.FindAsync(id);
        if (subscription == null) return false;

        subscription.Status = SubscriptionStatus.Cancelled;
        subscription.UpdatedAt = DateTime.UtcNow;

        // Cancel all future assignments
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var futureAssignments = await _context.EmployeeMealAssignments
            .Where(a => a.SubscriptionId == id && a.AssignmentDate >= today)
            .ToListAsync();

        foreach (var assignment in futureAssignments)
        {
            assignment.Status = MealAssignmentStatus.Cancelled;
            assignment.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> PauseAsync(Guid id)
    {
        var subscription = await _context.CompanySubscriptions
            .Include(s => s.MealAssignments)
            .FirstOrDefaultAsync(s => s.Id == id);
        
        if (subscription == null) return false;
        if (subscription.Status == SubscriptionStatus.Paused) return true; // Already paused

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        
        // Get all future assignments that are active/scheduled
        var futureAssignments = subscription.MealAssignments
            .Where(a => a.AssignmentDate > today && 
                       (a.Status == MealAssignmentStatus.Active || a.Status == MealAssignmentStatus.Scheduled))
            .ToList();

        // Count paused days (only working days)
        var pausedDaysCount = futureAssignments.Count;

        // Set all future assignments to Paused
        foreach (var assignment in futureAssignments)
        {
            assignment.Status = MealAssignmentStatus.Paused;
            assignment.UpdatedAt = DateTime.UtcNow;
        }

        // Update subscription
        subscription.Status = SubscriptionStatus.Paused;
        subscription.PausedAt = DateTime.UtcNow;
        subscription.PausedDaysCount = pausedDaysCount;
        
        // Extend EndDate by paused days count
        if (pausedDaysCount > 0)
        {
            subscription.EndDate = subscription.EndDate.AddDays(pausedDaysCount);
            subscription.TotalDays += pausedDaysCount;
        }
        
        subscription.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ResumeAsync(Guid id)
    {
        var subscription = await _context.CompanySubscriptions
            .Include(s => s.MealAssignments)
            .FirstOrDefaultAsync(s => s.Id == id);
        
        if (subscription == null) return false;
        if (subscription.Status != SubscriptionStatus.Paused) return true; // Not paused

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var pausedDaysCount = subscription.PausedDaysCount;

        // Get all paused assignments
        var pausedAssignments = subscription.MealAssignments
            .Where(a => a.Status == MealAssignmentStatus.Paused)
            .ToList();

        // Reactivate paused assignments
        foreach (var assignment in pausedAssignments)
        {
            assignment.Status = MealAssignmentStatus.Scheduled;
            assignment.UpdatedAt = DateTime.UtcNow;
        }

        // If there are paused days to add, create new assignments at the end
        if (pausedDaysCount > 0 && pausedAssignments.Count > 0)
        {
            // Get a sample assignment to copy properties from
            var sampleAssignment = pausedAssignments.FirstOrDefault();
            if (sampleAssignment != null)
            {
                var oldEndDate = subscription.EndDate.AddDays(-pausedDaysCount);
                var newAssignmentDates = GetWorkingDays(oldEndDate.AddDays(1), subscription.EndDate, pausedDaysCount);
                
                foreach (var date in newAssignmentDates)
                {
                    var newAssignment = new EmployeeMealAssignment
                    {
                        Id = Guid.NewGuid(),
                        SubscriptionId = subscription.Id,
                        EmployeeId = sampleAssignment.EmployeeId,
                        AssignmentDate = date,
                        ComboType = sampleAssignment.ComboType,
                        Price = sampleAssignment.Price,
                        Status = MealAssignmentStatus.Scheduled,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.EmployeeMealAssignments.Add(newAssignment);
                }
            }
        }

        // Update subscription
        subscription.Status = SubscriptionStatus.Active;
        subscription.PausedAt = null;
        subscription.PausedDaysCount = 0;
        subscription.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }
    
    /// <summary>
    /// Get working days (excluding weekends) between two dates
    /// </summary>
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

    #endregion

    #region Assignment Management

    public async Task<IEnumerable<MealAssignmentResponse>> GetAssignmentsAsync(
        Guid subscriptionId, DateOnly? fromDate = null, DateOnly? toDate = null)
    {
        var query = _context.EmployeeMealAssignments
            .Include(a => a.Employee)
                .ThenInclude(e => e!.Project)
            .Where(a => a.SubscriptionId == subscriptionId);

        if (fromDate.HasValue)
            query = query.Where(a => a.AssignmentDate >= fromDate.Value);
        if (toDate.HasValue)
            query = query.Where(a => a.AssignmentDate <= toDate.Value);

        var assignments = await query.OrderBy(a => a.AssignmentDate).ToListAsync();
        return assignments.Select(MapAssignmentToResponse);
    }

    public async Task<IEnumerable<MealAssignmentResponse>> GetEmployeeAssignmentsAsync(
        Guid employeeId, DateOnly? fromDate = null, DateOnly? toDate = null)
    {
        var query = _context.EmployeeMealAssignments
            .Include(a => a.Employee)
                .ThenInclude(e => e!.Project)
            .Where(a => a.EmployeeId == employeeId);

        if (fromDate.HasValue)
            query = query.Where(a => a.AssignmentDate >= fromDate.Value);
        if (toDate.HasValue)
            query = query.Where(a => a.AssignmentDate <= toDate.Value);

        var assignments = await query.OrderBy(a => a.AssignmentDate).ToListAsync();
        return assignments.Select(MapAssignmentToResponse);
    }

    public async Task<IEnumerable<MealAssignmentResponse>> GetProjectAssignmentsAsync(
        Guid projectId, DateOnly? fromDate = null, DateOnly? toDate = null)
    {
        var query = _context.EmployeeMealAssignments
            .Include(a => a.Employee)
                .ThenInclude(e => e!.Project)
            .Include(a => a.Subscription)
            .Where(a => a.Subscription!.ProjectId == projectId);

        if (fromDate.HasValue)
            query = query.Where(a => a.AssignmentDate >= fromDate.Value);
        if (toDate.HasValue)
            query = query.Where(a => a.AssignmentDate <= toDate.Value);

        var assignments = await query.OrderBy(a => a.AssignmentDate).ToListAsync();
        return assignments.Select(MapAssignmentToResponse);
    }

    public async Task<MealAssignmentResponse?> UpdateAssignmentAsync(
        Guid assignmentId, string? comboType = null)
    {
        var assignment = await _context.EmployeeMealAssignments
            .Include(a => a.Employee)
                .ThenInclude(e => e!.Project)
            .FirstOrDefaultAsync(a => a.Id == assignmentId);

        if (assignment == null) return null;

        // NOTE: Address cannot be changed - it comes from employee's project
        
        if (comboType != null)
        {
            assignment.ComboType = comboType;
            assignment.Price = ComboPrices.GetValueOrDefault(comboType, 25);
        }

        assignment.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return MapAssignmentToResponse(assignment);
    }

    public async Task<bool> CancelAssignmentAsync(Guid assignmentId)
    {
        var assignment = await _context.EmployeeMealAssignments.FindAsync(assignmentId);
        if (assignment == null) return false;

        assignment.Status = MealAssignmentStatus.Cancelled;
        assignment.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }

    #endregion

    #region Freeze Management

    public async Task<FreezeInfoResponse> GetFreezeInfoAsync(Guid employeeId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var (weekYear, weekNumber) = GetIsoWeek(today);

        var usedThisWeek = await _context.EmployeeFreezeHistory
            .CountAsync(h => h.EmployeeId == employeeId && 
                           h.WeekYear == weekYear && 
                           h.WeekNumber == weekNumber);

        return new FreezeInfoResponse(
            employeeId,
            Math.Max(0, 2 - usedThisWeek),
            usedThisWeek,
            2
        );
    }

    public async Task<MealAssignmentResponse?> FreezeAssignmentAsync(Guid assignmentId, string? reason = null)
    {
        var assignment = await _context.EmployeeMealAssignments
            .Include(a => a.Employee)
                .ThenInclude(e => e!.Project)
            .FirstOrDefaultAsync(a => a.Id == assignmentId);

        if (assignment == null) return null;

        // Check freeze limit
        var freezeInfo = await GetFreezeInfoAsync(assignment.EmployeeId);
        if (freezeInfo.RemainingFreezes <= 0)
        {
            throw new InvalidOperationException("Достигнут лимит заморозок на эту неделю (2)");
        }

        // Freeze the assignment
        assignment.Status = MealAssignmentStatus.Frozen;
        assignment.FrozenAt = DateTime.UtcNow;
        assignment.FrozenReason = reason;
        assignment.UpdatedAt = DateTime.UtcNow;

        // Record freeze history
        var (weekYear, weekNumber) = GetIsoWeek(assignment.AssignmentDate);
        var freezeRecord = new EmployeeFreezeHistory
        {
            Id = Guid.NewGuid(),
            EmployeeId = assignment.EmployeeId,
            AssignmentId = assignment.Id,
            FrozenAt = DateTime.UtcNow,
            OriginalDate = assignment.AssignmentDate,
            WeekYear = weekYear,
            WeekNumber = weekNumber,
            CreatedAt = DateTime.UtcNow
        };

        _context.EmployeeFreezeHistory.Add(freezeRecord);

        // Extend subscription by adding replacement date
        var subscription = await _context.CompanySubscriptions.FindAsync(assignment.SubscriptionId);
        if (subscription != null)
        {
            var newEndDate = subscription.EndDate.AddDays(1);
            subscription.EndDate = newEndDate;
            subscription.TotalDays++;
            assignment.ReplacementDate = newEndDate;
        }

        await _context.SaveChangesAsync();

        return MapAssignmentToResponse(assignment);
    }

    public async Task<MealAssignmentResponse?> UnfreezeAssignmentAsync(Guid assignmentId)
    {
        var assignment = await _context.EmployeeMealAssignments
            .Include(a => a.Employee)
                .ThenInclude(e => e!.Project)
            .FirstOrDefaultAsync(a => a.Id == assignmentId);

        if (assignment == null) return null;

        assignment.Status = MealAssignmentStatus.Scheduled;
        assignment.FrozenAt = null;
        assignment.FrozenReason = null;
        assignment.ReplacementDate = null;
        assignment.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return MapAssignmentToResponse(assignment);
    }

    #endregion

    #region Calendar

    public async Task<IEnumerable<CalendarDayResponse>> GetCalendarAsync(
        Guid projectId, DateOnly startDate, DateOnly endDate)
    {
        var assignments = await _context.EmployeeMealAssignments
            .Include(a => a.Subscription)
            .Where(a => a.Subscription!.ProjectId == projectId &&
                       a.AssignmentDate >= startDate &&
                       a.AssignmentDate <= endDate)
            .ToListAsync();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var result = new List<CalendarDayResponse>();

        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            var dayAssignments = assignments.Where(a => a.AssignmentDate == date).ToList();
            
            result.Add(new CalendarDayResponse(
                date,
                dayAssignments.Count,
                dayAssignments.Count(a => a.Status == MealAssignmentStatus.Active || a.Status == MealAssignmentStatus.Scheduled),
                dayAssignments.Count(a => a.Status == MealAssignmentStatus.Frozen),
                dayAssignments.Count(a => a.Status == MealAssignmentStatus.Delivered),
                date.DayOfWeek == DayOfWeek.Saturday || date.DayOfWeek == DayOfWeek.Sunday,
                date < today
            ));
        }

        return result;
    }

    #endregion

    #region Price Calculation

    public async Task<decimal> CalculateTotalPriceAsync(CreateSubscriptionRequest request)
    {
        decimal total = 0;

        foreach (var empReq in request.Employees)
        {
            var dates = GetAssignmentDates(request.StartDate, request.EndDate, empReq.Pattern, empReq.CustomDates);
            var price = ComboPrices.GetValueOrDefault(empReq.ComboType, 25);
            total += dates.Count * price;
        }

        return await Task.FromResult(total);
    }

    #endregion

    #region Helpers

    private static List<DateOnly> GetAssignmentDates(DateOnly start, DateOnly end, string pattern, List<DateOnly>? customDates)
    {
        if (pattern == "CUSTOM" && customDates != null)
        {
            return customDates.Where(d => d >= start && d <= end).ToList();
        }

        var dates = new List<DateOnly>();
        var current = start;
        var skip = pattern == "EVERY_OTHER_DAY";
        var skipNext = false;

        while (current <= end)
        {
            // Skip weekends
            if (current.DayOfWeek != DayOfWeek.Saturday && current.DayOfWeek != DayOfWeek.Sunday)
            {
                if (!skip || !skipNext)
                {
                    dates.Add(current);
                }
                skipNext = !skipNext;
            }
            current = current.AddDays(1);
        }

        return dates;
    }

    private static (int Year, int Week) GetIsoWeek(DateOnly date)
    {
        var dt = date.ToDateTime(TimeOnly.MinValue);
        var week = ISOWeek.GetWeekOfYear(dt);
        var year = ISOWeek.GetYear(dt);
        return (year, week);
    }

    private static SubscriptionResponse MapToResponse(CompanySubscription s)
    {
        return new SubscriptionResponse(
            s.Id,
            s.ProjectId,
            s.Project?.Name ?? "",
            s.Project?.AddressName ?? "",
            s.Project?.AddressFullAddress ?? "",
            s.StartDate,
            s.EndDate,
            s.TotalDays,
            s.TotalAmount,
            s.PaidAmount,
            s.IsPaid,
            s.Status.ToRussian(),
            s.CreatedAt,
            s.MealAssignments?.Count ?? 0,
            s.MealAssignments?.Count(a => a.Status == MealAssignmentStatus.Active || a.Status == MealAssignmentStatus.Scheduled) ?? 0,
            s.MealAssignments?.Count(a => a.Status == MealAssignmentStatus.Frozen) ?? 0,
            s.MealAssignments?.Count(a => a.Status == MealAssignmentStatus.Paused) ?? 0,
            s.PausedAt,
            s.PausedDaysCount
        );
    }

    private static MealAssignmentResponse MapAssignmentToResponse(EmployeeMealAssignment a)
    {
        // Address comes from employee's project
        return new MealAssignmentResponse(
            a.Id,
            a.EmployeeId,
            a.Employee?.FullName ?? "",
            a.AssignmentDate,
            a.ComboType,
            a.Price,
            a.Status.ToRussian(),
            a.Employee?.Project?.AddressName ?? "",
            a.Employee?.Project?.AddressFullAddress ?? "",
            a.FrozenAt,
            a.FrozenReason,
            a.ReplacementDate
        );
    }

    #endregion
}


