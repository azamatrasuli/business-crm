using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using YallaBusinessAdmin.Application.Common.Interfaces;

namespace YallaBusinessAdmin.Api.Services;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid? UserId
    {
        get
        {
            var userIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier)
                ?? _httpContextAccessor.HttpContext?.User.FindFirst(JwtRegisteredClaimNames.Sub);

            if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
            {
                return userId;
            }
            return null;
        }
    }

    public Guid? CompanyId
    {
        get
        {
            var companyIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst("company_id")
                ?? _httpContextAccessor.HttpContext?.User.FindFirst("companyId");

            if (companyIdClaim != null && Guid.TryParse(companyIdClaim.Value, out var companyId))
            {
                return companyId;
            }
            return null;
        }
    }

    public Guid? ProjectId
    {
        get
        {
            var projectIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst("project_id")
                ?? _httpContextAccessor.HttpContext?.User.FindFirst("projectId");

            if (projectIdClaim != null && Guid.TryParse(projectIdClaim.Value, out var projectId))
            {
                return projectId;
            }
            return null;
        }
    }

    public bool IsHeadquarters
    {
        get
        {
            var claim = _httpContextAccessor.HttpContext?.User.FindFirst("is_headquarters");
            return claim != null && bool.TryParse(claim.Value, out var isHq) && isHq;
        }
    }

    public string? ProjectName => _httpContextAccessor.HttpContext?.User.FindFirst("project_name")?.Value;

    public string? Phone => _httpContextAccessor.HttpContext?.User.FindFirst("phone")?.Value;

    public string? Role => _httpContextAccessor.HttpContext?.User.FindFirst("role")?.Value
        ?? _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Role)?.Value;

    public bool IsAuthenticated => _httpContextAccessor.HttpContext?.User.Identity?.IsAuthenticated ?? false;
}

