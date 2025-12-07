using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Common.Errors;

namespace YallaBusinessAdmin.Api.Controllers;

/// <summary>
/// Base controller with common functionality for all API controllers.
/// Supports API versioning (default v1).
/// </summary>
[ApiVersion("1.0")]
public abstract class BaseApiController : ControllerBase
{
    /// <summary>
    /// Standard unauthorized error response.
    /// </summary>
    private static readonly object UnauthorizedResponse = new
    {
        success = false,
        error = new
        {
            code = ErrorCodes.AUTH_UNAUTHORIZED,
            message = "Требуется авторизация",
            type = "Forbidden"
        }
    };

    /// <summary>
    /// Gets the company ID from JWT claims.
    /// </summary>
    /// <returns>The company ID if present and valid, null otherwise.</returns>
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
    /// Gets the company ID from JWT claims, returning Unauthorized if not present.
    /// Use this method when company ID is required.
    /// </summary>
    /// <returns>
    /// A tuple containing the company ID (if valid) and an ActionResult (if invalid).
    /// If companyId is not null, use it. If errorResult is not null, return it.
    /// </returns>
    protected (Guid? companyId, ActionResult? errorResult) RequireCompanyId()
    {
        var companyId = GetCompanyId();
        if (companyId == null)
        {
            return (null, Unauthorized(UnauthorizedResponse));
        }
        return (companyId, null);
    }

    /// <summary>
    /// Gets the user ID from JWT claims.
    /// </summary>
    /// <returns>The user ID if present and valid, null otherwise.</returns>
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
    /// Gets the user role from JWT claims.
    /// </summary>
    /// <returns>The user role if present, null otherwise.</returns>
    protected string? GetUserRole()
    {
        var roleClaim = User.FindFirst("role");
        return roleClaim?.Value;
    }

    /// <summary>
    /// Checks if the current user is a SUPER_ADMIN.
    /// </summary>
    /// <returns>True if the user is a SUPER_ADMIN, false otherwise.</returns>
    protected bool IsSuperAdmin()
    {
        return GetUserRole() == "SUPER_ADMIN";
    }

    /// <summary>
    /// Gets the project ID from JWT claims.
    /// </summary>
    /// <returns>The project ID if present and valid, null otherwise.</returns>
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
    /// Gets the impersonator ID from JWT claims (if current session is impersonated).
    /// </summary>
    /// <returns>The impersonator user ID if present, null otherwise.</returns>
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
    /// Checks if the current session is an impersonation session.
    /// </summary>
    /// <returns>True if this is an impersonation session, false otherwise.</returns>
    protected bool IsImpersonating()
    {
        return GetImpersonatedBy() != null;
    }

    /// <summary>
    /// Creates a standard unauthorized response.
    /// </summary>
    /// <returns>Unauthorized ActionResult with standard error format.</returns>
    protected ActionResult UnauthorizedError()
    {
        return Unauthorized(UnauthorizedResponse);
    }

    /// <summary>
    /// Creates a standard not found response.
    /// </summary>
    /// <param name="message">The error message.</param>
    /// <returns>NotFound ActionResult with standard error format.</returns>
    protected ActionResult NotFoundError(string message = "Ресурс не найден")
    {
        return NotFound(new
        {
            success = false,
            error = new
            {
                code = ErrorCodes.NOT_FOUND,
                message,
                type = "NotFound"
            }
        });
    }

    /// <summary>
    /// Creates a standard bad request response.
    /// </summary>
    /// <param name="message">The error message.</param>
    /// <param name="code">The error code (defaults to VALIDATION_ERROR).</param>
    /// <returns>BadRequest ActionResult with standard error format.</returns>
    protected ActionResult BadRequestError(string message, string code = ErrorCodes.VALIDATION_ERROR)
    {
        return BadRequest(new
        {
            success = false,
            error = new
            {
                code,
                message,
                type = "Validation"
            }
        });
    }

    /// <summary>
    /// Creates a success response with data.
    /// </summary>
    /// <typeparam name="T">The type of the data.</typeparam>
    /// <param name="data">The data to return.</param>
    /// <returns>Ok ActionResult with the data.</returns>
    protected ActionResult<T> SuccessResult<T>(T data)
    {
        return Ok(data);
    }
}
