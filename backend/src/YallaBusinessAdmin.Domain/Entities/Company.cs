using YallaBusinessAdmin.Domain.Enums;

namespace YallaBusinessAdmin.Domain.Entities;

/// <summary>
/// Represents a company (tenant) in the system.
/// Maps to table: companies
/// </summary>
public class Company
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    
    // Status
    public CompanyStatus Status { get; set; } = CompanyStatus.Active;
    
    // Finance
    public decimal Budget { get; set; }
    public decimal OverdraftLimit { get; set; }
    public string CurrencyCode { get; set; } = "TJS";
    
    // Settings
    public string Timezone { get; set; } = "Asia/Dushanbe";
    public TimeOnly CutoffTime { get; set; } = new TimeOnly(10, 30);
    
    // Timestamps
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }

    // Navigation properties
    public ICollection<AdminUser> AdminUsers { get; set; } = new List<AdminUser>();
    public ICollection<Project> Projects { get; set; } = new List<Project>();
    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ICollection<LunchSubscription> LunchSubscriptions { get; set; } = new List<LunchSubscription>();
    public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
    public ICollection<CompanyTransaction> Transactions { get; set; } = new List<CompanyTransaction>();
    public ICollection<CompanyDocument> Documents { get; set; } = new List<CompanyDocument>();
}
