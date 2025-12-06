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
    /// Get company ID from JWT or X-Company-Id header (for SUPER_ADMIN)
    /// </summary>
    protected Guid? GetCompanyId()
    {
        // Check if user is SUPER_ADMIN and has X-Company-Id header
        var role = GetUserRole();
        if (role == "SUPER_ADMIN")
        {
            // Try to get company from header first
            if (Request.Headers.TryGetValue("X-Company-Id", out var headerValue))
            {
                if (Guid.TryParse(headerValue.FirstOrDefault(), out var headerCompanyId))
                {
                    return headerCompanyId;
                }
            }
        }
        
        // Fall back to JWT claim
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
}

