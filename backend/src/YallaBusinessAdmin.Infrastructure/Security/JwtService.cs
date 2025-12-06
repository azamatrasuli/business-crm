using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using YallaBusinessAdmin.Application.Common.Interfaces;
using YallaBusinessAdmin.Domain.Entities;

namespace YallaBusinessAdmin.Infrastructure.Security;

public class JwtService : IJwtService
{
    private readonly IConfiguration _configuration;
    private readonly string _secret;
    private readonly string _issuer;
    private readonly string _audience;
    private readonly int _expirationHours;

    public JwtService(IConfiguration configuration)
    {
        _configuration = configuration;
        _secret = configuration["Jwt:Secret"] ?? throw new InvalidOperationException("JWT Secret not configured");
        _issuer = configuration["Jwt:Issuer"] ?? "YallaBusinessAdmin";
        _audience = configuration["Jwt:Audience"] ?? "YallaBusinessAdmin";
        _expirationHours = int.Parse(configuration["Jwt:ExpirationHours"] ?? "24");
    }

    public string GenerateToken(AdminUser user, Guid? impersonatedBy = null)
    {
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secret));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim("phone", user.Phone),
            new Claim("role", user.Role),
            new Claim(ClaimTypes.Role, user.Role), // Standard role claim for ASP.NET authorization
            new Claim("company_id", user.CompanyId.ToString()),
            new Claim("companyId", user.CompanyId.ToString()) // For compatibility with frontend
        };
        
        // Add project claims if user has a project
        if (user.ProjectId.HasValue)
        {
            claims.Add(new Claim("project_id", user.ProjectId.Value.ToString()));
            claims.Add(new Claim("projectId", user.ProjectId.Value.ToString())); // For compatibility
        }
        
        // Add is_headquarters claim if project is loaded
        if (user.Project != null)
        {
            claims.Add(new Claim("is_headquarters", user.Project.IsHeadquarters.ToString().ToLower()));
            claims.Add(new Claim("project_name", user.Project.Name));
        }
        
        // Add impersonation claim if this is an impersonated session
        if (impersonatedBy.HasValue)
        {
            claims.Add(new Claim("impersonated_by", impersonatedBy.Value.ToString()));
        }

        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(_expirationHours),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public (Guid userId, Guid companyId)? ValidateToken(string token)
    {
        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_secret);

            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidIssuer = _issuer,
                ValidateAudience = true,
                ValidAudience = _audience,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            };

            var principal = tokenHandler.ValidateToken(token, validationParameters, out _);
            
            var userIdClaim = principal.FindFirst(ClaimTypes.NameIdentifier) ?? principal.FindFirst(JwtRegisteredClaimNames.Sub);
            var companyIdClaim = principal.FindFirst("company_id") ?? principal.FindFirst("companyId");

            if (userIdClaim == null || companyIdClaim == null)
                return null;

            return (Guid.Parse(userIdClaim.Value), Guid.Parse(companyIdClaim.Value));
        }
        catch
        {
            return null;
        }
    }
}

