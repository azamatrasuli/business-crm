using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using YallaBusinessAdmin.Application.Common.Interfaces;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;
    private readonly string _smtpHost;
    private readonly int _smtpPort;
    private readonly string _smtpUser;
    private readonly string _smtpPassword;
    private readonly string _fromEmail;
    private readonly string _fromName;
    private readonly bool _enableSsl;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;

        _smtpHost = configuration["Email:SmtpHost"] ?? "smtp.gmail.com";
        _smtpPort = int.Parse(configuration["Email:SmtpPort"] ?? "587");
        _smtpUser = configuration["Email:SmtpUser"] ?? "";
        _smtpPassword = configuration["Email:SmtpPassword"] ?? "";
        _fromEmail = configuration["Email:FromEmail"] ?? "noreply@yallabusiness.com";
        _fromName = configuration["Email:FromName"] ?? "Yalla Business";
        _enableSsl = bool.Parse(configuration["Email:EnableSsl"] ?? "true");
    }

    public async Task<bool> SendEmailAsync(string to, string subject, string htmlBody, string? textBody = null, CancellationToken cancellationToken = default)
    {
        try
        {
            // Check if email is configured
            if (string.IsNullOrEmpty(_smtpUser) || string.IsNullOrEmpty(_smtpPassword))
            {
                _logger.LogWarning("Email not configured, skipping send to {To}", to);
                return false;
            }

            using var client = new SmtpClient(_smtpHost, _smtpPort)
            {
                Credentials = new NetworkCredential(_smtpUser, _smtpPassword),
                EnableSsl = _enableSsl
            };

            var message = new MailMessage
            {
                From = new MailAddress(_fromEmail, _fromName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true
            };
            message.To.Add(to);

            if (!string.IsNullOrEmpty(textBody))
            {
                var altView = AlternateView.CreateAlternateViewFromString(textBody, null, "text/plain");
                message.AlternateViews.Add(altView);
            }

            await client.SendMailAsync(message, cancellationToken);
            _logger.LogInformation("Email sent successfully to {To}", to);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {To}", to);
            return false;
        }
    }

    public async Task<bool> SendWelcomeEmailAsync(string to, string name, string companyName, string loginUrl, CancellationToken cancellationToken = default)
    {
        var subject = $"Добро пожаловать в {companyName} - Yalla Business";
        var htmlBody = $@"
        <div style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"">
          <div style=""text-align: center; margin-bottom: 30px;"">
            <h1 style=""color: #4F46E5; margin: 0;"">Yalla Business</h1>
          </div>
          
          <h2 style=""color: #333;"">Добро пожаловать, {name}!</h2>
          
          <p>Вы были добавлены в качестве администратора компании <strong>{companyName}</strong> в системе Yalla Business.</p>
          
          <p>Теперь вы можете:</p>
          <ul>
            <li>Управлять сотрудниками компании</li>
            <li>Отслеживать заказы и расходы</li>
            <li>Настраивать бюджеты и лимиты</li>
            <li>Просматривать аналитику</li>
          </ul>
          
          <div style=""text-align: center; margin: 30px 0;"">
            <a href=""{loginUrl}"" style=""display: inline-block; background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;"">Войти в систему</a>
          </div>
          
          <p style=""color: #666; font-size: 14px;"">Если у вас есть вопросы, свяжитесь с нашей службой поддержки.</p>
          
          <hr style=""border: none; border-top: 1px solid #eee; margin: 30px 0;"">
          
          <p style=""color: #999; font-size: 12px; text-align: center;"">
            © {DateTime.Now.Year} Yalla Business. Все права защищены.
          </p>
        </div>";

        return await SendEmailAsync(to, subject, htmlBody, null, cancellationToken);
    }

    public async Task<bool> SendPasswordResetEmailAsync(string to, string name, string resetUrl, CancellationToken cancellationToken = default)
    {
        var subject = "Сброс пароля - Yalla Business";
        var htmlBody = $@"
        <div style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"">
          <div style=""text-align: center; margin-bottom: 30px;"">
            <h1 style=""color: #4F46E5; margin: 0;"">Yalla Business</h1>
          </div>
          
          <h2 style=""color: #333;"">Сброс пароля</h2>
          
          <p>Здравствуйте, {name}!</p>
          
          <p>Мы получили запрос на сброс пароля для вашей учетной записи. Нажмите на кнопку ниже, чтобы установить новый пароль:</p>
          
          <div style=""text-align: center; margin: 30px 0;"">
            <a href=""{resetUrl}"" style=""display: inline-block; background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;"">Сбросить пароль</a>
          </div>
          
          <p style=""color: #666; font-size: 14px;"">Ссылка действительна в течение 1 часа.</p>
          
          <p style=""color: #666; font-size: 14px;"">Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>
          
          <hr style=""border: none; border-top: 1px solid #eee; margin: 30px 0;"">
          
          <p style=""color: #999; font-size: 12px; text-align: center;"">
            © {DateTime.Now.Year} Yalla Business. Все права защищены.
          </p>
        </div>";

        return await SendEmailAsync(to, subject, htmlBody, null, cancellationToken);
    }

    public async Task<bool> SendEmployeeInviteEmailAsync(string to, string employeeName, string companyName, string inviteUrl, CancellationToken cancellationToken = default)
    {
        var subject = $"Приглашение в {companyName} - Yalla Business";
        var htmlBody = $@"
        <div style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"">
          <div style=""text-align: center; margin-bottom: 30px;"">
            <h1 style=""color: #4F46E5; margin: 0;"">Yalla Business</h1>
          </div>
          
          <h2 style=""color: #333;"">Приглашение</h2>
          
          <p>Здравствуйте, {employeeName}!</p>
          
          <p>Вы были приглашены в компанию <strong>{companyName}</strong> для использования системы корпоративного питания Yalla Business.</p>
          
          <p>После регистрации вы сможете:</p>
          <ul>
            <li>Заказывать обеды из доступного меню</li>
            <li>Отслеживать свой бюджет</li>
            <li>Просматривать историю заказов</li>
          </ul>
          
          <div style=""text-align: center; margin: 30px 0;"">
            <a href=""{inviteUrl}"" style=""display: inline-block; background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;"">Принять приглашение</a>
          </div>
          
          <p style=""color: #666; font-size: 14px;"">Ссылка действительна в течение 7 дней.</p>
          
          <hr style=""border: none; border-top: 1px solid #eee; margin: 30px 0;"">
          
          <p style=""color: #999; font-size: 12px; text-align: center;"">
            © {DateTime.Now.Year} Yalla Business. Все права защищены.
          </p>
        </div>";

        return await SendEmailAsync(to, subject, htmlBody, null, cancellationToken);
    }

    public async Task<bool> SendDailySummaryEmailAsync(string to, string companyName, DateTime date, int totalOrders, decimal totalSpent, IEnumerable<TopEmployee> topEmployees, CancellationToken cancellationToken = default)
    {
        var employeeRows = string.Join("", topEmployees.Select(emp => $@"
            <tr>
              <td style=""padding: 8px; border-bottom: 1px solid #eee;"">{emp.Name}</td>
              <td style=""padding: 8px; border-bottom: 1px solid #eee; text-align: center;"">{emp.Orders}</td>
              <td style=""padding: 8px; border-bottom: 1px solid #eee; text-align: right;"">{emp.Spent:F2} TJS</td>
            </tr>"));

        var employeesTable = topEmployees.Any() ? $@"
            <h3 style=""color: #333; margin-top: 30px;"">Топ сотрудников</h3>
            <table style=""width: 100%; border-collapse: collapse;"">
              <thead>
                <tr style=""background: #f5f5f5;"">
                  <th style=""padding: 10px; text-align: left;"">Сотрудник</th>
                  <th style=""padding: 10px; text-align: center;"">Заказы</th>
                  <th style=""padding: 10px; text-align: right;"">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {employeeRows}
              </tbody>
            </table>" : "";

        var subject = $"Ежедневный отчет - {companyName} - {date:dd.MM.yyyy}";
        var htmlBody = $@"
        <div style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"">
          <div style=""text-align: center; margin-bottom: 30px;"">
            <h1 style=""color: #4F46E5; margin: 0;"">Yalla Business</h1>
          </div>
          
          <h2 style=""color: #333;"">Ежедневный отчет</h2>
          <p style=""color: #666;"">{companyName} • {date:dd.MM.yyyy}</p>
          
          <div style=""display: flex; gap: 20px; margin: 30px 0;"">
            <div style=""flex: 1; background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center;"">
              <div style=""font-size: 32px; font-weight: bold; color: #4F46E5;"">{totalOrders}</div>
              <div style=""color: #666; margin-top: 5px;"">Заказов</div>
            </div>
            <div style=""flex: 1; background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center;"">
              <div style=""font-size: 32px; font-weight: bold; color: #4F46E5;"">{totalSpent:F2}</div>
              <div style=""color: #666; margin-top: 5px;"">TJS потрачено</div>
            </div>
          </div>
          
          {employeesTable}
          
          <hr style=""border: none; border-top: 1px solid #eee; margin: 30px 0;"">
          
          <p style=""color: #999; font-size: 12px; text-align: center;"">
            © {DateTime.Now.Year} Yalla Business. Все права защищены.
          </p>
        </div>";

        return await SendEmailAsync(to, subject, htmlBody, null, cancellationToken);
    }
}

