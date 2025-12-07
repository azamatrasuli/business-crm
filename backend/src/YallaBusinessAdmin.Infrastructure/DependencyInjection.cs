using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using YallaBusinessAdmin.Application.Audit;
using YallaBusinessAdmin.Application.Auth;
using YallaBusinessAdmin.Application.Common.Interfaces;
using YallaBusinessAdmin.Application.Compensation;
using YallaBusinessAdmin.Application.Dashboard;
using YallaBusinessAdmin.Application.Documents;
using YallaBusinessAdmin.Application.Employees;
using YallaBusinessAdmin.Application.Export;
using YallaBusinessAdmin.Application.Invoices;
using YallaBusinessAdmin.Application.News;
using YallaBusinessAdmin.Application.Orders;
using YallaBusinessAdmin.Application.Companies;
using YallaBusinessAdmin.Application.Projects;
using YallaBusinessAdmin.Application.Subscriptions;
using YallaBusinessAdmin.Application.Transactions;
using YallaBusinessAdmin.Application.Users;
using YallaBusinessAdmin.Domain.Interfaces;
using YallaBusinessAdmin.Infrastructure.BackgroundJobs;
using YallaBusinessAdmin.Infrastructure.Caching;
using YallaBusinessAdmin.Infrastructure.Persistence;
using YallaBusinessAdmin.Infrastructure.Security;
using YallaBusinessAdmin.Infrastructure.Services;
using YallaBusinessAdmin.Infrastructure.Services.Dashboard;

namespace YallaBusinessAdmin.Infrastructure;

/// <summary>
/// Dependency injection configuration for infrastructure services.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Adds infrastructure services to the service collection.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">The configuration.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // ═══════════════════════════════════════════════════════════════════════════════
        // Database Configuration
        // ═══════════════════════════════════════════════════════════════════════════════
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? configuration["SUPABASE_DB_URL"]
            ?? throw new InvalidOperationException("Database connection string not configured");

        services.AddDbContext<AppDbContext>(options =>
        {
            options.UseNpgsql(connectionString, npgsqlOptions =>
            {
                npgsqlOptions.EnableRetryOnFailure(
                    maxRetryCount: 5,
                    maxRetryDelay: TimeSpan.FromSeconds(30),
                    errorCodesToAdd: null);
            });
        });

        // ═══════════════════════════════════════════════════════════════════════════════
        // Repository Pattern
        // ═══════════════════════════════════════════════════════════════════════════════
        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // ═══════════════════════════════════════════════════════════════════════════════
        // Security Services
        // ═══════════════════════════════════════════════════════════════════════════════
        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        services.AddSingleton<IJwtService, JwtService>();

        // ═══════════════════════════════════════════════════════════════════════════════
        // Caching
        // ═══════════════════════════════════════════════════════════════════════════════
        services.AddMemoryCache();
        services.AddSingleton<ICacheService, MemoryCacheService>();

        // ═══════════════════════════════════════════════════════════════════════════════
        // Idempotency (prevents duplicate operations)
        // ═══════════════════════════════════════════════════════════════════════════════
        services.AddSingleton<IIdempotencyService, IdempotencyService>();

        // ═══════════════════════════════════════════════════════════════════════════════
        // Budget Service (atomic financial operations with concurrency control)
        // ═══════════════════════════════════════════════════════════════════════════════
        services.AddScoped<IBudgetService, BudgetService>();

        // ═══════════════════════════════════════════════════════════════════════════════
        // Audit Service (must be registered before AuthService)
        // ═══════════════════════════════════════════════════════════════════════════════
        services.AddScoped<IAuditService, AuditService>();

        // ═══════════════════════════════════════════════════════════════════════════════
        // Core Services
        // ═══════════════════════════════════════════════════════════════════════════════
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUsersService, UsersService>();

        // ═══════════════════════════════════════════════════════════════════════════════
        // Dashboard Services (Split for Single Responsibility Principle)
        // ═══════════════════════════════════════════════════════════════════════════════
        services.AddScoped<IDashboardMetricsService, DashboardMetricsService>();
        services.AddScoped<IOrderManagementService, OrderManagementService>();
        services.AddScoped<ISubscriptionManagementService, SubscriptionManagementService>();
        services.AddScoped<ICutoffTimeService, CutoffTimeService>();
        services.AddScoped<IDashboardService, DashboardService>(); // Facade

        // ═══════════════════════════════════════════════════════════════════════════════
        // Employee Services (SRP - Single Responsibility Principle)
        // Must be registered BEFORE EmployeesService as it depends on them
        // ═══════════════════════════════════════════════════════════════════════════════
        services.AddScoped<IEmployeeBudgetService, EmployeeBudgetService>();
        services.AddScoped<IEmployeeOrderHistoryService, EmployeeOrderHistoryService>();
        services.AddScoped<IEmployeesService, EmployeesService>();

        // ═══════════════════════════════════════════════════════════════════════════════
        // Business Domain Services
        // ═══════════════════════════════════════════════════════════════════════════════
        services.AddScoped<ICompaniesService, CompaniesService>();
        services.AddScoped<IProjectsService, ProjectsService>();
        services.AddScoped<ISubscriptionsService, SubscriptionsService>();
        services.AddScoped<IOrderFreezeService, OrderFreezeService>();
        services.AddScoped<IInvoicesService, InvoicesService>();
        services.AddScoped<ITransactionsService, TransactionsService>();
        services.AddScoped<INewsService, NewsService>();
        services.AddScoped<IDocumentsService, DocumentsService>();
        services.AddScoped<IExportService, ExportService>();

        // ═══════════════════════════════════════════════════════════════════════════════
        // Compensation Service
        // ═══════════════════════════════════════════════════════════════════════════════
        services.AddScoped<ICompensationService, CompensationService>();

        // ═══════════════════════════════════════════════════════════════════════════════
        // External Services
        // ═══════════════════════════════════════════════════════════════════════════════
        services.AddHttpClient<IStorageService, SupabaseStorageService>();

        // ═══════════════════════════════════════════════════════════════════════════════
        // Background Jobs
        // ═══════════════════════════════════════════════════════════════════════════════
        services.AddHostedService<DailyOrderGenerationJob>();

        return services;
    }
}
