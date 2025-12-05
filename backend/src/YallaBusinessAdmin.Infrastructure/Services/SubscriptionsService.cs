using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Subscriptions;
using YallaBusinessAdmin.Application.Subscriptions.Dtos;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class SubscriptionsService : ISubscriptionsService
{
    private readonly AppDbContext _context;

    public SubscriptionsService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<SubscriptionResponse>> GetAllAsync(
        Guid companyId,
        int page,
        int pageSize,
        string? search,
        bool? isActive,
        CancellationToken cancellationToken = default)
    {
        // NOTE: Address is now derived from Employee's Project (one project = one address)
        var query = _context.LunchSubscriptions
            .Include(s => s.Employee)
                .ThenInclude(e => e!.Project)
            .Where(s => s.CompanyId == companyId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(s => 
                s.Employee!.FullName.ToLower().Contains(searchLower) ||
                s.Employee.Phone.Contains(searchLower));
        }

        if (isActive.HasValue)
        {
            query = query.Where(s => s.IsActive == isActive.Value);
        }

        var total = await query.CountAsync(cancellationToken);
        var subscriptions = await query
            .OrderByDescending(s => s.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = subscriptions.Select(MapToResponse);
        return PagedResult<SubscriptionResponse>.Create(items, total, page, pageSize);
    }

    public async Task<SubscriptionResponse> GetByIdAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscription = await _context.LunchSubscriptions
            .Include(s => s.Employee)
                .ThenInclude(e => e!.Project)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == companyId, cancellationToken);

        if (subscription == null)
        {
            throw new KeyNotFoundException("Подписка не найдена");
        }

        return MapToResponse(subscription);
    }

    public async Task<SubscriptionResponse> GetByEmployeeIdAsync(Guid employeeId, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscription = await _context.LunchSubscriptions
            .Include(s => s.Employee)
                .ThenInclude(e => e!.Project)
            .FirstOrDefaultAsync(s => s.EmployeeId == employeeId && s.CompanyId == companyId, cancellationToken);

        if (subscription == null)
        {
            throw new KeyNotFoundException("Подписка не найдена");
        }

        return MapToResponse(subscription);
    }

    public async Task<SubscriptionResponse> CreateAsync(CreateSubscriptionRequest request, Guid companyId, CancellationToken cancellationToken = default)
    {
        // Check if employee exists and belongs to company
        var employee = await _context.Employees
            .Include(e => e.Project)
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId && e.CompanyId == companyId, cancellationToken);

        if (employee == null)
        {
            throw new KeyNotFoundException("Сотрудник не найден");
        }

        // Check if subscription already exists
        var existingSubscription = await _context.LunchSubscriptions
            .FirstOrDefaultAsync(s => s.EmployeeId == request.EmployeeId, cancellationToken);

        if (existingSubscription != null)
        {
            throw new InvalidOperationException("Сотрудник уже имеет подписку на обеды");
        }

        // NOTE: Address is derived from employee's Project (one project = one address)
        var subscription = new LunchSubscription
        {
            Id = Guid.NewGuid(),
            EmployeeId = request.EmployeeId,
            CompanyId = companyId,
            ProjectId = employee.ProjectId,
            ComboType = request.ComboType,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _context.LunchSubscriptions.AddAsync(subscription, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        subscription.Employee = employee;

        return MapToResponse(subscription);
    }

    public async Task<SubscriptionResponse> UpdateAsync(Guid id, UpdateSubscriptionDetailsRequest request, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscription = await _context.LunchSubscriptions
            .Include(s => s.Employee)
                .ThenInclude(e => e!.Project)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == companyId, cancellationToken);

        if (subscription == null)
        {
            throw new KeyNotFoundException("Подписка не найдена");
        }

        if (!string.IsNullOrWhiteSpace(request.ComboType))
        {
            subscription.ComboType = request.ComboType;
        }

        // NOTE: Address cannot be changed here - it comes from employee's project
        // To change address, move employee to a different project

        if (request.IsActive.HasValue)
        {
            subscription.IsActive = request.IsActive.Value;
        }

        subscription.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return MapToResponse(subscription);
    }

    public async Task DeleteAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscription = await _context.LunchSubscriptions
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == companyId, cancellationToken);

        if (subscription == null)
        {
            throw new KeyNotFoundException("Подписка не найдена");
        }

        _context.LunchSubscriptions.Remove(subscription);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<object> BulkCreateAsync(BulkCreateSubscriptionRequest request, Guid companyId, CancellationToken cancellationToken = default)
    {
        var employees = await _context.Employees
            .Include(e => e.Project)
            .Where(e => request.EmployeeIds.Contains(e.Id) && e.CompanyId == companyId && e.IsActive)
            .ToListAsync(cancellationToken);

        var existingSubscriptions = await _context.LunchSubscriptions
            .Where(s => request.EmployeeIds.Contains(s.EmployeeId))
            .Select(s => s.EmployeeId)
            .ToListAsync(cancellationToken);

        var created = 0;
        var skipped = new List<string>();

        foreach (var employee in employees)
        {
            if (existingSubscriptions.Contains(employee.Id))
            {
                skipped.Add($"{employee.FullName} (уже имеет подписку)");
                continue;
            }

            // NOTE: Address is derived from employee's Project
            var subscription = new LunchSubscription
            {
                Id = Guid.NewGuid(),
                EmployeeId = employee.Id,
                CompanyId = companyId,
                ProjectId = employee.ProjectId,
                ComboType = request.ComboType,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _context.LunchSubscriptions.AddAsync(subscription, cancellationToken);
            created++;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new
        {
            message = $"Создано {created} подписок",
            created,
            skipped
        };
    }

    public async Task<object> BulkUpdateAsync(BulkUpdateSubscriptionRequest request, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscriptions = await _context.LunchSubscriptions
            .Where(s => request.SubscriptionIds.Contains(s.Id) && s.CompanyId == companyId)
            .ToListAsync(cancellationToken);

        var updated = 0;

        foreach (var subscription in subscriptions)
        {
            if (!string.IsNullOrWhiteSpace(request.ComboType))
            {
                subscription.ComboType = request.ComboType;
            }

            // NOTE: Address cannot be changed - it comes from employee's project

            subscription.UpdatedAt = DateTime.UtcNow;
            updated++;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new
        {
            message = $"Обновлено {updated} подписок",
            updated
        };
    }

    public async Task<SubscriptionResponse> PauseAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscription = await _context.LunchSubscriptions
            .Include(s => s.Employee)
                .ThenInclude(e => e!.Project)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == companyId, cancellationToken);

        if (subscription == null)
        {
            throw new KeyNotFoundException("Подписка не найдена");
        }

        if (!subscription.IsActive)
        {
            throw new InvalidOperationException("Подписка уже приостановлена");
        }

        subscription.IsActive = false;
        subscription.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return MapToResponse(subscription);
    }

    public async Task<SubscriptionResponse> ResumeAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscription = await _context.LunchSubscriptions
            .Include(s => s.Employee)
                .ThenInclude(e => e!.Project)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == companyId, cancellationToken);

        if (subscription == null)
        {
            throw new KeyNotFoundException("Подписка не найдена");
        }

        if (subscription.IsActive)
        {
            throw new InvalidOperationException("Подписка уже активна");
        }

        subscription.IsActive = true;
        subscription.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return MapToResponse(subscription);
    }

    public async Task<object> BulkPauseAsync(IEnumerable<Guid> subscriptionIds, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscriptions = await _context.LunchSubscriptions
            .Where(s => subscriptionIds.Contains(s.Id) && s.CompanyId == companyId && s.IsActive)
            .ToListAsync(cancellationToken);

        var paused = 0;

        foreach (var subscription in subscriptions)
        {
            subscription.IsActive = false;
            subscription.UpdatedAt = DateTime.UtcNow;
            paused++;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new
        {
            message = $"Приостановлено {paused} подписок",
            paused
        };
    }

    public async Task<object> BulkResumeAsync(IEnumerable<Guid> subscriptionIds, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscriptions = await _context.LunchSubscriptions
            .Where(s => subscriptionIds.Contains(s.Id) && s.CompanyId == companyId && !s.IsActive)
            .ToListAsync(cancellationToken);

        var resumed = 0;

        foreach (var subscription in subscriptions)
        {
            subscription.IsActive = true;
            subscription.UpdatedAt = DateTime.UtcNow;
            resumed++;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new
        {
            message = $"Возобновлено {resumed} подписок",
            resumed
        };
    }

    public async Task<PricePreviewResponse> GetPricePreviewAsync(Guid id, string newComboType, Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscription = await _context.LunchSubscriptions
            .Include(s => s.Employee)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == companyId, cancellationToken);

        if (subscription == null)
        {
            throw new KeyNotFoundException("Подписка не найдена");
        }

        // Combo prices - only Комбо 25 and Комбо 35 are supported
        var comboPrices = new Dictionary<string, decimal>
        {
            { "Комбо 25", 25.00m },
            { "Комбо 35", 35.00m }
        };

        var currentPrice = comboPrices.GetValueOrDefault(subscription.ComboType, 35.00m);
        var newPrice = comboPrices.GetValueOrDefault(newComboType, 35.00m);
        var priceDifference = newPrice - currentPrice;

        // Count affected active orders
        var affectedOrdersCount = await _context.Orders
            .CountAsync(o => o.EmployeeId == subscription.EmployeeId 
                          && o.Status == Domain.Enums.OrderStatus.Active
                          && o.OrderDate >= DateTime.Today, cancellationToken);

        var totalImpact = priceDifference * affectedOrdersCount;

        var priceChangeDescription = priceDifference switch
        {
            > 0 => $"Увеличение на {priceDifference:N0} TJS за заказ",
            < 0 => $"Экономия {Math.Abs(priceDifference):N0} TJS за заказ",
            _ => "Цена не изменится"
        };

        return new PricePreviewResponse
        {
            CurrentComboType = subscription.ComboType,
            CurrentPrice = currentPrice,
            NewComboType = newComboType,
            NewPrice = newPrice,
            PriceDifference = priceDifference,
            PriceChangeDescription = priceChangeDescription,
            AffectedOrdersCount = affectedOrdersCount,
            TotalImpact = totalImpact
        };
    }

    private static SubscriptionResponse MapToResponse(LunchSubscription subscription)
    {
        // Address comes from Employee's Project (one project = one address)
        return new SubscriptionResponse
        {
            Id = subscription.Id,
            EmployeeId = subscription.EmployeeId,
            EmployeeName = subscription.Employee?.FullName ?? "",
            EmployeePhone = subscription.Employee?.Phone ?? "",
            ComboType = subscription.ComboType,
            DeliveryAddressId = subscription.Employee?.ProjectId,
            DeliveryAddressName = subscription.Employee?.Project?.AddressName,
            IsActive = subscription.IsActive,
            CreatedAt = subscription.CreatedAt,
            UpdatedAt = subscription.UpdatedAt
        };
    }
}
