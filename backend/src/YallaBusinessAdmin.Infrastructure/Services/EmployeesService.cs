using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Audit;
using YallaBusinessAdmin.Application.Common.Models;
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

    public EmployeesService(AppDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
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

        var items = employees.Select(e => MapToResponse(e, null));
        return PagedResult<EmployeeResponse>.Create(items, total, page, pageSize);
    }

    public async Task<EmployeeResponse> GetByIdAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default)
    {
        var employee = await _context.Employees
            .Include(e => e.Budget)
            .Include(e => e.Project)
            .Include(e => e.Orders.Where(o => o.OrderDate >= DateTime.UtcNow.Date.AddDays(-7)))
            .Include(e => e.LunchSubscription)
            .FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, cancellationToken);

        if (employee == null)
        {
            throw new KeyNotFoundException("Сотрудник не найден");
        }

        // Get active company subscription for the project (to show subscription dates)
        var activeProjectSubscription = await _context.CompanySubscriptions
            .Where(s => s.ProjectId == employee.ProjectId && 
                       s.Status == Domain.Enums.SubscriptionStatus.Active)
            .OrderByDescending(s => s.EndDate)
            .FirstOrDefaultAsync(cancellationToken);

        return MapToResponse(employee, activeProjectSubscription);
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

        // Validate phone format
        if (!IsValidPhoneFormat(request.Phone))
        {
            throw new InvalidOperationException("Неверный формат телефона. Телефон должен начинаться с + и содержать только цифры");
        }

        // Validate project exists and belongs to the company
        var project = await _context.Projects
            .FirstOrDefaultAsync(p => p.Id == request.ProjectId && p.CompanyId == companyId, cancellationToken);

        if (project == null)
        {
            throw new InvalidOperationException("Указанный проект не найден или не принадлежит вашей компании");
        }

        // Check for duplicate phone across all employees (including deleted)
        var existingEmployee = await _context.Employees
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.Phone == request.Phone, cancellationToken);

        if (existingEmployee != null)
        {
            if (existingEmployee.DeletedAt != null)
            {
                throw new InvalidOperationException("Сотрудник с таким телефоном был удален. Обратитесь к администратору для восстановления.");
            }
            throw new InvalidOperationException("Сотрудник с таким телефоном уже существует");
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
            WorkStartTime = !string.IsNullOrWhiteSpace(request.WorkStartTime) 
                ? TimeOnly.Parse(request.WorkStartTime) 
                : null,
            WorkEndTime = !string.IsNullOrWhiteSpace(request.WorkEndTime) 
                ? TimeOnly.Parse(request.WorkEndTime) 
                : null,
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
            .Include(e => e.Budget)
            .Include(e => e.Project)
            .Include(e => e.Orders.Where(o => o.OrderDate >= DateTime.UtcNow.Date))
            .Include(e => e.LunchSubscription) // Need this for service type validation
            .FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, cancellationToken);

        if (employee == null)
        {
            throw new KeyNotFoundException("Сотрудник не найден");
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
        // Service Type Update with Business Rules
        // ═══════════════════════════════════════════════════════════════
        if (!string.IsNullOrWhiteSpace(request.ServiceType))
        {
            var newServiceType = ServiceTypeExtensions.FromDatabase(request.ServiceType);
            
            // Check business rule: cannot switch to COMPENSATION if active lunch subscription exists
            if (newServiceType == ServiceType.Compensation && employee.LunchSubscription?.IsActive == true)
            {
                throw new InvalidOperationException(
                    "Невозможно переключиться на Компенсацию: у сотрудника активная подписка на обеды. " +
                    "Сначала отмените или дождитесь окончания подписки.");
            }
            
            employee.ServiceType = newServiceType;
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
        employee.IsActive = !employee.IsActive;
        employee.UpdatedAt = DateTime.UtcNow;

        // If deactivating, pause all active orders
        if (wasActive && !employee.IsActive)
        {
            var activeOrders = employee.Orders
                .Where(o => o.Status == OrderStatus.Active && o.OrderDate >= DateTime.UtcNow.Date)
                .ToList();

            foreach (var order in activeOrders)
            {
                order.Status = OrderStatus.Paused;
                order.UpdatedAt = DateTime.UtcNow;
            }
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
            .Include(e => e.Orders)
            .Include(e => e.LunchSubscription)
            .FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, cancellationToken);

        if (employee == null)
        {
            throw new KeyNotFoundException("Сотрудник не найден");
        }

        // Soft delete
        employee.DeletedAt = DateTime.UtcNow;
        employee.UpdatedAt = DateTime.UtcNow;
        employee.IsActive = false;

        // Cancel all active orders
        var activeOrders = employee.Orders
            .Where(o => o.Status == OrderStatus.Active && o.OrderDate >= DateTime.UtcNow.Date)
            .ToList();

        foreach (var order in activeOrders)
        {
            order.Status = OrderStatus.Completed;
            order.UpdatedAt = DateTime.UtcNow;
        }

        // Deactivate subscription if exists
        if (employee.LunchSubscription != null)
        {
            employee.LunchSubscription.IsActive = false;
            employee.LunchSubscription.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        // Audit log
        await _auditService.LogAsync(
            currentUserId,
            AuditActions.Delete,
            AuditEntityTypes.Employee,
            employee.Id,
            oldValues: new { employee.FullName, employee.Phone, employee.Email },
            cancellationToken: cancellationToken);
    }

    public async Task UpdateBudgetAsync(Guid id, UpdateBudgetRequest request, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default)
    {
        var employee = await _context.Employees
            .Include(e => e.Budget)
            .FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, cancellationToken);

        if (employee == null)
        {
            throw new KeyNotFoundException("Сотрудник не найден");
        }

        var oldValues = employee.Budget != null 
            ? new { employee.Budget.TotalBudget, employee.Budget.DailyLimit, Period = employee.Budget.Period.ToRussian(), employee.Budget.AutoRenew }
            : null;

        if (employee.Budget == null)
        {
            employee.Budget = new EmployeeBudget
            {
                Id = Guid.NewGuid(),
                EmployeeId = employee.Id,
                CreatedAt = DateTime.UtcNow
            };
            await _context.EmployeeBudgets.AddAsync(employee.Budget, cancellationToken);
        }

        employee.Budget.TotalBudget = request.TotalBudget;
        employee.Budget.DailyLimit = request.DailyLimit;
        employee.Budget.Period = BudgetPeriodExtensions.FromRussian(request.Period);
        employee.Budget.AutoRenew = request.AutoRenew;
        employee.Budget.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        // Audit log
        await _auditService.LogAsync(
            currentUserId,
            AuditActions.Update,
            AuditEntityTypes.Budget,
            employee.Id,
            oldValues: oldValues,
            newValues: new { request.TotalBudget, request.DailyLimit, request.Period, request.AutoRenew },
            cancellationToken: cancellationToken);
    }

    public async Task BatchUpdateBudgetAsync(BatchUpdateBudgetRequest request, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default)
    {
        var employeeIds = request.EmployeeIds.ToList();
        var employees = await _context.Employees
            .Include(e => e.Budget)
            .Where(e => employeeIds.Contains(e.Id) && e.CompanyId == companyId)
            .ToListAsync(cancellationToken);

        if (employees.Count != employeeIds.Count)
        {
            throw new InvalidOperationException("Некоторые сотрудники не найдены");
        }

        var period = BudgetPeriodExtensions.FromRussian(request.Period);

        foreach (var employee in employees)
        {
            if (employee.Budget == null)
            {
                employee.Budget = new EmployeeBudget
                {
                    Id = Guid.NewGuid(),
                    EmployeeId = employee.Id,
                    CreatedAt = DateTime.UtcNow
                };
                await _context.EmployeeBudgets.AddAsync(employee.Budget, cancellationToken);
            }

            employee.Budget.TotalBudget = request.TotalBudget;
            employee.Budget.DailyLimit = request.DailyLimit;
            employee.Budget.Period = period;
            employee.Budget.AutoRenew = request.AutoRenew;
            employee.Budget.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        // Audit log for batch operation
        await _auditService.LogAsync(
            currentUserId,
            AuditActions.Update,
            AuditEntityTypes.Budget,
            newValues: new { 
                EmployeeCount = employees.Count, 
                EmployeeIds = employeeIds,
                request.TotalBudget, 
                request.DailyLimit, 
                request.Period, 
                request.AutoRenew 
            },
            cancellationToken: cancellationToken);
    }

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
        var employee = await _context.Employees
            .FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, cancellationToken);

        if (employee == null)
        {
            throw new KeyNotFoundException("Сотрудник не найден");
        }

        var results = new List<EmployeeOrderResponse>();
        
        // ═══════════════════════════════════════════════════════════════
        // BUSINESS RULE: Load orders ONLY for employee's ServiceType
        // Employee can have EITHER lunch OR compensation, NOT both
        // ═══════════════════════════════════════════════════════════════
        var employeeServiceType = employee.ServiceType;

        // ═══════════════════════════════════════════════════════════════
        // 1. Load LUNCH orders (only if ServiceType is LUNCH or not set)
        // ═══════════════════════════════════════════════════════════════
        if (employeeServiceType == null || employeeServiceType == ServiceType.Lunch)
        {
            var ordersQuery = _context.Orders
                .Include(o => o.Project)
                .Where(o => o.EmployeeId == id);

            // Apply date range filter for lunch orders
            if (!string.IsNullOrWhiteSpace(dateFrom) && DateTime.TryParse(dateFrom, out var fromDate))
            {
                ordersQuery = ordersQuery.Where(o => o.OrderDate >= fromDate.Date);
            }
            if (!string.IsNullOrWhiteSpace(dateTo) && DateTime.TryParse(dateTo, out var toDate))
            {
                ordersQuery = ordersQuery.Where(o => o.OrderDate <= toDate.Date);
            }

            // Apply status filter for lunch orders
            if (!string.IsNullOrWhiteSpace(status))
            {
                var orderStatus = OrderStatusExtensions.FromRussian(status);
                ordersQuery = ordersQuery.Where(o => o.Status == orderStatus);
            }

            var lunchOrders = await ordersQuery.ToListAsync(cancellationToken);

            results.AddRange(lunchOrders.Select(o => new EmployeeOrderResponse
            {
                Id = o.Id,
                Date = o.OrderDate.ToString("yyyy-MM-dd"),
                Type = o.IsGuestOrder ? "Гость" : "Сотрудник",
                Status = o.Status.ToRussian(),
                Amount = o.Price,
                Address = o.Project?.AddressName ?? "",
                ServiceType = "LUNCH",
                ComboType = o.ComboType
            }));
        }

        // ═══════════════════════════════════════════════════════════════
        // 2. Load COMPENSATION transactions (only if ServiceType is COMPENSATION)
        // ═══════════════════════════════════════════════════════════════
        if (employeeServiceType == ServiceType.Compensation)
        {
            var compQuery = _context.CompensationTransactions
                .Include(ct => ct.Project)
                .Where(ct => ct.EmployeeId == id);

            // Apply date range filter for compensations
            if (!string.IsNullOrWhiteSpace(dateFrom) && DateOnly.TryParse(dateFrom, out var compFromDate))
            {
                compQuery = compQuery.Where(ct => ct.TransactionDate >= compFromDate);
            }
            if (!string.IsNullOrWhiteSpace(dateTo) && DateOnly.TryParse(dateTo, out var compToDate))
            {
                compQuery = compQuery.Where(ct => ct.TransactionDate <= compToDate);
            }

            var compTransactions = await compQuery.ToListAsync(cancellationToken);

            results.AddRange(compTransactions.Select(ct => new EmployeeOrderResponse
            {
                Id = ct.Id,
                Date = ct.TransactionDate.ToString("yyyy-MM-dd"),
                Type = "Сотрудник",
                Status = "Завершен",
                Amount = ct.TotalAmount,
                Address = ct.RestaurantName ?? "",
                ServiceType = "COMPENSATION",
                ComboType = "",
                CompensationLimit = ct.Project?.CompensationDailyLimit ?? 0,
                CompensationSpent = ct.TotalAmount,
                RestaurantName = ct.RestaurantName
            }));
        }

        // ═══════════════════════════════════════════════════════════════
        // NOTE: Demo data removed - was causing business logic violation
        // by showing both LUNCH and COMPENSATION for same employee
        // ═══════════════════════════════════════════════════════════════

        // ═══════════════════════════════════════════════════════════════
        // 3. Sort and paginate combined results
        // ═══════════════════════════════════════════════════════════════
        var sortedResults = results
            .OrderByDescending(r => r.Date)
            .ToList();

        var total = sortedResults.Count;
        var pagedItems = sortedResults
            .Skip((page - 1) * pageSize)
            .Take(pageSize);

        return PagedResult<EmployeeOrderResponse>.Create(pagedItems, total, page, pageSize);
    }

    /// <summary>
    /// Validates phone format: must start with + and contain 10-15 digits
    /// </summary>
    private static bool IsValidPhoneFormat(string phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return false;
        if (!phone.StartsWith('+')) return false;
        
        var digitsOnly = phone.Substring(1);
        if (digitsOnly.Length < 10 || digitsOnly.Length > 15) return false;
        
        return digitsOnly.All(char.IsDigit);
    }

    private static EmployeeResponse MapToResponse(Employee employee, CompanySubscription? activeProjectSubscription = null)
    {
        var todayOrder = employee.Orders
            .FirstOrDefault(o => o.OrderDate.Date == DateTime.UtcNow.Date);

        var latestOrder = employee.Orders
            .OrderByDescending(o => o.OrderDate)
            .FirstOrDefault();

        var hasActiveLunchSubscription = employee.LunchSubscription?.IsActive ?? false;
        
        // TODO: Add real compensation tracking when available
        var hasActiveCompensation = false; // placeholder
        
        // Calculate subscription dates and remaining days
        // Priority: 1) LunchSubscription own dates, 2) CompanySubscription dates
        DateOnly? subscriptionStartDate = null;
        DateOnly? subscriptionEndDate = null;
        int? remainingDays = null;
        string? switchBlockedReason = null;
        string subscriptionStatus = "Активна";
        decimal? totalPrice = null;
        
        if (hasActiveLunchSubscription && employee.LunchSubscription != null)
        {
            var sub = employee.LunchSubscription;
            
            // First try to get dates from LunchSubscription itself
            if (sub.StartDate.HasValue && sub.EndDate.HasValue)
            {
                subscriptionStartDate = sub.StartDate;
                subscriptionEndDate = sub.EndDate;
                totalPrice = sub.TotalPrice;
                subscriptionStatus = sub.Status ?? "Активна";
            }
            // Fall back to CompanySubscription if LunchSubscription doesn't have dates
            else if (activeProjectSubscription != null)
            {
                subscriptionStartDate = activeProjectSubscription.StartDate;
                subscriptionEndDate = activeProjectSubscription.EndDate;
                totalPrice = activeProjectSubscription.TotalAmount;
                subscriptionStatus = activeProjectSubscription.Status.ToRussian();
            }
            
            // Calculate remaining days
            if (subscriptionEndDate.HasValue)
            {
                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                remainingDays = Math.Max(0, subscriptionEndDate.Value.DayNumber - today.DayNumber);
                
                // Create blocked reason with expiry date
                switchBlockedReason = $"У сотрудника активная подписка на обеды до {subscriptionEndDate:dd.MM.yyyy}. " +
                                      $"Осталось {remainingDays} {GetDaysWord(remainingDays.Value)}. " +
                                      $"Переключение на компенсацию будет возможно после {subscriptionEndDate:dd.MM.yyyy}.";
            }
            else
            {
                // LunchSubscription exists but no dates (legacy data)
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
            // ═══════════════════════════════════════════════════════════════
            ServiceType = employee.ServiceType?.ToDatabase() ?? (employee.Project?.ServiceTypes.FirstOrDefault() ?? "LUNCH"),
            CanSwitchToCompensation = !hasActiveLunchSubscription,
            CanSwitchToLunch = !hasActiveCompensation,
            SwitchToCompensationBlockedReason = hasActiveLunchSubscription ? switchBlockedReason : null,
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
                RemainingDays = remainingDays
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
