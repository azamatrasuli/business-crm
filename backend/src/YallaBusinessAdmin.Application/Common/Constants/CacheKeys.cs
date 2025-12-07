namespace YallaBusinessAdmin.Application.Common.Constants;

/// <summary>
/// Cache key constants and generators
/// </summary>
public static class CacheKeys
{
    // Prefixes
    public const string CompanyPrefix = "company:";
    public const string ProjectPrefix = "project:";
    public const string EmployeePrefix = "employee:";
    public const string UserPrefix = "user:";
    public const string DashboardPrefix = "dashboard:";
    public const string SettingsPrefix = "settings:";
    
    // Company cache keys
    public static string Company(Guid companyId) => $"{CompanyPrefix}{companyId}";
    public static string CompanyProjects(Guid companyId) => $"{CompanyPrefix}{companyId}:projects";
    
    // Project cache keys
    public static string Project(Guid projectId) => $"{ProjectPrefix}{projectId}";
    public static string ProjectEmployees(Guid projectId) => $"{ProjectPrefix}{projectId}:employees";
    
    // Employee cache keys
    public static string Employee(Guid employeeId) => $"{EmployeePrefix}{employeeId}";
    public static string EmployeesByCompany(Guid companyId) => $"{EmployeePrefix}company:{companyId}";
    
    // User cache keys
    public static string User(Guid userId) => $"{UserPrefix}{userId}";
    public static string UserPermissions(Guid userId) => $"{UserPrefix}{userId}:permissions";
    
    // Dashboard cache keys
    public static string DashboardStats(Guid companyId) => $"{DashboardPrefix}{companyId}:stats";
    public static string DashboardOrders(Guid companyId, DateTime date) => $"{DashboardPrefix}{companyId}:orders:{date:yyyy-MM-dd}";
    
    // Cutoff time - cached globally per project
    public static string CutoffTime(Guid projectId) => $"{SettingsPrefix}cutoff:{projectId}";
    
    // Invalidation helpers
    public static string[] GetCompanyRelatedPrefixes(Guid companyId) => new[]
    {
        Company(companyId),
        CompanyProjects(companyId),
        EmployeesByCompany(companyId),
        DashboardStats(companyId)
    };
}

