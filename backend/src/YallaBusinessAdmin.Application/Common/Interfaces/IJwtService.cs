using YallaBusinessAdmin.Domain.Entities;

namespace YallaBusinessAdmin.Application.Common.Interfaces;

/// <summary>
/// Service for JWT token generation and validation.
/// </summary>
public interface IJwtService
{
    string GenerateToken(AdminUser user);
    (Guid userId, Guid companyId)? ValidateToken(string token);
}

