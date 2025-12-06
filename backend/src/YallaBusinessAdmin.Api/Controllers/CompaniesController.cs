using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YallaBusinessAdmin.Application.Companies;
using YallaBusinessAdmin.Application.Companies.Dtos;

namespace YallaBusinessAdmin.Api.Controllers;

[ApiController]
[Route("api/companies")]
[Authorize]
public class CompaniesController : ControllerBase
{
    private readonly ICompaniesService _companiesService;

    public CompaniesController(ICompaniesService companiesService)
    {
        _companiesService = companiesService;
    }

    /// <summary>
    /// Get all companies (SUPER_ADMIN only)
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "SUPER_ADMIN")]
    public async Task<ActionResult<IEnumerable<CompanyListItem>>> GetAll()
    {
        var companies = await _companiesService.GetAllAsync();
        return Ok(companies);
    }

    /// <summary>
    /// Get company by ID (SUPER_ADMIN only)
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Roles = "SUPER_ADMIN")]
    public async Task<ActionResult<CompanyResponse>> GetById(Guid id)
    {
        var company = await _companiesService.GetByIdAsync(id);
        
        if (company == null)
        {
            return NotFound(new { message = "Компания не найдена" });
        }

        return Ok(company);
    }
}


