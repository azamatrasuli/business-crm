namespace YallaBusinessAdmin.Application.Auth.Dtos;

public class CurrentUserResponse
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public Guid CompanyId { get; set; }
    public Guid? ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public bool IsHeadquarters { get; set; }
    public List<string>? ProjectServiceTypes { get; set; }
    public IEnumerable<string> Permissions { get; set; } = Enumerable.Empty<string>();
    
    // Company info
    public CompanyInfoDto? Company { get; set; }
    
    // Project info
    public ProjectInfoDto? Project { get; set; }
    
    // Tracking info
    public DateTime? LastLoginAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CompanyInfoDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Budget { get; set; }
    public string Status { get; set; } = string.Empty;
    public string CurrencyCode { get; set; } = "TJS";
    public string Timezone { get; set; } = "Asia/Dushanbe";
    public TimeOnly CutoffTime { get; set; }
}

public class ProjectInfoDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Budget { get; set; }
    public string Status { get; set; } = string.Empty;
    public List<string> ServiceTypes { get; set; } = new List<string> { "LUNCH" };
    public bool IsHeadquarters { get; set; }
    public string CurrencyCode { get; set; } = "TJS";
    public string Timezone { get; set; } = "Asia/Dushanbe";
    public TimeOnly CutoffTime { get; set; }
    public decimal CompensationDailyLimit { get; set; }
    public bool CompensationRollover { get; set; }
}

