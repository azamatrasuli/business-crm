namespace YallaBusinessAdmin.Application.Common.Interfaces;

/// <summary>
/// Service to access current authenticated user information.
/// </summary>
public interface ICurrentUserService
{
    Guid? UserId { get; }
    Guid? CompanyId { get; }
    Guid? ProjectId { get; }
    bool IsHeadquarters { get; }
    string? ProjectName { get; }
    string? Phone { get; }
    string? Role { get; }
    bool IsAuthenticated { get; }
}

