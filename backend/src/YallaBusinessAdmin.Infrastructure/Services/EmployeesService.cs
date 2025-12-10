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
using YallaBusinessAdmin.Domain.Helpers;
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
        // Load orders for the current subscription period to correctly count future/completed
        // Using today-30 days to cover most subscription periods while limiting data
        // NOTE: Using UTC for historical data loading is acceptable - order filtering uses exact date matching
        var ordersStartDate = DateTime.UtcNow.Date.AddDays(-30);
        var query = _context.Employees
            .AsNoTracking()
            .Include(e => e.Budget)
            .Include(e => e.Project)
            .Include(e => e.Orders.Where(o => o.OrderDate >= ordersStartDate))
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
        // NOTE: Using UTC here for simplicity in EF Core queries - acceptable for meal status filtering
        // For precise timezone handling, this would need a more complex subquery or post-filtering
        if (!string.IsNullOrWhiteSpace(orderStatusFilter))
        {
            var todayUtc = DateTime.UtcNow.Date;
            query = orderStatusFilter.ToLower() switch
            {
                "ordered" or "заказан" => query.Where(e => e.Orders.Any(o => o.OrderDate.Date == todayUtc)),
                "not_ordered" or "не заказан" => query.Where(e => !e.Orders.Any(o => o.OrderDate.Date == todayUtc)),
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
            .IgnoreQueryFilters() // FIX: Ignore global query filters to load LunchSubscription for paused subscriptions
            .Include(e => e.Budget)
            .Include(e => e.Project)
            // Load ALL orders for the employee to correctly count future/completed for subscription stats
            .Include(e => e.Orders)
            .Include(e => e.LunchSubscription)
            .FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId && e.DeletedAt == null, cancellationToken);

        if (employee == null)
        {
            throw new KeyNotFoundException("Сотрудник не найден");
        }

        // FIX: Always load LunchSubscription separately with IgnoreQueryFilters to handle paused subscriptions
        // This avoids issues with Company query filter affecting Include through the required relationship
        var lunchSubscription = await _context.LunchSubscriptions
            .AsNoTracking()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.EmployeeId == employee.Id && s.Status != SubscriptionStatus.Completed, cancellationToken);

        if (lunchSubscription != null)
        {
            employee.LunchSubscription = lunchSubscription;
        }

        return MapToResponse(employee);
    }

    public async Task<EmployeeResponse> CreateAsync(CreateEmployeeRequest request, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default)
    {
        var errors = new List<FieldError>();

        // ═══════════════════════════════════════════════════════════════
        // Step 1: Validate required fields and formats (sync validation)
        // ═══════════════════════════════════════════════════════════════

        if (string.IsNullOrWhiteSpace(request.FullName))
        {
            errors.Add(new FieldError("fullName", ErrorCodes.EMP_REQUIRED_FIELD_MISSING, "ФИО обязательно для заполнения"));
        }

        if (string.IsNullOrWhiteSpace(request.Phone))
        {
            errors.Add(new FieldError("phone", ErrorCodes.EMP_REQUIRED_FIELD_MISSING, "Телефон обязателен для заполнения"));
        }
        else if (!Employee.IsValidPhoneFormat(request.Phone))
        {
            errors.Add(new FieldError("phone", ErrorCodes.EMP_INVALID_PHONE_FORMAT, ErrorMessages.GetMessage(ErrorCodes.EMP_INVALID_PHONE_FORMAT)));
        }

        // Validate email format
        var emailValidation = EmployeeValidator.ValidateEmail(request.Email);
        if (!emailValidation.IsValid)
        {
            errors.Add(new FieldError("email", ErrorCodes.EMP_INVALID_EMAIL_FORMAT, emailValidation.ErrorMessage ?? "Неверный формат email"));
        }

        // Validate working days
        var workingDaysValidation = EmployeeValidator.ValidateWorkingDays(request.WorkingDays);
        if (!workingDaysValidation.IsValid)
        {
            errors.Add(new FieldError("workingDays", ErrorCodes.VALIDATION_ERROR, workingDaysValidation.ErrorMessage ?? "Ошибка валидации рабочих дней"));
        }

        // Validate work time
        var startTimeValidation = EmployeeValidator.ValidateAndParseTime(request.WorkStartTime, "Время начала работы");
        if (!startTimeValidation.IsValid)
        {
            errors.Add(new FieldError("workStartTime", ErrorCodes.VALIDATION_ERROR, startTimeValidation.ErrorMessage ?? "Неверный формат времени"));
        }

        var endTimeValidation = EmployeeValidator.ValidateAndParseTime(request.WorkEndTime, "Время окончания работы");
        if (!endTimeValidation.IsValid)
        {
            errors.Add(new FieldError("workEndTime", ErrorCodes.VALIDATION_ERROR, endTimeValidation.ErrorMessage ?? "Неверный формат времени"));
        }

        // Only validate time range if both times are valid
        if (startTimeValidation.IsValid && endTimeValidation.IsValid)
        {
            var timeRangeValidation = EmployeeValidator.ValidateWorkTimeRange(startTimeValidation.Time, endTimeValidation.Time);
            if (!timeRangeValidation.IsValid)
            {
                errors.Add(new FieldError("workEndTime", ErrorCodes.VALIDATION_ERROR, timeRangeValidation.ErrorMessage ?? "Неверный диапазон времени"));
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // Step 2: Async validation (database checks)
        // ═══════════════════════════════════════════════════════════════

        // Validate project exists and belongs to the company
        var project = await _context.Projects
            .FirstOrDefaultAsync(p => p.Id == request.ProjectId && p.CompanyId == companyId, cancellationToken);

        if (project == null)
        {
            errors.Add(new FieldError("projectId", ErrorCodes.PROJ_NOT_FOUND, "Указанный проект не найден или не принадлежит вашей компании"));
        }

        // Check for duplicate phone across all employees (only if phone format is valid)
        if (!string.IsNullOrWhiteSpace(request.Phone) && Employee.IsValidPhoneFormat(request.Phone))
        {
            var existingByPhone = await _context.Employees
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(e => e.Phone == request.Phone, cancellationToken);

            if (existingByPhone != null)
            {
                var code = existingByPhone.DeletedAt != null ? ErrorCodes.EMP_PHONE_DELETED : ErrorCodes.EMP_PHONE_EXISTS;
                errors.Add(new FieldError("phone", code, ErrorMessages.GetMessage(code)));
            }
        }

        // Check for duplicate email across all employees (only if email format is valid)
        if (!string.IsNullOrWhiteSpace(request.Email) && emailValidation.IsValid)
        {
            var existingEmployeeByEmail = await _context.Employees
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(e => e.Email == request.Email, cancellationToken);

            if (existingEmployeeByEmail != null)
            {
                var code = existingEmployeeByEmail.DeletedAt != null ? ErrorCodes.EMP_EMAIL_DELETED : ErrorCodes.EMP_EMAIL_EXISTS;
                errors.Add(new FieldError("email", code, ErrorMessages.GetMessage(code)));
            }
            else
            {
                // Also check if email exists among admin users
                var existingAdminByEmail = await _context.AdminUsers
                    .IgnoreQueryFilters()
                    .AnyAsync(a => a.Email == request.Email, cancellationToken);

                if (existingAdminByEmail)
                {
                    errors.Add(new FieldError("email", ErrorCodes.EMP_EMAIL_EXISTS, "Эта почта уже используется в системе"));
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // Step 3: Throw all errors at once if any
        // ═══════════════════════════════════════════════════════════════
        MultiValidationException.ThrowIfHasErrors(errors);

        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            ProjectId = request.ProjectId,
            FullName = request.FullName,
            Phone = request.Phone,
            Email = request.Email,
            Position = request.Position,
            Status = EmployeeStatus.Active,
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
        // NOTE: Using UTC for orders loading - acceptable for response mapping
        var ordersFromDate = DateTime.UtcNow.Date;
        var employee = await _context.Employees
            .IgnoreQueryFilters() // Include soft-deleted to check and report
            .Include(e => e.Budget)
            .Include(e => e.Project)
            .Include(e => e.Orders.Where(o => o.OrderDate >= ordersFromDate))
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
            oldValues: new { Status = wasActive ? "Активный" : "Деактивирован" },
            newValues: new { Status = employee.Status.ToRussian() },
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

        // ═══════════════════════════════════════════════════════════════
        // TRANSACTION: Delete employee with all cascading operations atomically
        // - Set DeletedAt, Status
        // - Cancel/complete active orders
        // - Deactivate subscription
        // - Create audit log
        // ═══════════════════════════════════════════════════════════════
        var strategy = _context.Database.CreateExecutionStrategy();

        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

            try
            {
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

                await transaction.CommitAsync(cancellationToken);
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        });
    }

    /// <summary>
    /// Permanently deletes an employee and all related data from the database.
    /// WARNING: This action is irreversible!
    /// Use this only for test/fake data cleanup.
    /// </summary>
    public async Task HardDeleteAsync(Guid id, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default)
    {
        var employee = await _context.Employees
            .IgnoreQueryFilters()
            .Include(e => e.Budget)
            .Include(e => e.Orders)
            .Include(e => e.LunchSubscription)
            .FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, cancellationToken);

        if (employee == null)
        {
            throw new KeyNotFoundException("Сотрудник не найден");
        }

        var employeeInfo = new { employee.FullName, employee.Phone, employee.Email };

        // ═══════════════════════════════════════════════════════════════
        // TRANSACTION: Hard delete employee with all related data atomically
        // - Delete all orders
        // - Delete lunch subscription
        // - Delete employee budget
        // - Delete employee
        // - Create audit log
        // ═══════════════════════════════════════════════════════════════
        var strategy = _context.Database.CreateExecutionStrategy();

        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

            try
            {
                // Delete all orders first (FK constraint)
                if (employee.Orders.Any())
                {
                    _context.Orders.RemoveRange(employee.Orders);
                }

                // Delete lunch subscription if exists
                if (employee.LunchSubscription != null)
                {
                    _context.LunchSubscriptions.Remove(employee.LunchSubscription);
                }

                // Delete employee budget if exists
                if (employee.Budget != null)
                {
                    _context.EmployeeBudgets.Remove(employee.Budget);
                }

                // Finally delete employee
                _context.Employees.Remove(employee);

                await _context.SaveChangesAsync(cancellationToken);

                // Audit log
                await _auditService.LogAsync(
                    currentUserId,
                    "HARD_DELETE",
                    AuditEntityTypes.Employee,
                    employee.Id,
                    oldValues: employeeInfo,
                    cancellationToken: cancellationToken);

                await transaction.CommitAsync(cancellationToken);
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        });
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
        // NOTE: Using UTC for in-memory order filtering - acceptable for response mapping
        // Orders are already loaded with UTC dates; precise timezone handling would require
        // passing Project.Timezone through the call chain
        var todayUtc = DateTime.UtcNow.Date;
        var todayOrder = employee.Orders
            .FirstOrDefault(o => o.OrderDate.Date == todayUtc);

        var latestOrder = employee.Orders
            .OrderByDescending(o => o.OrderDate)
            .FirstOrDefault();

        // Use Rich Domain Model properties
        var hasActiveLunchSubscription = employee.HasActiveLunchSubscription;
        // FIX: Check for existing subscription (active OR paused) - use direct check since LunchSubscription was loaded separately
        var hasExistingLunchSubscription = employee.LunchSubscription != null &&
            employee.LunchSubscription.Status != SubscriptionStatus.Completed;

        // TODO: Add real compensation tracking when available
        var hasActiveCompensation = false; // placeholder

        // Calculate subscription dates and remaining days from LunchSubscription
        DateOnly? subscriptionStartDate = null;
        DateOnly? subscriptionEndDate = null;
        int? remainingDays = null;
        string? switchBlockedReason = null;
        string subscriptionStatus = SubscriptionStatus.Active.ToRussian();
        decimal? totalPrice = null;

        // Order statistics for subscription
        int futureOrdersCount = 0;
        int completedOrdersCount = 0;
        int? totalDays = null;
        string subscriptionScheduleType = "EVERY_DAY";
        List<string>? customDays = null;

        // FIX: Show subscription info for both active AND paused subscriptions
        if (hasExistingLunchSubscription && employee.LunchSubscription != null)
        {
            var sub = employee.LunchSubscription;

            subscriptionStartDate = sub.StartDate;
            subscriptionEndDate = sub.EndDate;
            subscriptionStatus = sub.Status.ToRussian();

            // Count future orders (today and forward, Active or Paused status)
            // NOTE: Using UTC - acceptable for counts as orders are stored with UTC dates
            var futureOrders = employee.Orders
                .Where(o => o.OrderDate.Date >= todayUtc &&
                           (o.Status == Domain.Enums.OrderStatus.Active || o.Status == Domain.Enums.OrderStatus.Paused))
                .ToList();

            futureOrdersCount = futureOrders.Count;

            // Count completed orders
            completedOrdersCount = employee.Orders.Count(o =>
                o.Status == Domain.Enums.OrderStatus.Completed);

            // ═══════════════════════════════════════════════════════════════
            // DYNAMIC TOTAL DAYS: Count ALL orders in subscription period (not cancelled)
            // This is always accurate - reflects actual orders, not expected!
            // ═══════════════════════════════════════════════════════════════
            if (subscriptionStartDate.HasValue && subscriptionEndDate.HasValue)
            {
                var subStartDateTime = subscriptionStartDate.Value.ToDateTime(TimeOnly.MinValue);
                var subEndDateTime = subscriptionEndDate.Value.ToDateTime(TimeOnly.MaxValue);
                totalDays = employee.Orders.Count(o =>
                    o.Status != Domain.Enums.OrderStatus.Cancelled &&
                    o.OrderDate >= subStartDateTime &&
                    o.OrderDate <= subEndDateTime);
            }
            else
            {
                totalDays = futureOrdersCount + completedOrdersCount;
            }

            // Use futureOrdersCount as remaining days (more accurate than domain method)
            remainingDays = futureOrdersCount;

            // ═══════════════════════════════════════════════════════════════
            // DYNAMIC TOTAL PRICE: Calculate as sum of actual future order prices
            // This is always accurate - no need to update manually anywhere!
            // ═══════════════════════════════════════════════════════════════
            totalPrice = futureOrders.Sum(o => o.Price);

            // Get schedule type (normalize legacy WEEKDAYS → EVERY_DAY)
            subscriptionScheduleType = ScheduleTypeHelper.Normalize(sub.ScheduleType);

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
            Status = employee.Status.ToRussian(),
            IsActive = employee.IsActive,  // Computed property for backward compatibility
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
            // FIX: Use hasExistingLunchSubscription to include paused subscriptions in response
            // ═══════════════════════════════════════════════════════════════
            ActiveLunchSubscriptionId = hasExistingLunchSubscription ? employee.LunchSubscription!.Id : null,
            ActiveCompensationId = null, // TODO: Add when compensation tracking is implemented
            LunchSubscription = hasExistingLunchSubscription ? new LunchSubscriptionInfo
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
            HasSubscription = hasExistingLunchSubscription
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
