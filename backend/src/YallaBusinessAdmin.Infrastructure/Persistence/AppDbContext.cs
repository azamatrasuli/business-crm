using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Domain.Entities;
using YallaBusinessAdmin.Domain.Enums;

namespace YallaBusinessAdmin.Infrastructure.Persistence;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    // Core entities
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<AdminUser> AdminUsers => Set<AdminUser>();
    public DbSet<UserPermission> UserPermissions => Set<UserPermission>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<EmployeeBudget> EmployeeBudgets => Set<EmployeeBudget>();
    public DbSet<Order> Orders => Set<Order>();

    // New entities
    public DbSet<LunchSubscription> LunchSubscriptions => Set<LunchSubscription>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<CompanyTransaction> CompanyTransactions => Set<CompanyTransaction>();
    public DbSet<CompanyDocument> CompanyDocuments => Set<CompanyDocument>();
    public DbSet<SystemNews> SystemNews => Set<SystemNews>();
    public DbSet<NewsReadStatus> NewsReadStatuses => Set<NewsReadStatus>();

    // Compensation entities
    public DbSet<CompensationTransaction> CompensationTransactions => Set<CompensationTransaction>();
    public DbSet<EmployeeCompensationBalance> EmployeeCompensationBalances => Set<EmployeeCompensationBalance>();

    // Auth and audit entities
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Company
        modelBuilder.Entity<Company>(entity =>
        {
            entity.ToTable("companies");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired();
            entity.Property(e => e.Status).HasColumnName("status")
                .HasConversion(
                    v => v.ToRussian(),
                    v => CompanyStatusExtensions.FromRussian(v));
            entity.Property(e => e.Budget).HasColumnName("budget").HasPrecision(15, 2);
            entity.Property(e => e.OverdraftLimit).HasColumnName("overdraft_limit").HasPrecision(15, 2);
            entity.Property(e => e.CurrencyCode).HasColumnName("currency_code").HasMaxLength(3);
            entity.Property(e => e.Timezone).HasColumnName("timezone").HasMaxLength(50);
            entity.Property(e => e.CutoffTime).HasColumnName("cutoff_time");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");

            // Soft delete query filter
            entity.HasQueryFilter(e => e.DeletedAt == null);
        });

        // Project
        modelBuilder.Entity<Project>(entity =>
        {
            entity.ToTable("projects");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired();

            // Address fields (immutable after creation)
            entity.Property(e => e.AddressName).HasColumnName("address_name").HasMaxLength(255);
            entity.Property(e => e.AddressFullAddress).HasColumnName("address_full_address");
            entity.Property(e => e.AddressLatitude).HasColumnName("address_latitude");
            entity.Property(e => e.AddressLongitude).HasColumnName("address_longitude");

            entity.Property(e => e.Budget).HasColumnName("budget").HasPrecision(15, 2);
            entity.Property(e => e.OverdraftLimit).HasColumnName("overdraft_limit").HasPrecision(15, 2);
            entity.Property(e => e.CurrencyCode).HasColumnName("currency_code").HasMaxLength(3);
            entity.Property(e => e.Status).HasColumnName("status")
                .HasConversion(
                    v => v.ToRussian(),
                    v => CompanyStatusExtensions.FromRussian(v));
            entity.Property(e => e.Timezone).HasColumnName("timezone").HasMaxLength(50);
            entity.Property(e => e.CutoffTime).HasColumnName("cutoff_time");
            entity.Property(e => e.ServiceTypes).HasColumnName("service_types");
            entity.Property(e => e.CompensationDailyLimit).HasColumnName("compensation_daily_limit").HasPrecision(10, 2);
            entity.Property(e => e.CompensationRollover).HasColumnName("compensation_rollover");
            entity.Property(e => e.IsHeadquarters).HasColumnName("is_headquarters");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");

            entity.HasOne(e => e.Company)
                .WithMany(c => c.Projects)
                .HasForeignKey(e => e.CompanyId)
                .OnDelete(DeleteBehavior.Cascade);

            // Soft delete query filter
            entity.HasQueryFilter(e => e.DeletedAt == null);
        });

        // AdminUser
        modelBuilder.Entity<AdminUser>(entity =>
        {
            entity.ToTable("admin_users");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.ProjectId).HasColumnName("project_id");
            entity.Property(e => e.FullName).HasColumnName("full_name").IsRequired();
            entity.Property(e => e.Phone).HasColumnName("phone").IsRequired();
            entity.Property(e => e.Email).HasColumnName("email").IsRequired();
            entity.Property(e => e.Role).HasColumnName("role").IsRequired();
            entity.Property(e => e.Status).HasColumnName("status")
                .HasConversion(
                    v => v.ToRussian(),
                    v => AdminStatusExtensions.FromRussian(v));
            entity.Property(e => e.PasswordHash).HasColumnName("password_hash").IsRequired();
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.LastLoginAt).HasColumnName("last_login_at");

            entity.HasIndex(e => e.Phone).IsUnique();
            entity.HasOne(e => e.Company)
                .WithMany(c => c.AdminUsers)
                .HasForeignKey(e => e.CompanyId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Project)
                .WithMany(p => p.AdminUsers)
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.SetNull);

            // Soft delete query filter
            entity.HasQueryFilter(e => e.DeletedAt == null);
        });

        // UserPermission
        modelBuilder.Entity<UserPermission>(entity =>
        {
            entity.ToTable("user_permissions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.AdminUserId).HasColumnName("admin_user_id");
            entity.Property(e => e.Route).HasColumnName("route").IsRequired();

            entity.HasIndex(e => new { e.AdminUserId, e.Route }).IsUnique();
            entity.HasOne(e => e.AdminUser)
                .WithMany(u => u.Permissions)
                .HasForeignKey(e => e.AdminUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Employee
        modelBuilder.Entity<Employee>(entity =>
        {
            entity.ToTable("employees");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.ProjectId).HasColumnName("project_id").IsRequired();
            entity.Property(e => e.FullName).HasColumnName("full_name").IsRequired();
            entity.Property(e => e.Phone).HasColumnName("phone").IsRequired();
            entity.Property(e => e.Email).HasColumnName("email"); // Email is optional
            entity.Property(e => e.Position).HasColumnName("position");
            // Status maps to is_active boolean column with conversion
            // TODO: Add migration to create 'status' text column, then switch mapping
            entity.Property(e => e.Status).HasColumnName("is_active")
                .HasConversion(
                    v => v.ToBool(),  // EmployeeStatus -> bool for DB
                    v => EmployeeStatusExtensions.FromBool(v));  // bool from DB -> EmployeeStatus
            entity.Ignore(e => e.IsActive);  // Computed property, not stored
            entity.Property(e => e.InviteStatus).HasColumnName("invite_status")
                .HasConversion(
                    v => v.ToRussian(),
                    v => EmployeeInviteStatusExtensions.FromRussian(v));
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");

            // Service Type (attached to employee)
            entity.Property(e => e.ServiceType).HasColumnName("service_type")
                .HasConversion(
                    v => v.HasValue ? v.Value.ToDatabase() : null,
                    v => v != null ? ServiceTypeExtensions.FromDatabase(v) : null);

            // Work Schedule
            entity.Property(e => e.ShiftType).HasColumnName("shift_type")
                .HasConversion(
                    v => v.HasValue ? v.Value.ToDatabase() : null,
                    v => v != null ? ShiftTypeExtensions.FromDatabase(v) : null);
            entity.Property(e => e.WorkingDays).HasColumnName("working_days");
            entity.Property(e => e.WorkStartTime).HasColumnName("work_start_time");
            entity.Property(e => e.WorkEndTime).HasColumnName("work_end_time");

            entity.HasIndex(e => e.Phone).IsUnique();
            entity.HasIndex(e => e.Email).IsUnique().HasDatabaseName("idx_employees_email_unique");
            entity.HasOne(e => e.Company)
                .WithMany(c => c.Employees)
                .HasForeignKey(e => e.CompanyId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Project)
                .WithMany(p => p.Employees)
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            // Soft delete query filter
            entity.HasQueryFilter(e => e.DeletedAt == null);
        });

        // EmployeeBudget
        modelBuilder.Entity<EmployeeBudget>(entity =>
        {
            entity.ToTable("employee_budgets");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.EmployeeId).HasColumnName("employee_id");
            entity.Property(e => e.TotalBudget).HasColumnName("total_budget").HasPrecision(10, 2);
            entity.Property(e => e.SpentThisPeriod).HasColumnName("spent_this_period").HasPrecision(10, 2);
            entity.Property(e => e.Period).HasColumnName("period")
                .HasConversion(
                    v => v.ToRussian(),
                    v => BudgetPeriodExtensions.FromRussian(v));
            entity.Property(e => e.DailyLimit).HasColumnName("daily_limit").HasPrecision(10, 2);
            entity.Property(e => e.AutoRenew).HasColumnName("auto_renew");
            entity.Property(e => e.PeriodStartDate).HasColumnName("period_start_date");
            entity.Property(e => e.PeriodEndDate).HasColumnName("period_end_date");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasIndex(e => e.EmployeeId).IsUnique();
            entity.HasOne(e => e.Employee)
                .WithOne(emp => emp.Budget)
                .HasForeignKey<EmployeeBudget>(e => e.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Order
        modelBuilder.Entity<Order>(entity =>
        {
            entity.ToTable("orders");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.ProjectId).HasColumnName("project_id").IsRequired();
            entity.Property(e => e.EmployeeId).HasColumnName("employee_id");
            entity.Property(e => e.GuestName).HasColumnName("guest_name");
            entity.Property(e => e.IsGuestOrder).HasColumnName("is_guest_order");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.ComboType).HasColumnName("combo_type").IsRequired();
            entity.Property(e => e.Price).HasColumnName("price").HasPrecision(10, 2);
            entity.Property(e => e.CurrencyCode).HasColumnName("currency_code").HasMaxLength(3);
            entity.Property(e => e.Status).HasColumnName("status")
                .HasConversion(
                    v => v.ToRussian(),
                    v => OrderStatusExtensions.FromRussian(v));
            entity.Property(e => e.OrderDate).HasColumnName("order_date");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasOne(e => e.Company)
                .WithMany(c => c.Orders)
                .HasForeignKey(e => e.CompanyId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Project)
                .WithMany(p => p.Orders)
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Employee)
                .WithMany(emp => emp.Orders)
                .HasForeignKey(e => e.EmployeeId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(e => e.CreatedByUser)
                .WithMany(u => u.CreatedGuestOrders)
                .HasForeignKey(e => e.CreatedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            // ═══════════════════════════════════════════════════════════════
            // ИНДЕКСЫ для оптимизации запросов заказов
            // ═══════════════════════════════════════════════════════════════
            // Составной индекс для основного запроса заказов (company + project + date)
            entity.HasIndex(e => new { e.CompanyId, e.ProjectId, e.OrderDate })
                .HasDatabaseName("idx_orders_company_project_date");

            // Индекс для фильтрации по статусу
            entity.HasIndex(e => e.Status)
                .HasDatabaseName("idx_orders_status");

            // Индекс для фильтрации по дате (часто используется отдельно)
            entity.HasIndex(e => e.OrderDate)
                .HasDatabaseName("idx_orders_order_date");
        });

        // LunchSubscription
        modelBuilder.Entity<LunchSubscription>(entity =>
        {
            entity.ToTable("lunch_subscriptions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.EmployeeId).HasColumnName("employee_id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.ProjectId).HasColumnName("project_id").IsRequired();
            entity.Property(e => e.ComboType).HasColumnName("combo_type").IsRequired().HasMaxLength(50);
            entity.Property(e => e.IsActive).HasColumnName("is_active");

            // Subscription period & pricing (new fields)
            entity.Property(e => e.StartDate).HasColumnName("start_date");
            entity.Property(e => e.EndDate).HasColumnName("end_date");
            entity.Property(e => e.TotalDays).HasColumnName("total_days").HasDefaultValue(0);
            entity.Property(e => e.TotalPrice).HasColumnName("total_price").HasPrecision(10, 2).HasDefaultValue(0);
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50)
                .HasConversion(
                    v => v.ToRussian(),
                    v => SubscriptionStatusExtensions.FromRussian(v));
            entity.Property(e => e.ScheduleType).HasColumnName("schedule_type").HasMaxLength(50).HasDefaultValue("EVERY_DAY");
            entity.Property(e => e.PausedAt).HasColumnName("paused_at");
            entity.Property(e => e.PausedDaysCount).HasColumnName("paused_days_count").HasDefaultValue(0);

            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasIndex(e => e.EmployeeId).IsUnique();
            entity.HasOne(e => e.Employee)
                .WithOne(emp => emp.LunchSubscription)
                .HasForeignKey<LunchSubscription>(e => e.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Company)
                .WithMany(c => c.LunchSubscriptions)
                .HasForeignKey(e => e.CompanyId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Project)
                .WithMany()
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Invoice
        modelBuilder.Entity<Invoice>(entity =>
        {
            entity.ToTable("invoices");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.ProjectId).HasColumnName("project_id");
            entity.Property(e => e.ExternalId).HasColumnName("external_id").HasMaxLength(100);
            entity.Property(e => e.Amount).HasColumnName("amount").HasPrecision(15, 2);
            entity.Property(e => e.CurrencyCode).HasColumnName("currency_code").HasMaxLength(3);
            entity.Property(e => e.Status).HasColumnName("status")
                .HasConversion(
                    v => v.ToDatabase(),
                    v => InvoiceStatusExtensions.FromDatabase(v));
            entity.Property(e => e.DueDate).HasColumnName("due_date");
            entity.Property(e => e.PaidAt).HasColumnName("paid_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");

            entity.HasIndex(e => e.ExternalId).IsUnique();
            entity.HasOne(e => e.Company)
                .WithMany(c => c.Invoices)
                .HasForeignKey(e => e.CompanyId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Project)
                .WithMany(p => p.Invoices)
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // CompanyTransaction
        modelBuilder.Entity<CompanyTransaction>(entity =>
        {
            entity.ToTable("company_transactions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.ProjectId).HasColumnName("project_id");
            entity.Property(e => e.Type).HasColumnName("type")
                .HasConversion(
                    v => v.ToDatabase(),
                    v => TransactionTypeExtensions.FromDatabase(v));
            entity.Property(e => e.Amount).HasColumnName("amount").HasPrecision(15, 2);
            entity.Property(e => e.InvoiceId).HasColumnName("invoice_id");
            entity.Property(e => e.DailyOrderId).HasColumnName("daily_order_id");
            entity.Property(e => e.ClientAppOrderUuid).HasColumnName("client_app_order_uuid");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");

            entity.HasOne(e => e.Company)
                .WithMany(c => c.Transactions)
                .HasForeignKey(e => e.CompanyId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Project)
                .WithMany(p => p.Transactions)
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(e => e.Invoice)
                .WithMany(i => i.Transactions)
                .HasForeignKey(e => e.InvoiceId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(e => e.DailyOrder)
                .WithMany(o => o.Transactions)
                .HasForeignKey(e => e.DailyOrderId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // CompanyDocument
        modelBuilder.Entity<CompanyDocument>(entity =>
        {
            entity.ToTable("company_documents");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.ProjectId).HasColumnName("project_id");
            entity.Property(e => e.Type).HasColumnName("type")
                .HasConversion(
                    v => v.ToDatabase(),
                    v => DocumentTypeExtensions.FromDatabase(v));
            entity.Property(e => e.FileUrl).HasColumnName("file_url").IsRequired();
            entity.Property(e => e.FileName).HasColumnName("file_name").HasMaxLength(255);
            entity.Property(e => e.PeriodStart).HasColumnName("period_start");
            entity.Property(e => e.PeriodEnd).HasColumnName("period_end");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");

            entity.HasOne(e => e.Company)
                .WithMany(c => c.Documents)
                .HasForeignKey(e => e.CompanyId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Project)
                .WithMany(p => p.Documents)
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // SystemNews
        modelBuilder.Entity<SystemNews>(entity =>
        {
            entity.ToTable("system_news");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Title).HasColumnName("title").IsRequired().HasMaxLength(255);
            entity.Property(e => e.Content).HasColumnName("content").IsRequired();
            entity.Property(e => e.IsPublished).HasColumnName("is_published");
            entity.Property(e => e.PublishedAt).HasColumnName("published_at");
            entity.Property(e => e.TargetRoles).HasColumnName("target_roles");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });

        // NewsReadStatus
        modelBuilder.Entity<NewsReadStatus>(entity =>
        {
            entity.ToTable("news_read_status");
            entity.HasKey(e => new { e.NewsId, e.UserId });
            entity.Property(e => e.NewsId).HasColumnName("news_id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.ReadAt).HasColumnName("read_at");

            entity.HasOne(e => e.News)
                .WithMany(n => n.ReadStatuses)
                .HasForeignKey(e => e.NewsId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.User)
                .WithMany(u => u.NewsReadStatuses)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // RefreshToken
        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("refresh_tokens");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.TokenHash).HasColumnName("token_hash").IsRequired().HasMaxLength(255);
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
            entity.Property(e => e.RevokedAt).HasColumnName("revoked_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.DeviceInfo).HasColumnName("device_info");
            entity.Property(e => e.IpAddress).HasColumnName("ip_address").HasMaxLength(45);

            entity.HasOne(e => e.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // AuditLog
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("audit_logs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.Action).HasColumnName("action").IsRequired().HasMaxLength(100);
            entity.Property(e => e.EntityType).HasColumnName("entity_type").IsRequired().HasMaxLength(100);
            entity.Property(e => e.EntityId).HasColumnName("entity_id");
            entity.Property(e => e.OldValues).HasColumnName("old_values").HasColumnType("jsonb");
            entity.Property(e => e.NewValues).HasColumnName("new_values").HasColumnType("jsonb");
            entity.Property(e => e.IpAddress).HasColumnName("ip_address").HasMaxLength(45);
            entity.Property(e => e.UserAgent).HasColumnName("user_agent");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");

            entity.HasOne(e => e.User)
                .WithMany(u => u.AuditLogs)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // CompensationTransaction
        modelBuilder.Entity<CompensationTransaction>(entity =>
        {
            entity.ToTable("compensation_transactions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ProjectId).HasColumnName("project_id");
            entity.Property(e => e.EmployeeId).HasColumnName("employee_id");
            entity.Property(e => e.TotalAmount).HasColumnName("total_amount").HasPrecision(10, 2);
            entity.Property(e => e.CompanyPaidAmount).HasColumnName("company_paid_amount").HasPrecision(10, 2);
            entity.Property(e => e.EmployeePaidAmount).HasColumnName("employee_paid_amount").HasPrecision(10, 2);
            entity.Property(e => e.RestaurantName).HasColumnName("restaurant_name").HasMaxLength(255);
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.TransactionDate).HasColumnName("transaction_date");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");

            entity.HasOne(e => e.Project)
                .WithMany()
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Employee)
                .WithMany()
                .HasForeignKey(e => e.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);

            // ═══════════════════════════════════════════════════════════════
            // ИНДЕКС для оптимизации запросов компенсаций по дате
            // ═══════════════════════════════════════════════════════════════
            entity.HasIndex(e => new { e.ProjectId, e.TransactionDate })
                .HasDatabaseName("idx_compensation_project_date");
        });

        // EmployeeCompensationBalance
        modelBuilder.Entity<EmployeeCompensationBalance>(entity =>
        {
            entity.ToTable("employee_compensation_balances");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.EmployeeId).HasColumnName("employee_id");
            entity.Property(e => e.ProjectId).HasColumnName("project_id");
            entity.Property(e => e.AccumulatedBalance).HasColumnName("accumulated_balance").HasPrecision(10, 2);
            entity.Property(e => e.LastUpdatedDate).HasColumnName("last_updated_date");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasIndex(e => new { e.EmployeeId, e.ProjectId }).IsUnique();
            entity.HasOne(e => e.Employee)
                .WithMany()
                .HasForeignKey(e => e.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Project)
                .WithMany()
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
