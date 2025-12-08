using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Audit;
using YallaBusinessAdmin.Application.Auth;
using YallaBusinessAdmin.Application.Auth.Dtos;
using YallaBusinessAdmin.Application.Common;
using YallaBusinessAdmin.Application.Common.Interfaces;
using YallaBusinessAdmin.Application.Common.Validators;
using YallaBusinessAdmin.Application.Common.Errors;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtService _jwtService;
    private readonly IAuditService _auditService;
    
    // Refresh token validity period (7 days)
    private const int RefreshTokenExpirationDays = 7;

    public AuthService(
        AppDbContext context, 
        IPasswordHasher passwordHasher, 
        IJwtService jwtService,
        IAuditService auditService)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _jwtService = jwtService;
        _auditService = auditService;
    }

    public async Task<LoginResponse> LoginAsync(
        LoginRequest request, 
        string? ipAddress = null, 
        string? userAgent = null,
        CancellationToken cancellationToken = default)
    {
        var user = await _context.AdminUsers
            .IgnoreQueryFilters() // Include soft-deleted for proper error messages
            .Include(u => u.Permissions)
            .Include(u => u.Project)
            .Include(u => u.Company)
            .FirstOrDefaultAsync(u => u.Phone == request.Phone, cancellationToken);

        if (user == null)
        {
            await _auditService.LogAsync(null, AuditActions.LoginFailed, AuditEntityTypes.User, 
                newValues: new { phone = request.Phone, reason = "User not found" },
                ipAddress: ipAddress, userAgent: userAgent, cancellationToken: cancellationToken);
            throw new UnauthorizedAccessException("Неверный логин или пароль");
        }

        if (user.DeletedAt != null)
        {
            await _auditService.LogAsync(user.Id, AuditActions.LoginFailed, AuditEntityTypes.User, user.Id,
                newValues: new { reason = "Account deleted" },
                ipAddress: ipAddress, userAgent: userAgent, cancellationToken: cancellationToken);
            throw new UnauthorizedAccessException("Аккаунт был удален");
        }

        if (user.Status == AdminStatus.Blocked)
        {
            await _auditService.LogAsync(user.Id, AuditActions.LoginFailed, AuditEntityTypes.User, user.Id,
                newValues: new { reason = "Account blocked" },
                ipAddress: ipAddress, userAgent: userAgent, cancellationToken: cancellationToken);
            throw new UnauthorizedAccessException("Пользователь заблокирован");
        }

        if (!_passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            await _auditService.LogAsync(user.Id, AuditActions.LoginFailed, AuditEntityTypes.User, user.Id,
                newValues: new { reason = "Invalid password" },
                ipAddress: ipAddress, userAgent: userAgent, cancellationToken: cancellationToken);
            throw new UnauthorizedAccessException("Неверный логин или пароль");
        }

        // Update last login time
        user.LastLoginAt = DateTime.UtcNow;
        
        // Generate tokens
        var accessToken = _jwtService.GenerateToken(user);
        var refreshToken = GenerateRefreshToken();
        var refreshTokenHash = HashToken(refreshToken);
        var expiresAt = DateTimeOffset.UtcNow.AddHours(24).ToUnixTimeMilliseconds();
        
        // Store refresh token
        var refreshTokenEntity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = refreshTokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenExpirationDays),
            CreatedAt = DateTime.UtcNow,
            IpAddress = ipAddress,
            DeviceInfo = userAgent
        };
        
        await _context.RefreshTokens.AddAsync(refreshTokenEntity, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        // Audit log
        await _auditService.LogAsync(user.Id, AuditActions.Login, AuditEntityTypes.User, user.Id,
            ipAddress: ipAddress, userAgent: userAgent, cancellationToken: cancellationToken);

        return new LoginResponse
        {
            Token = accessToken,
            RefreshToken = refreshToken,
            ExpiresAt = expiresAt,
            User = new UserDto
            {
                Id = user.Id,
                FullName = user.FullName,
                Phone = user.Phone,
                Email = user.Email,
                Role = user.Role,
                Status = user.Status.ToRussian(),
                CompanyId = user.CompanyId,
                CompanyName = user.Company?.Name,
                ProjectId = user.ProjectId,
                ProjectName = user.Project?.Name,
                IsHeadquarters = user.Project?.IsHeadquarters ?? false,
                ProjectServiceTypes = user.Project?.ServiceTypes,
                Permissions = user.Permissions.Select(p => p.Route)
            }
        };
    }

    public async Task<LoginResponse> RefreshTokenAsync(
        RefreshTokenRequest request, 
        string? ipAddress = null,
        CancellationToken cancellationToken = default)
    {
        var tokenHash = HashToken(request.RefreshToken);
        
        var storedToken = await _context.RefreshTokens
            .Include(t => t.User)
                .ThenInclude(u => u!.Permissions)
            .Include(t => t.User)
                .ThenInclude(u => u!.Project)
            .Include(t => t.User)
                .ThenInclude(u => u!.Company)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);

        if (storedToken == null)
        {
            throw new UnauthorizedAccessException("Недействительный refresh token");
        }

        if (!storedToken.IsActive)
        {
            // Token is revoked or expired - could be token reuse attack
            throw new UnauthorizedAccessException("Refresh token истек или был отозван");
        }

        var user = storedToken.User;
        if (user == null || user.DeletedAt != null || user.Status == AdminStatus.Blocked)
        {
            throw new UnauthorizedAccessException("Пользователь недоступен");
        }

        // Revoke old token
        storedToken.RevokedAt = DateTime.UtcNow;
        
        // Generate new tokens
        var accessToken = _jwtService.GenerateToken(user);
        var newRefreshToken = GenerateRefreshToken();
        var newRefreshTokenHash = HashToken(newRefreshToken);
        var expiresAt = DateTimeOffset.UtcNow.AddHours(24).ToUnixTimeMilliseconds();
        
        // Store new refresh token
        var newRefreshTokenEntity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = newRefreshTokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenExpirationDays),
            CreatedAt = DateTime.UtcNow,
            IpAddress = ipAddress,
            DeviceInfo = storedToken.DeviceInfo
        };
        
        await _context.RefreshTokens.AddAsync(newRefreshTokenEntity, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        return new LoginResponse
        {
            Token = accessToken,
            RefreshToken = newRefreshToken,
            ExpiresAt = expiresAt,
            User = new UserDto
            {
                Id = user.Id,
                FullName = user.FullName,
                Phone = user.Phone,
                Email = user.Email,
                Role = user.Role,
                Status = user.Status.ToRussian(),
                CompanyId = user.CompanyId,
                CompanyName = user.Company?.Name,
                ProjectId = user.ProjectId,
                ProjectName = user.Project?.Name,
                IsHeadquarters = user.Project?.IsHeadquarters ?? false,
                ProjectServiceTypes = user.Project?.ServiceTypes,
                Permissions = user.Permissions.Select(p => p.Route)
            }
        };
    }

    public async Task LogoutAsync(Guid userId, string? refreshToken = null, CancellationToken cancellationToken = default)
    {
        if (!string.IsNullOrEmpty(refreshToken))
        {
            var tokenHash = HashToken(refreshToken);
            var storedToken = await _context.RefreshTokens
                .FirstOrDefaultAsync(t => t.TokenHash == tokenHash && t.UserId == userId, cancellationToken);

            if (storedToken != null)
            {
                storedToken.RevokedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
            }
        }

        await _auditService.LogAsync(userId, AuditActions.Logout, AuditEntityTypes.User, userId,
            cancellationToken: cancellationToken);
    }

    public async Task<object> ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken cancellationToken = default)
    {
        var user = await _context.AdminUsers
            .FirstOrDefaultAsync(u => u.Email == request.Email, cancellationToken);

        // Always return success message to prevent email enumeration
        // In production, send actual reset email here
        if (user != null)
        {
            // TODO: Implement email sending with reset token
            // Generate a password reset token and send via email
            var resetToken = _jwtService.GenerateToken(user); // Short-lived token for reset
            Console.WriteLine($"📧 Password reset requested for {request.Email}");
            Console.WriteLine($"Reset token: {resetToken}");
            
            await _auditService.LogAsync(user.Id, AuditActions.PasswordReset, AuditEntityTypes.User, user.Id,
                newValues: new { email = request.Email, status = "requested" },
                cancellationToken: cancellationToken);
        }

        return new { message = "Если email существует, мы отправили инструкцию по сбросу" };
    }

    public async Task<object> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken = default)
    {
        // Validate password complexity
        var passwordValidation = PasswordValidator.Validate(request.Password);
        if (!passwordValidation.IsValid)
        {
            throw new AppException(
                ErrorCodes.AUTH_PASSWORD_WEAK,
                passwordValidation.ErrorMessage,
                ErrorType.Validation,
                new Dictionary<string, object> { { "errors", passwordValidation.Errors } }
            );
        }

        var tokenData = _jwtService.ValidateToken(request.Token);
        if (tokenData == null)
        {
            throw new ArgumentException("Недействительный или просроченный токен");
        }

        var user = await _context.AdminUsers
            .FirstOrDefaultAsync(u => u.Id == tokenData.Value.userId, cancellationToken);

        if (user == null)
        {
            throw new ArgumentException("Недействительный токен");
        }

        var oldPasswordHash = user.PasswordHash;
        user.PasswordHash = _passwordHasher.Hash(request.Password);
        if (user.Status == AdminStatus.Inactive)
        {
            user.Status = AdminStatus.Active;
        }
        user.UpdatedAt = DateTime.UtcNow;

        // Revoke all refresh tokens for security
        var userTokens = await _context.RefreshTokens
            .Where(t => t.UserId == user.Id && t.RevokedAt == null)
            .ToListAsync(cancellationToken);
        
        foreach (var token in userTokens)
        {
            token.RevokedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(user.Id, AuditActions.PasswordReset, AuditEntityTypes.User, user.Id,
            oldValues: new { passwordHash = "***" },
            newValues: new { passwordHash = "***", status = "completed" },
            cancellationToken: cancellationToken);

        return new { message = "Пароль успешно обновлен" };
    }

    public async Task<object> ChangePasswordAsync(
        Guid userId, 
        ChangePasswordRequest request, 
        string? ipAddress = null,
        CancellationToken cancellationToken = default)
    {
        // Validate new password complexity
        var passwordValidation = PasswordValidator.Validate(request.NewPassword);
        if (!passwordValidation.IsValid)
        {
            throw new AppException(
                ErrorCodes.AUTH_PASSWORD_WEAK,
                passwordValidation.ErrorMessage,
                ErrorType.Validation,
                new Dictionary<string, object> { { "errors", passwordValidation.Errors } }
            );
        }

        var user = await _context.AdminUsers
            .Include(u => u.Permissions)
            .Include(u => u.Project)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            throw new KeyNotFoundException("Пользователь не найден");
        }

        if (!_passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
        {
            await _auditService.LogAsync(userId, AuditActions.PasswordChange, AuditEntityTypes.User, userId,
                newValues: new { status = "failed", reason = "Invalid current password" },
                ipAddress: ipAddress, cancellationToken: cancellationToken);
            throw new UnauthorizedAccessException("Неверный текущий пароль");
        }

        user.PasswordHash = _passwordHasher.Hash(request.NewPassword);
        if (user.Status == AdminStatus.Inactive)
        {
            user.Status = AdminStatus.Active;
        }
        user.UpdatedAt = DateTime.UtcNow;

        // Revoke all refresh tokens for security (except current session if needed)
        var userTokens = await _context.RefreshTokens
            .Where(t => t.UserId == user.Id && t.RevokedAt == null)
            .ToListAsync(cancellationToken);
        
        foreach (var token in userTokens)
        {
            token.RevokedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(userId, AuditActions.PasswordChange, AuditEntityTypes.User, userId,
            newValues: new { status = "success" },
            ipAddress: ipAddress, cancellationToken: cancellationToken);

        return new
        {
            message = "Пароль успешно изменен",
            user = new UserDto
            {
                Id = user.Id,
                FullName = user.FullName,
                Phone = user.Phone,
                Email = user.Email,
                Role = user.Role,
                Status = user.Status.ToRussian(),
                CompanyId = user.CompanyId,
                ProjectId = user.ProjectId,
                ProjectName = user.Project?.Name,
                IsHeadquarters = user.Project?.IsHeadquarters ?? false,
                ProjectServiceTypes = user.Project?.ServiceTypes,
                Permissions = user.Permissions.Select(p => p.Route)
            }
        };
    }

    public async Task<UserDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken cancellationToken = default)
    {
        var user = await _context.AdminUsers
            .Include(u => u.Permissions)
            .Include(u => u.Project)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            throw new KeyNotFoundException("Пользователь не найден");
        }

        // Check phone uniqueness
        if (user.Phone != request.Phone)
        {
            var phoneExists = await _context.AdminUsers
                .AnyAsync(u => u.Phone == request.Phone && u.Id != userId, cancellationToken);
            if (phoneExists)
            {
                throw new InvalidOperationException("Телефон уже используется другим пользователем");
            }
        }

        var oldValues = new { user.FullName, user.Phone, user.Email };
        
        user.FullName = request.FullName;
        user.Phone = request.Phone;
        user.Email = request.Email;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(userId, AuditActions.Update, AuditEntityTypes.User, userId,
            oldValues: oldValues,
            newValues: new { request.FullName, request.Phone, request.Email },
            cancellationToken: cancellationToken);

        return new UserDto
        {
            Id = user.Id,
            FullName = user.FullName,
            Phone = user.Phone,
            Email = user.Email,
            Role = user.Role,
            Status = user.Status.ToRussian(),
            CompanyId = user.CompanyId,
            ProjectId = user.ProjectId,
            ProjectName = user.Project?.Name,
            IsHeadquarters = user.Project?.IsHeadquarters ?? false,
            ProjectServiceTypes = user.Project?.ServiceTypes,
            Permissions = user.Permissions.Select(p => p.Route)
        };
    }

    public async Task<CurrentUserResponse> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _context.AdminUsers
            .Include(u => u.Permissions)
            .Include(u => u.Company)
            .Include(u => u.Project)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            throw new KeyNotFoundException("Пользователь не найден");
        }

        return new CurrentUserResponse
        {
            Id = user.Id,
            FullName = user.FullName,
            Phone = user.Phone,
            Email = user.Email,
            Role = user.Role,
            Status = user.Status.ToRussian(),
            CompanyId = user.CompanyId,
            ProjectId = user.ProjectId,
            ProjectName = user.Project?.Name,
            IsHeadquarters = user.Project?.IsHeadquarters ?? false,
            ProjectServiceTypes = user.Project?.ServiceTypes,
            Permissions = user.Permissions.Select(p => p.Route),
            LastLoginAt = user.LastLoginAt,
            CreatedAt = user.CreatedAt,
            Company = user.Company != null ? new CompanyInfoDto
            {
                Id = user.Company.Id,
                Name = user.Company.Name,
                Budget = user.Company.Budget,
                Status = user.Company.Status.ToDatabase(),
                CurrencyCode = user.Company.CurrencyCode,
                Timezone = user.Company.Timezone,
                CutoffTime = user.Company.CutoffTime
            } : null,
            Project = user.Project != null ? new ProjectInfoDto
            {
                Id = user.Project.Id,
                Name = user.Project.Name,
                Budget = user.Project.Budget,
                Status = user.Project.Status.ToDatabase(),
                ServiceTypes = user.Project.ServiceTypes,
                IsHeadquarters = user.Project.IsHeadquarters,
                CurrencyCode = user.Project.CurrencyCode,
                Timezone = user.Project.Timezone,
                CutoffTime = user.Project.CutoffTime,
                CompensationDailyLimit = user.Project.CompensationDailyLimit,
                CompensationRollover = user.Project.CompensationRollover
            } : null
        };
    }

    public async Task<LoginResponse> ImpersonateAsync(
        Guid targetUserId, 
        Guid impersonatorId, 
        string? ipAddress = null, 
        string? userAgent = null,
        CancellationToken cancellationToken = default)
    {
        // Get the target user to impersonate
        var targetUser = await _context.AdminUsers
            .Include(u => u.Permissions)
            .Include(u => u.Project)
            .Include(u => u.Company)
            .FirstOrDefaultAsync(u => u.Id == targetUserId && u.DeletedAt == null, cancellationToken);

        if (targetUser == null)
        {
            throw new KeyNotFoundException("Пользователь не найден");
        }

        if (targetUser.Status == AdminStatus.Blocked)
        {
            throw new InvalidOperationException("Невозможно войти под заблокированным пользователем");
        }

        // Generate token with impersonation claim
        var accessToken = _jwtService.GenerateToken(targetUser, impersonatorId);
        var refreshToken = GenerateRefreshToken();
        var refreshTokenHash = HashToken(refreshToken);
        var expiresAt = DateTimeOffset.UtcNow.AddHours(24).ToUnixTimeMilliseconds();
        
        // Store refresh token
        var refreshTokenEntity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = targetUser.Id,
            TokenHash = refreshTokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenExpirationDays),
            CreatedAt = DateTime.UtcNow,
            IpAddress = ipAddress,
            DeviceInfo = userAgent
        };
        
        await _context.RefreshTokens.AddAsync(refreshTokenEntity, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        // Audit log
        await _auditService.LogAsync(impersonatorId, "IMPERSONATE", AuditEntityTypes.User, targetUserId,
            newValues: new { targetUser = targetUser.FullName, targetCompany = targetUser.Company?.Name },
            ipAddress: ipAddress, userAgent: userAgent, cancellationToken: cancellationToken);

        return new LoginResponse
        {
            Token = accessToken,
            RefreshToken = refreshToken,
            ExpiresAt = expiresAt,
            IsImpersonating = true,
            ImpersonatedBy = impersonatorId,
            User = new UserDto
            {
                Id = targetUser.Id,
                FullName = targetUser.FullName,
                Phone = targetUser.Phone,
                Email = targetUser.Email,
                Role = targetUser.Role,
                Status = targetUser.Status.ToRussian(),
                CompanyId = targetUser.CompanyId,
                CompanyName = targetUser.Company?.Name,
                ProjectId = targetUser.ProjectId,
                ProjectName = targetUser.Project?.Name,
                IsHeadquarters = targetUser.Project?.IsHeadquarters ?? false,
                ProjectServiceTypes = targetUser.Project?.ServiceTypes,
                Permissions = targetUser.Permissions.Select(p => p.Route)
            }
        };
    }

    public async Task<LoginResponse> StopImpersonatingAsync(
        Guid impersonatorId, 
        Guid impersonatedUserId, 
        string? ipAddress = null, 
        string? userAgent = null,
        CancellationToken cancellationToken = default)
    {
        // Get the impersonated user's info for audit log
        var impersonatedUser = await _context.AdminUsers
            .Include(u => u.Company)
            .FirstOrDefaultAsync(u => u.Id == impersonatedUserId, cancellationToken);

        // Audit log - record end of impersonation session
        await _auditService.LogAsync(impersonatorId, "STOP_IMPERSONATE", AuditEntityTypes.User, impersonatedUserId,
            newValues: new { 
                impersonatedUser = impersonatedUser?.FullName ?? "Unknown", 
                impersonatedCompany = impersonatedUser?.Company?.Name ?? "Unknown" 
            },
            ipAddress: ipAddress, userAgent: userAgent, cancellationToken: cancellationToken);

        // Get the original user (impersonator) and generate fresh tokens
        var originalUser = await _context.AdminUsers
            .Include(u => u.Permissions)
            .Include(u => u.Project)
            .Include(u => u.Company)
            .FirstOrDefaultAsync(u => u.Id == impersonatorId && u.DeletedAt == null, cancellationToken);

        if (originalUser == null)
        {
            throw new KeyNotFoundException("Оригинальный пользователь не найден");
        }

        // Generate fresh tokens for the original user (no impersonation claim)
        var accessToken = _jwtService.GenerateToken(originalUser);
        var refreshToken = GenerateRefreshToken();
        var refreshTokenHash = HashToken(refreshToken);
        var expiresAt = DateTimeOffset.UtcNow.AddHours(24).ToUnixTimeMilliseconds();
        
        // Store refresh token
        var refreshTokenEntity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = originalUser.Id,
            TokenHash = refreshTokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenExpirationDays),
            CreatedAt = DateTime.UtcNow,
            IpAddress = ipAddress,
            DeviceInfo = userAgent
        };
        
        await _context.RefreshTokens.AddAsync(refreshTokenEntity, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        return new LoginResponse
        {
            Token = accessToken,
            RefreshToken = refreshToken,
            ExpiresAt = expiresAt,
            IsImpersonating = false,
            ImpersonatedBy = null,
            User = new UserDto
            {
                Id = originalUser.Id,
                FullName = originalUser.FullName,
                Phone = originalUser.Phone,
                Email = originalUser.Email,
                Role = originalUser.Role,
                Status = originalUser.Status.ToRussian(),
                CompanyId = originalUser.CompanyId,
                CompanyName = originalUser.Company?.Name,
                ProjectId = originalUser.ProjectId,
                ProjectName = originalUser.Project?.Name,
                IsHeadquarters = originalUser.Project?.IsHeadquarters ?? false,
                ProjectServiceTypes = originalUser.Project?.ServiceTypes,
                Permissions = originalUser.Permissions.Select(p => p.Route)
            }
        };
    }

    // Helper methods
    private static string GenerateRefreshToken()
    {
        var randomNumber = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }

    private static string HashToken(string token)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(token));
        return Convert.ToBase64String(bytes);
    }
}
