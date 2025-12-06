using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace YallaBusinessAdmin.Api.Controllers;

/// <summary>
/// Base controller with common functionality
/// </summary>
public abstract class BaseApiController : ControllerBase
{
    /// <summary>
    /// Get company ID from JWT
    /// </summary>
    protected Guid? GetCompanyId()
    {
        var companyIdClaim = User.FindFirst("company_id") ?? User.FindFirst("companyId");
        if (companyIdClaim != null && Guid.TryParse(companyIdClaim.Value, out var companyId))
        {
            return companyId;
        }
        return null;
    }

    /// <summary>
    /// Get user ID from JWT
    /// </summary>
    protected Guid? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst(JwtRegisteredClaimNames.Sub);
        if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return userId;
        }
        return null;
    }

    /// <summary>
    /// Get user role from JWT
    /// </summary>
    protected string? GetUserRole()
    {
        var roleClaim = User.FindFirst("role");
        return roleClaim?.Value;
    }
    
    /// <summary>
    /// Check if current user is SUPER_ADMIN
    /// </summary>
    protected bool IsSuperAdmin()
    {
        return GetUserRole() == "SUPER_ADMIN";
    }
    
    /// <summary>
    /// Get project ID from JWT
    /// </summary>
    protected Guid? GetProjectId()
    {
        var projectIdClaim = User.FindFirst("project_id") ?? User.FindFirst("projectId");
        if (projectIdClaim != null && Guid.TryParse(projectIdClaim.Value, out var projectId))
        {
            return projectId;
        }
        return null;
    }
    
    /// <summary>
    /// Get impersonator ID from JWT (if current session is impersonated)
    /// </summary>
    protected Guid? GetImpersonatedBy()
    {
        var impersonatedByClaim = User.FindFirst("impersonated_by");
        if (impersonatedByClaim != null && Guid.TryParse(impersonatedByClaim.Value, out var impersonatedBy))
        {
            return impersonatedBy;
        }
        return null;
    }
    
    /// <summary>
    /// Check if current session is an impersonation session
    /// </summary>
    protected bool IsImpersonating()
    {
        return GetImpersonatedBy() != null;
    }
}
