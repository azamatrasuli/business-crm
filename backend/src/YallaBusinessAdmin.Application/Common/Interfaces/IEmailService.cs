namespace YallaBusinessAdmin.Application.Common.Interfaces;

public interface IEmailService
{
    /// <summary>
    /// Send an email
    /// </summary>
    Task<bool> SendEmailAsync(string to, string subject, string htmlBody, string? textBody = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Send welcome email to new admin user
    /// </summary>
    Task<bool> SendWelcomeEmailAsync(string to, string name, string companyName, string loginUrl, CancellationToken cancellationToken = default);

    /// <summary>
    /// Send password reset email
    /// </summary>
    Task<bool> SendPasswordResetEmailAsync(string to, string name, string resetUrl, CancellationToken cancellationToken = default);

    /// <summary>
    /// Send employee invitation email
    /// </summary>
    Task<bool> SendEmployeeInviteEmailAsync(string to, string employeeName, string companyName, string inviteUrl, CancellationToken cancellationToken = default);

    /// <summary>
    /// Send daily order summary email
    /// </summary>
    Task<bool> SendDailySummaryEmailAsync(string to, string companyName, DateTime date, int totalOrders, decimal totalSpent, IEnumerable<TopEmployee> topEmployees, CancellationToken cancellationToken = default);
}

public record TopEmployee(string Name, int Orders, decimal Spent);

