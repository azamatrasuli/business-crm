using YallaBusinessAdmin.Domain.Enums;

namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents a project (branch/division) within a company.
/// Each project has its own isolated budget, settings, and ONE delivery address.
/// IMPORTANT: Address is IMMUTABLE after creation. New address = New project.
/// Maps to table: projects
/// </summary>
public class Project
{
    public Guid Id { get; set; }
    
    /// <summary>Parent company (holding)</summary>
    public Guid CompanyId { get; set; }
    
    /// <summary>Project name (e.g., "Дороб Созидание")</summary>
    public string Name { get; set; } = string.Empty;
    
    // ═══════════════════════════════════════════════════════════════
    // DELIVERY ADDRESS (IMMUTABLE - one project = one address)
    // If address changes, create a new project
    // ═══════════════════════════════════════════════════════════════
    
    /// <summary>Short name for the address (e.g., "Главный офис")</summary>
    public string AddressName { get; set; } = string.Empty;
    
    /// <summary>Full delivery address (e.g., "ул. Рудаки 14, Душанбе")</summary>
    public string AddressFullAddress { get; set; } = string.Empty;
    
    /// <summary>Latitude for geo location (optional)</summary>
    public double? AddressLatitude { get; set; }
    
    /// <summary>Longitude for geo location (optional)</summary>
    public double? AddressLongitude { get; set; }
    
    // ═══════════════════════════════════════════════════════════════
    // FINANCE (isolated account)
    // ═══════════════════════════════════════════════════════════════
    public decimal Budget { get; set; }
    public decimal OverdraftLimit { get; set; }
    public string CurrencyCode { get; set; } = "TJS";
    
    // Status and settings
    public CompanyStatus Status { get; set; } = CompanyStatus.Active;
    public string Timezone { get; set; } = "Asia/Dushanbe";
    public TimeOnly CutoffTime { get; set; } = new TimeOnly(10, 30);
    
    /// <summary>True if this is the headquarters/main office. HQ admin can see all projects.</summary>
    public bool IsHeadquarters { get; set; }
    
    /// <summary>Type of service: LUNCH or COMPENSATION</summary>
    public ServiceType ServiceType { get; set; } = ServiceType.Lunch;
    
    // Compensation settings (if ServiceType = Compensation)
    /// <summary>Daily limit per employee for compensation</summary>
    public decimal CompensationDailyLimit { get; set; }
    /// <summary>If true, remaining balance accumulates; if false, it expires daily</summary>
    public bool CompensationRollover { get; set; }
    
    // Timestamps
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }

    // Navigation properties
    public Company? Company { get; set; }
    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
    public ICollection<AdminUser> AdminUsers { get; set; } = new List<AdminUser>();
    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ICollection<CompanyTransaction> Transactions { get; set; } = new List<CompanyTransaction>();
    public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
    public ICollection<CompanyDocument> Documents { get; set; } = new List<CompanyDocument>();
}




