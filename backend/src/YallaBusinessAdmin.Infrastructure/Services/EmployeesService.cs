using System.Globalization;
using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Audit;
using YallaBusinessAdmin.Application.Common.Errors;
using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Common.Validators;
using YallaBusinessAdmin.Application.Employees;
using YallaBusinessAdmin.Application.Employees.Dtos;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class EmployeesService : IEmployeesService
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;
    private readonly IEmployeeBudgetService _budgetService;
    private readonly IEmployeeOrderHistoryService _orderHistoryService;

    public EmployeesService(
        AppDbContext context,
        IAuditService auditService,
        IEmployeeBudgetService budgetService,
        IEmployeeOrderHistoryService orderHistoryService)
    {
        _context = context;
        _auditService = auditService;
        _budgetService = budgetService;
        _orderHistoryService = orderHistoryService;
    }

    public async Task<PagedResult<EmployeeResponse>> GetAllAsync(
        int page,
        int pageSize,
        string? search,
        string? statusFilter,
        string? inviteStatusFilter,
        string? orderStatusFilter,
        Guid companyId,
        string? sortBy = null,
        bool sortDesc = true,
        decimal? minBudget = null,
        decimal? maxBudget = null,
        bool? hasSubscription = null,
        Guid? projectId = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Employees
            .AsNoTracking()
            .Include(e => e.Budget)
            .Include(e => e.Project)
            .Include(e => e.Orders.Where(o => o.OrderDate >= DateTime.UtcNow.Date))
            .Include(e => e.LunchSubscription)
            .Where(e => e.CompanyId == companyId);

        // Apply project filter
        if (projectId.HasValue)
        {
            query = query.Where(e => e.ProjectId == projectId.Value);
        }

        // Apply search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(e =>
                e.FullName.ToLower().Contains(searchLower) ||
                e.Phone.Contains(searchLower) ||
                e.Email.ToLower().Contains(searchLower));
        }

        // Apply status filter
        if (!string.IsNullOrWhiteSpace(statusFilter))
        {
            query = statusFilter.ToLower() switch
            {
                "active" => query.Where(e => e.IsActive),
                "inactive" => query.Where(e => !e.IsActive),
                _ => query
            };
        }

        // Apply invite status filter
        if (!string.IsNullOrWhiteSpace(inviteStatusFilter))
        {
            var inviteStatus = EmployeeInviteStatusExtensions.FromRussian(inviteStatusFilter);
            query = query.Where(e => e.InviteStatus == inviteStatus);
        }

        // Apply order status filter (meal status)
        if (!string.IsNullOrWhiteSpace(orderStatusFilter))
        {
            query = orderStatusFilter.ToLower() switch
            {
                "ordered" or "заказан" => query.Where(e => e.Orders.Any(o => o.OrderDate == DateTime.UtcNow.Date)),
                "not_ordered" or "не заказан" => query.Where(e => !e.Orders.Any(o => o.OrderDate == DateTime.UtcNow.Date)),
                _ => query
            };
        }

        // Apply budget range filter
        if (minBudget.HasValue)
        {
            query = query.Where(e => e.Budget != null && e.Budget.TotalBudget >= minBudget.Value);
        }
        if (maxBudget.HasValue)
        {
            query = query.Where(e => e.Budget != null && e.Budget.TotalBudget <= maxBudget.Value);
        }

        // Apply subscription filter
        if (hasSubscription.HasValue)
        {
            query = hasSubscription.Value
                ? query.Where(e => e.LunchSubscription != null && e.LunchSubscription.IsActive == true)
                : query.Where(e => e.LunchSubscription == null || e.LunchSubscription.IsActive != true);
        }

        // Apply sorting
        query = sortBy?.ToLower() switch
        {
            "fullname" or "name" => sortDesc
                ? query.OrderByDescending(e => e.FullName)
                : query.OrderBy(e => e.FullName),
            "phone" => sortDesc
                ? query.OrderByDescending(e => e.Phone)
                : query.OrderBy(e => e.Phone),
            "email" => sortDesc
                ? query.OrderByDescending(e => e.Email)
                : query.OrderBy(e => e.Email),
            "budget" => sortDesc
                ? query.OrderByDescending(e => e.Budget != null ? e.Budget.TotalBudget : 0)
                : query.OrderBy(e => e.Budget != null ? e.Budget.TotalBudget : 0),
            "status" => sortDesc
                ? query.OrderByDescending(e => e.IsActive)
                : query.OrderBy(e => e.IsActive),
            _ => sortDesc
                ? query.OrderByDescending(e => e.CreatedAt)
                : query.OrderBy(e => e.CreatedAt)
        };

        var total = await query.CountAsync(cancellationToken);
        var employees = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = employees.Select(MapToResponse);
        return PagedResult<EmployeeResponse>.Create(items, total, page, pageSize);
    }

    public async Task<EmployeeResponse> GetByIdAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default)
    {
        var employee = await _context.Employees
            .AsNoTracking()
            .Include(e => e.Budget)
            .Include(e => e.Project)
            .Include(e => e.Orders.Where(o => o.OrderDate >= DateTime.UtcNow.Date.AddDays(-7)))
            .Include(e => e.LunchSubscription)
            .FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, cancellationToken);

        if (employee == null)
        {
            throw new KeyNotFoundException("Сотрудник не найден");
        }

        return MapToResponse(employee);
    }

    public async Task<EmployeeResponse> CreateAsync(CreateEmployeeRequest request, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default)
    {
        // Validate required fields
        if (string.IsNullOrWhiteSpace(request.Phone))
        {
            throw new InvalidOperationException("Телефон обязателен для заполнения");
        }

        if (string.IsNullOrWhiteSpace(request.FullName))
        {
            throw new InvalidOperationException("ФИО обязательно для заполнения");
        }

        // Validate phone format using Domain model method
        if (!Employee.IsValidPhoneFormat(request.Phone))
        {
            throw new InvalidOperationException("Неверный формат телефона. Телефон должен начинаться с + и содержать только цифры");
        }

        // Validate email format
        var emailValidation = EmployeeValidator.ValidateEmail(request.Email);
        if (!emailValidation.IsValid)
        {
            throw new InvalidOperationException(emailValidation.ErrorMessage);
        }

        // Validate working days
        var workingDaysValidation = EmployeeValidator.ValidateWorkingDays(request.WorkingDays);
        if (!workingDaysValidation.IsValid)
        {
            throw new InvalidOperationException(workingDaysValidation.ErrorMessage);
        }

        // Validate work time
        var startTimeValidation = EmployeeValidator.ValidateAndParseTime(request.WorkStartTime, "Время начала работы");
        if (!startTimeValidation.IsValid)
        {
            throw new InvalidOperationException(startTimeValidation.ErrorMessage);
        }

        var endTimeValidation = EmployeeValidator.ValidateAndParseTime(request.WorkEndTime, "Время окончания работы");
        if (!endTimeValidation.IsValid)
        {
            throw new InvalidOperationException(endTimeValidation.ErrorMessage);
        }

        var timeRangeValidation = EmployeeValidator.ValidateWorkTimeRange(startTimeValidation.Time, endTimeValidation.Time);
        if (!timeRangeValidation.IsValid)
        {
            throw new InvalidOperationException(timeRangeValidation.ErrorMessage);
        }

        // Validate project exists and belongs to the company
        var project = await _context.Projects
            .FirstOrDefaultAsync(p => p.Id == request.ProjectId && p.CompanyId == companyId, cancellationToken);

        if (project == null)
        {
            throw new InvalidOperationException("Указанный проект не найден или не принадлежит вашей компании");
        }

        // Check for duplicate phone across all employees (including deleted)
        var existingByPhone = await _context.Employees
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.Phone == request.Phone, cancellationToken);

        if (existingByPhone != null)
        {
            if (existingByPhone.DeletedAt != null)
            {
                throw new ConflictException(
                    ErrorCodes.EMP_PHONE_DELETED,
                    ErrorMessages.GetMessage(ErrorCodes.EMP_PHONE_DELETED),
                    new Dictionary<string, object> { ["field"] = "phone" });
            }
            throw new ConflictException(
                ErrorCodes.EMP_PHONE_EXISTS,
                ErrorMessages.GetMessage(ErrorCodes.EMP_PHONE_EXISTS),
                new Dictionary<string, object> { ["field"] = "phone" });
        }

        // Check for duplicate email across all employees (including deleted)
        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var existingByEmail = await _context.Employees
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(e => e.Email == request.Email, cancellationToken);

            if (existingByEmail != null)
            {
                if (existingByEmail.DeletedAt != null)
                {
                    throw new ConflictException(
                        ErrorCodes.EMP_EMAIL_DELETED,
                        ErrorMessages.GetMessage(ErrorCodes.EMP_EMAIL_DELETED),
                        new Dictionary<string, object> { ["field"] = "email" });
                }
                throw new ConflictException(
                    ErrorCodes.EMP_EMAIL_EXISTS,
                    ErrorMessages.GetMessage(ErrorCodes.EMP_EMAIL_EXISTS),
                    new Dictionary<string, object> { ["field"] = "email" });
            }
        }

        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            ProjectId = request.ProjectId,
            FullName = request.FullName,
            Phone = request.Phone,
            Email = request.Email,
            Position = request.Position,
            IsActive = true,
            // TODO: вернуть EmployeeInviteStatus.Pending когда запустим Client Web и бюджетирование
            InviteStatus = EmployeeInviteStatus.Accepted,
            // Service type and work schedule
            ServiceType = !string.IsNullOrWhiteSpace(request.ServiceType)
                ? ServiceTypeExtensions.FromDatabase(request.ServiceType)
                : null,
            ShiftType = !string.IsNullOrWhiteSpace(request.ShiftType)
                ? ShiftTypeExtensions.FromDatabase(request.ShiftType)
                : null,
            WorkingDays = request.WorkingDays,
            // Use pre-validated TimeOnly values (validation done above)
            WorkStartTime = startTimeValidation.Time,
            WorkEndTime = endTimeValidation.Time,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // Create default budget
        var budget = new EmployeeBudget
        {
            Id = Guid.NewGuid(),
            EmployeeId = employee.Id,
            TotalBudget = 0,
            DailyLimit = 0,
            Period = BudgetPeriod.Monthly,
            AutoRenew = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _context.Employees.AddAsync(employee, cancellationToken);
        await _context.EmployeeBudgets.AddAsync(budget, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        // Audit log
        await _auditService.LogAsync(
            currentUserId,
            AuditActions.Create,
            AuditEntityTypes.Employee,
            employee.Id,
            newValues: new { employee.FullName, employee.Phone, employee.Email, employee.Position },
            cancellationToken: cancellationToken);

        employee.Budget = budget;
        return MapToResponse(employee);
    }

    public async Task<EmployeeResponse> UpdateAsync(Guid id, UpdateEmployeeRequest request, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default)
    {
        var employee = await _context.Employees
            .IgnoreQueryFilters() // Include soft-deleted to check and report
            .Include(e => e.Budget)
            .Include(e => e.Project)
            .Include(e => e.Orders.Where(o => o.OrderDate >= DateTime.UtcNow.Date))
            .Include(e => e.LunchSubscription) // Need this for service type validation
            .FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, cancellationToken);

        if (employee == null)
        {
            throw new KeyNotFoundException("Сотрудник не найден");
        }

        // ═══════════════════════════════════════════════════════════════
        // VALIDATION: Cannot update deleted employee
        // ═══════════════════════════════════════════════════════════════
        if (employee.DeletedAt.HasValue)
        {
            throw new InvalidOperationException("Невозможно обновить удалённого сотрудника. Сначала восстановите сотрудника.");
        }

        var oldValues = new { employee.FullName, employee.Email, employee.Position, employee.ProjectId, employee.ServiceType, employee.ShiftType };

        if (!string.IsNullOrWhiteSpace(request.FullName))
            employee.FullName = request.FullName;
        if (!string.IsNullOrWhiteSpace(request.Email))
            employee.Email = request.Email;
        if (request.Position != null)
            employee.Position = request.Position;
        if (request.ProjectId.HasValue)
            employee.ProjectId = request.ProjectId.Value;

        // ═══════════════════════════════════════════════════════════════
        // Service Type Update - Uses Rich Domain Model method
        // ═══════════════════════════════════════════════════════════════
        if (!string.IsNullOrWhiteSpace(request.ServiceType))
        {
            var newServiceType = ServiceTypeExtensions.FromDatabase(request.ServiceType);
            // Domain method handles business rule validation
            employee.SwitchServiceType(newServiceType);
        }

        // ═══════════════════════════════════════════════════════════════
        // Work Schedule Update
        // ═══════════════════════════════════════════════════════════════
        if (!string.IsNullOrWhiteSpace(request.ShiftType))
        {
            employee.ShiftType = ShiftTypeExtensions.FromDatabase(request.ShiftType);
        }

        if (request.WorkingDays != null)
        {
            employee.WorkingDays = request.WorkingDays;
        }

        if (!string.IsNullOrWhiteSpace(request.WorkStartTime))
        {
            employee.WorkStartTime = TimeOnly.Parse(request.WorkStartTime);
        }

        if (!string.IsNullOrWhiteSpace(request.WorkEndTime))
        {
            employee.WorkEndTime = TimeOnly.Parse(request.WorkEndTime);
        }

        employee.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        // Audit log
        await _auditService.LogAsync(
            currentUserId,
            AuditActions.Update,
            AuditEntityTypes.Employee,
            employee.Id,
            oldValues: oldValues,
            newValues: new { employee.FullName, employee.Email, employee.Position },
            cancellationToken: cancellationToken);

        return MapToResponse(employee);
    }

    public async Task<EmployeeResponse> ToggleActivationAsync(Guid id, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default)
    {
        var employee = await _context.Employees
            .Include(e => e.Budget)
            .Include(e => e.Orders)
            .FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, cancellationToken);

        if (employee == null)
        {
            throw new KeyNotFoundException("Сотрудник не найден");
        }

        var wasActive = employee.IsActive;

        // Use Rich Domain Model methods
        if (wasActive)
        {
            employee.Deactivate(); // This also pauses active orders
        }
        else
        {
            employee.Activate();
        }

        await _context.SaveChangesAsync(cancellationToken);

        // Audit log
        await _auditService.LogAsync(
            currentUserId,
            employee.IsActive ? AuditActions.Activate : AuditActions.Deactivate,
            AuditEntityTypes.Employee,
            employee.Id,
            oldValues: new { IsActive = wasActive },
            newValues: new { IsActive = employee.IsActive },
            cancellationToken: cancellationToken);

        return MapToResponse(employee);
    }

    public async Task DeleteAsync(Guid id, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default)
    {
        var employee = await _context.Employees
            .IgnoreQueryFilters() // Include soft-deleted to check and report
            .Include(e => e.Orders)
            .Include(e => e.LunchSubscription)
            .FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, cancellationToken);

        if (employee == null)
        {
            throw new KeyNotFoundException("Сотрудник не найден");
        }

        // ═══════════════════════════════════════════════════════════════
        // VALIDATION: Cannot delete already deleted employee
        // ═══════════════════════════════════════════════════════════════
        if (employee.DeletedAt.HasValue)
        {
            throw new InvalidOperationException("Сотрудник уже удалён");
        }

        var oldValues = new { employee.FullName, employee.Phone, employee.Email };

        // Use Rich Domain Model method - handles all cascading operations
        employee.SoftDelete();

        await _context.SaveChangesAsync(cancellationToken);

        // Audit log
        await _auditService.LogAsync(
            currentUserId,
            AuditActions.Delete,
            AuditEntityTypes.Employee,
            employee.Id,
            oldValues: oldValues,
            cancellationToken: cancellationToken);
    }

    /// <summary>
    /// Delegates to IEmployeeBudgetService for SRP compliance.
    /// Kept for backwards compatibility.
    /// </summary>
    public async Task UpdateBudgetAsync(Guid id, UpdateBudgetRequest request, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default)
    {
        await _budgetService.UpdateBudgetAsync(id, request, companyId, currentUserId, cancellationToken);
    }

    /// <summary>
    /// Delegates to IEmployeeBudgetService for SRP compliance.
    /// Kept for backwards compatibility.
    /// </summary>
    public async Task BatchUpdateBudgetAsync(BatchUpdateBudgetRequest request, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default)
    {
        await _budgetService.BatchUpdateBudgetAsync(request, companyId, currentUserId, cancellationToken);
    }

    /// <summary>
    /// Delegates to IEmployeeOrderHistoryService for SRP compliance.
    /// Kept for backwards compatibility.
    /// </summary>
    public async Task<PagedResult<EmployeeOrderResponse>> GetEmployeeOrdersAsync(
        Guid id,
        int page,
        int pageSize,
        Guid companyId,
        string? dateFrom = null,
        string? dateTo = null,
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        return await _orderHistoryService.GetOrderHistoryAsync(id, page, pageSize, companyId, dateFrom, dateTo, status, cancellationToken);
    }

    private static EmployeeResponse MapToResponse(Employee employee)
    {
        var todayOrder = employee.Orders
            .FirstOrDefault(o => o.OrderDate.Date == DateTime.UtcNow.Date);

        var latestOrder = employee.Orders
            .OrderByDescending(o => o.OrderDate)
            .FirstOrDefault();

        // Use Rich Domain Model properties
        var hasActiveLunchSubscription = employee.HasActiveLunchSubscription;

        // TODO: Add real compensation tracking when available
        var hasActiveCompensation = false; // placeholder

        // Calculate subscription dates and remaining days from LunchSubscription
        DateOnly? subscriptionStartDate = null;
        DateOnly? subscriptionEndDate = null;
        int? remainingDays = null;
        string? switchBlockedReason = null;
        string subscriptionStatus = "Активна";
        decimal? totalPrice = null;

        // Order statistics for subscription
        int futureOrdersCount = 0;
        int completedOrdersCount = 0;
        int? totalDays = null;
        string subscriptionScheduleType = "EVERY_DAY";
        List<string>? customDays = null;

        if (hasActiveLunchSubscription && employee.LunchSubscription != null)
        {
            var sub = employee.LunchSubscription;

            subscriptionStartDate = sub.StartDate;
            subscriptionEndDate = sub.EndDate;
            totalPrice = sub.TotalPrice;
            subscriptionStatus = sub.Status ?? "Активна";
            totalDays = sub.TotalDays;

            // Use Rich Domain Model method for remaining days
            remainingDays = employee.GetSubscriptionRemainingDays() ?? sub.RemainingDays;

            // Count future orders (today and forward, Active or Frozen status)
            var today = DateTime.UtcNow.Date;
            futureOrdersCount = employee.Orders.Count(o =>
                o.OrderDate.Date >= today &&
                (o.Status == Domain.Enums.OrderStatus.Active || o.Status == Domain.Enums.OrderStatus.Frozen));

            // Count completed orders (Delivered or Completed status)
            completedOrdersCount = employee.Orders.Count(o =>
                o.Status == Domain.Enums.OrderStatus.Delivered ||
                o.Status == Domain.Enums.OrderStatus.Completed);

            // Get schedule type
            subscriptionScheduleType = sub.ScheduleType ?? "EVERY_DAY";

            // For CUSTOM schedules, extract dates from orders
            if (subscriptionScheduleType == "CUSTOM" && subscriptionStartDate.HasValue && subscriptionEndDate.HasValue)
            {
                customDays = employee.Orders
                    .Where(o => o.OrderDate.Date >= subscriptionStartDate.Value.ToDateTime(TimeOnly.MinValue) &&
                               o.OrderDate.Date <= subscriptionEndDate.Value.ToDateTime(TimeOnly.MinValue))
                    .Select(o => o.OrderDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture))
                    .Distinct()
                    .OrderBy(d => d)
                    .ToList();
            }

            if (subscriptionEndDate.HasValue)
            {
                // Create blocked reason with expiry date
                switchBlockedReason = $"У сотрудника активная подписка на обеды до {subscriptionEndDate:dd.MM.yyyy}. " +
                                      $"Осталось {remainingDays} {GetDaysWord(remainingDays ?? 0)}. " +
                                      $"Переключение на компенсацию будет возможно после {subscriptionEndDate:dd.MM.yyyy}.";
            }
            else
            {
                switchBlockedReason = "У сотрудника активная подписка на обеды. Переключение на компенсацию невозможно.";
            }
        }

        return new EmployeeResponse
        {
            Id = employee.Id,
            FullName = employee.FullName,
            Phone = employee.Phone,
            Email = employee.Email,
            Position = employee.Position,
            TotalBudget = employee.Budget?.TotalBudget ?? 0,
            DailyLimit = employee.Budget?.DailyLimit ?? 0,
            MealStatus = todayOrder != null ? "Заказан" : "Не заказан",
            MealPlan = todayOrder?.ComboType ?? latestOrder?.ComboType,
            InviteStatus = employee.InviteStatus.ToRussian(),
            IsActive = employee.IsActive,
            // Project info (address comes from project)
            ProjectId = employee.ProjectId,
            ProjectName = employee.Project?.Name ?? "",
            AddressName = employee.Project?.AddressName ?? "",
            AddressFullAddress = employee.Project?.AddressFullAddress ?? "",

            // ═══════════════════════════════════════════════════════════════
            // Service Type (attached to employee, not project)
            // Uses Rich Domain Model property for business rule
            // ═══════════════════════════════════════════════════════════════
            ServiceType = employee.ServiceType?.ToDatabase() ?? (employee.Project?.ServiceTypes.FirstOrDefault() ?? "LUNCH"),
            CanSwitchToCompensation = employee.CanSwitchToCompensation,
            CanSwitchToLunch = !hasActiveCompensation,
            SwitchToCompensationBlockedReason = !employee.CanSwitchToCompensation ? switchBlockedReason : null,
            SwitchToLunchBlockedReason = hasActiveCompensation ? "У сотрудника активная компенсация" : null,

            // ═══════════════════════════════════════════════════════════════
            // Work Schedule
            // ═══════════════════════════════════════════════════════════════
            ShiftType = employee.ShiftType?.ToDatabase(),
            WorkingDays = employee.WorkingDays,
            WorkStartTime = employee.WorkStartTime?.ToString("HH:mm"),
            WorkEndTime = employee.WorkEndTime?.ToString("HH:mm"),

            // ═══════════════════════════════════════════════════════════════
            // Active Subscriptions
            // ═══════════════════════════════════════════════════════════════
            ActiveLunchSubscriptionId = hasActiveLunchSubscription ? employee.LunchSubscription!.Id : null,
            ActiveCompensationId = null, // TODO: Add when compensation tracking is implemented
            LunchSubscription = hasActiveLunchSubscription ? new LunchSubscriptionInfo
            {
                Id = employee.LunchSubscription!.Id,
                ComboType = employee.LunchSubscription.ComboType,
                Status = subscriptionStatus,
                StartDate = subscriptionStartDate?.ToString("yyyy-MM-dd"),
                EndDate = subscriptionEndDate?.ToString("yyyy-MM-dd"),
                TotalPrice = totalPrice,
                RemainingDays = remainingDays,
                TotalDays = totalDays,
                ScheduleType = subscriptionScheduleType,
                CustomDays = customDays,
                FutureOrdersCount = futureOrdersCount,
                CompletedOrdersCount = completedOrdersCount
            } : null,
            Compensation = null, // TODO: Add when compensation entity is available

            CreatedAt = employee.CreatedAt,
            Budget = employee.Budget != null ? new BudgetResponse
            {
                TotalBudget = employee.Budget.TotalBudget,
                DailyLimit = employee.Budget.DailyLimit,
                Period = employee.Budget.Period.ToRussian(),
                AutoRenew = employee.Budget.AutoRenew
            } : null,
            Order = todayOrder != null ? new OrderInfo
            {
                Status = todayOrder.Status.ToRussian(),
                Type = todayOrder.ComboType
            } : latestOrder != null ? new OrderInfo
            {
                Status = latestOrder.Status.ToRussian(),
                Type = latestOrder.ComboType
            } : null,
            HasSubscription = hasActiveLunchSubscription
        };
    }

    private static string GetDaysWord(int days)
    {
        var lastDigit = days % 10;
        var lastTwoDigits = days % 100;

        if (lastTwoDigits >= 11 && lastTwoDigits <= 19)
            return "дней";
        if (lastDigit == 1)
            return "день";
        if (lastDigit >= 2 && lastDigit <= 4)
            return "дня";
        return "дней";
    }
}
