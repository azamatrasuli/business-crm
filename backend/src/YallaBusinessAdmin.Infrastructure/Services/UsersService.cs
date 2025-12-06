using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Audit;
using YallaBusinessAdmin.Application.Common.Interfaces;
using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Users;
using YallaBusinessAdmin.Application.Users.Dtos;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class UsersService : IUsersService
{
    private readonly AppDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IAuditService _auditService;

    // Available routes that can be assigned as permissions (without leading slashes to match frontend)
    private static readonly string[] AvailableRoutes = new[]
    {
        "home",
        "employees",
        "users",
        "projects",
        "payments",
        "analytics",
        "meals",
        "news"
    };

    public UsersService(AppDbContext context, IPasswordHasher passwordHasher, IAuditService auditService)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _auditService = auditService;
    }

    public async Task<PagedResult<UserResponse>> GetAllAsync(
        int page, 
        int pageSize, 
        Guid companyId, 
        string? search = null,
        string? status = null,
        string? role = null,
        string? sortBy = null,
        bool sortDesc = true,
        CancellationToken cancellationToken = default)
    {
        var query = _context.AdminUsers
            .Include(u => u.Permissions)
            .Where(u => u.CompanyId == companyId);

        // Apply search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(u => 
                u.FullName.ToLower().Contains(searchLower) ||
                u.Phone.ToLower().Contains(searchLower) ||
                u.Email.ToLower().Contains(searchLower));
        }

        // Apply status filter
        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusEnum = AdminStatusExtensions.FromRussian(status);
            query = query.Where(u => u.Status == statusEnum);
        }

        // Apply role filter
        if (!string.IsNullOrWhiteSpace(role))
        {
            query = query.Where(u => u.Role == role);
        }

        // Apply sorting
        query = sortBy?.ToLower() switch
        {
            "fullname" or "name" => sortDesc 
                ? query.OrderByDescending(u => u.FullName) 
                : query.OrderBy(u => u.FullName),
            "phone" => sortDesc 
                ? query.OrderByDescending(u => u.Phone) 
                : query.OrderBy(u => u.Phone),
            "email" => sortDesc 
                ? query.OrderByDescending(u => u.Email) 
                : query.OrderBy(u => u.Email),
            "role" => sortDesc 
                ? query.OrderByDescending(u => u.Role) 
                : query.OrderBy(u => u.Role),
            "status" => sortDesc 
                ? query.OrderByDescending(u => u.Status) 
                : query.OrderBy(u => u.Status),
            _ => sortDesc 
                ? query.OrderByDescending(u => u.CreatedAt) 
                : query.OrderBy(u => u.CreatedAt)
        };

        var total = await query.CountAsync(cancellationToken);
        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = users.Select(MapToResponse);
        return PagedResult<UserResponse>.Create(items, total, page, pageSize);
    }

    public async Task<UserResponse> GetByIdAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default)
    {
        var user = await _context.AdminUsers
            .Include(u => u.Permissions)
            .FirstOrDefaultAsync(u => u.Id == id && u.CompanyId == companyId, cancellationToken);

        if (user == null)
        {
            throw new KeyNotFoundException("Пользователь не найден");
        }

        return MapToResponse(user);
    }

    public async Task<UserResponse> CreateAsync(CreateUserRequest request, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default)
    {
        // Check for duplicate phone (across all companies for global uniqueness)
        var existingUser = await _context.AdminUsers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Phone == request.Phone, cancellationToken);

        if (existingUser != null)
        {
            if (existingUser.DeletedAt != null)
            {
                throw new InvalidOperationException("Пользователь с таким телефоном был удален. Обратитесь к администратору.");
            }
            throw new InvalidOperationException("Пользователь с таким телефоном уже существует");
        }

        var user = new AdminUser
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            FullName = request.FullName,
            Phone = request.Phone,
            Email = request.Email,
            Role = request.Role,
            Status = AdminStatus.Inactive,
            PasswordHash = _passwordHasher.Hash(request.Password),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // Add permissions
        var validPermissions = SanitizePermissions(request.Permissions, request.Role);
        foreach (var route in validPermissions)
        {
            user.Permissions.Add(new UserPermission
            {
                Id = Guid.NewGuid(),
                AdminUserId = user.Id,
                Route = route
            });
        }

        await _context.AdminUsers.AddAsync(user, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        // Audit log
        await _auditService.LogAsync(
            currentUserId,
            AuditActions.Create,
            AuditEntityTypes.User,
            user.Id,
            newValues: new { user.FullName, user.Phone, user.Email, user.Role },
            cancellationToken: cancellationToken);

        return MapToResponse(user);
    }

    public async Task<UserResponse> UpdateAsync(Guid id, UpdateUserRequest request, Guid companyId, Guid? currentUserId = null, CancellationToken cancellationToken = default)
    {
        var user = await _context.AdminUsers
            .FirstOrDefaultAsync(u => u.Id == id && u.CompanyId == companyId, cancellationToken);

        if (user == null)
        {
            throw new KeyNotFoundException("Пользователь не найден");
        }

        // Check phone uniqueness if changed
        if (user.Phone != request.Phone)
        {
            var phoneExists = await _context.AdminUsers
                .AnyAsync(u => u.Phone == request.Phone && u.Id != id, cancellationToken);
            if (phoneExists)
            {
                throw new InvalidOperationException("Телефон уже используется другим пользователем");
            }
        }

        // Prevent self-role downgrade
        if (currentUserId == id && user.Role == "admin" && request.Role != "admin")
        {
            throw new InvalidOperationException("Вы не можете понизить свою роль");
        }

        var oldValues = new { user.FullName, user.Phone, user.Email, user.Role, Status = user.Status.ToRussian() };

        user.FullName = request.FullName;
        user.Phone = request.Phone;
        user.Email = request.Email;
        user.Role = request.Role;
        user.Status = AdminStatusExtensions.FromRussian(request.Status);
        user.UpdatedAt = DateTime.UtcNow;

        // Delete existing permissions directly (avoid concurrency issues with Include)
        var existingPermissions = await _context.UserPermissions
            .Where(p => p.AdminUserId == id)
            .ToListAsync(cancellationToken);
        _context.UserPermissions.RemoveRange(existingPermissions);

        // Add new permissions
        var validPermissions = SanitizePermissions(request.Permissions, request.Role);
        foreach (var route in validPermissions)
        {
            _context.UserPermissions.Add(new UserPermission
            {
                Id = Guid.NewGuid(),
                AdminUserId = id,
                Route = route
            });
        }

        await _context.SaveChangesAsync(cancellationToken);

        // Audit log
        await _auditService.LogAsync(
            currentUserId,
            AuditActions.Update,
            AuditEntityTypes.User,
            user.Id,
            oldValues: oldValues,
            newValues: new { request.FullName, request.Phone, request.Email, request.Role, request.Status },
            cancellationToken: cancellationToken);

        // Create response with the new permissions
        return new UserResponse
        {
            Id = user.Id,
            FullName = user.FullName,
            Phone = user.Phone,
            Email = user.Email,
            Role = user.Role,
            Status = user.Status.ToRussian(),
            CompanyId = user.CompanyId,
            Permissions = validPermissions,
            CreatedAt = user.CreatedAt,
            LastLoginAt = user.LastLoginAt
        };
    }

    public async Task DeleteAsync(Guid id, Guid companyId, Guid currentUserId, CancellationToken cancellationToken = default)
    {
        var user = await _context.AdminUsers
            .FirstOrDefaultAsync(u => u.Id == id && u.CompanyId == companyId, cancellationToken);

        if (user == null)
        {
            throw new KeyNotFoundException("Пользователь не найден");
        }

        // Prevent self-deletion
        if (id == currentUserId)
        {
            throw new InvalidOperationException("Вы не можете удалить свой собственный аккаунт");
        }

        // Prevent deleting the last admin
        if (user.Role == "admin")
        {
            var adminCount = await _context.AdminUsers
                .CountAsync(u => u.CompanyId == companyId && u.Role == "admin", cancellationToken);
            
            if (adminCount <= 1)
            {
                throw new InvalidOperationException("Невозможно удалить последнего администратора компании");
            }
        }

        // Soft delete instead of hard delete
        user.DeletedAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        
        // Also revoke all refresh tokens
        var userTokens = await _context.RefreshTokens
            .Where(t => t.UserId == id && t.RevokedAt == null)
            .ToListAsync(cancellationToken);
        
        foreach (var token in userTokens)
        {
            token.RevokedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        // Audit log
        await _auditService.LogAsync(
            currentUserId,
            AuditActions.Delete,
            AuditEntityTypes.User,
            id,
            oldValues: new { user.FullName, user.Phone, user.Email, user.Role },
            cancellationToken: cancellationToken);
    }

    public IEnumerable<string> GetAvailableRoutes() => AvailableRoutes;

    public async Task<IEnumerable<AdminListItem>> GetAllAdminsAsync(string? search = null, CancellationToken cancellationToken = default)
    {
        // Только администраторы проектов (не менеджеры, не SUPER_ADMIN)
        var adminRoles = new[] { "admin", "Admin", "ADMIN", "Администратор" };
        
        var query = _context.AdminUsers
            .Include(u => u.Company)
            .Include(u => u.Project)
            .Where(u => adminRoles.Contains(u.Role) && u.Role != "SUPER_ADMIN");

        // Apply search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(u => 
                u.FullName.ToLower().Contains(searchLower) ||
                u.Phone.ToLower().Contains(searchLower) ||
                u.Email.ToLower().Contains(searchLower) ||
                (u.Company != null && u.Company.Name.ToLower().Contains(searchLower)));
        }

        var users = await query
            .OrderBy(u => u.Company!.Name)
            .ThenBy(u => u.FullName)
            .ToListAsync(cancellationToken);

        return users.Select(u => new AdminListItem
        {
            Id = u.Id,
            FullName = u.FullName,
            Phone = u.Phone,
            Email = u.Email,
            Role = u.Role,
            Status = u.Status.ToRussian(),
            CompanyId = u.CompanyId,
            CompanyName = u.Company?.Name ?? "",
            ProjectId = u.ProjectId,
            ProjectName = u.Project?.Name,
            LastLoginAt = u.LastLoginAt
        });
    }

    private static UserResponse MapToResponse(AdminUser user)
    {
        return new UserResponse
        {
            Id = user.Id,
            FullName = user.FullName,
            Phone = user.Phone,
            Email = user.Email,
            Role = user.Role,
            Status = user.Status.ToRussian(),
            CompanyId = user.CompanyId,
            Permissions = user.Permissions.Select(p => p.Route),
            CreatedAt = user.CreatedAt,
            LastLoginAt = user.LastLoginAt
        };
    }

    private static IEnumerable<string> SanitizePermissions(IEnumerable<string> permissions, string role)
    {
        var permissionSet = permissions.ToHashSet();

        // Admins always get all routes
        if (role == "admin")
        {
            return AvailableRoutes;
        }

        // Managers get home by default
        if (role == "manager")
        {
            permissionSet.Add("home");
        }

        // Filter to only valid routes
        return permissionSet.Where(p => AvailableRoutes.Contains(p));
    }
}
