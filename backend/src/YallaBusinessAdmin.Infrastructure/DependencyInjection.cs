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
using YallaBusinessAdmin.Application.MealSubscriptions;
using YallaBusinessAdmin.Application.News;
using YallaBusinessAdmin.Application.Projects;
using YallaBusinessAdmin.Application.Subscriptions;
using YallaBusinessAdmin.Application.Transactions;
using YallaBusinessAdmin.Application.Users;
using YallaBusinessAdmin.Domain.Interfaces;
using YallaBusinessAdmin.Infrastructure.BackgroundJobs;
using YallaBusinessAdmin.Infrastructure.Persistence;
using YallaBusinessAdmin.Infrastructure.Security;
using YallaBusinessAdmin.Infrastructure.Services;

namespace YallaBusinessAdmin.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // Database
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

        // Repositories
        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Security
        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        services.AddSingleton<IJwtService, JwtService>();

        // Audit Service (must be registered before AuthService)
        services.AddScoped<IAuditService, AuditService>();

        // Core Services
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUsersService, UsersService>();
        services.AddScoped<IEmployeesService, EmployeesService>();
        services.AddScoped<IDashboardService, DashboardService>();

        // New Services
        services.AddScoped<IProjectsService, ProjectsService>();
        services.AddScoped<IMealSubscriptionsService, MealSubscriptionsService>();
        services.AddScoped<ISubscriptionsService, SubscriptionsService>();
        services.AddScoped<IInvoicesService, InvoicesService>();
        services.AddScoped<ITransactionsService, TransactionsService>();
        services.AddScoped<INewsService, NewsService>();
        services.AddScoped<IDocumentsService, DocumentsService>();
        services.AddScoped<IExportService, ExportService>();
        
        // Compensation Service
        services.AddScoped<ICompensationService, CompensationService>();

        // Supabase Storage Service
        services.AddHttpClient<IStorageService, SupabaseStorageService>();
        
        // Background Jobs
        services.AddHostedService<DailyOrderGenerationJob>();
        services.AddHostedService<SubscriptionAutoRenewalJob>();

        return services;
    }
}
