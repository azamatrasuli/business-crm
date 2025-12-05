using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Export;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class ExportService : IExportService
{
    private readonly AppDbContext _context;

    public ExportService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<byte[]> ExportEmployeesToCsvAsync(Guid companyId, CancellationToken cancellationToken = default)
    {
        var employees = await _context.Employees
            .Include(e => e.Budget)
            .Where(e => e.CompanyId == companyId && e.DeletedAt == null)
            .OrderBy(e => e.FullName)
            .ToListAsync(cancellationToken);

        var sb = new StringBuilder();
        
        // CSV Header (with BOM for Excel UTF-8 support)
        sb.Append('\uFEFF');
        sb.AppendLine("ФИО;Телефон;Email;Должность;Статус;Приглашение;Общий бюджет;Дневной лимит;Период;Автопродление;Дата создания");

        foreach (var employee in employees)
        {
            var status = employee.IsActive ? "Активный" : "Не активный";
            var inviteStatus = employee.InviteStatus switch
            {
                EmployeeInviteStatus.Accepted => "Принято",
                EmployeeInviteStatus.Pending => "Ожидает",
                EmployeeInviteStatus.Rejected => "Отклонено",
                _ => "Неизвестно"
            };
            var autoRenew = employee.Budget?.AutoRenew == true ? "Да" : "Нет";
            var period = employee.Budget?.Period switch
            {
                BudgetPeriod.Daily => "День",
                BudgetPeriod.Weekly => "Неделя",
                BudgetPeriod.Monthly => "Месяц",
                _ => ""
            };
            
            sb.AppendLine(string.Join(";",
                EscapeCsvField(employee.FullName),
                EscapeCsvField(employee.Phone),
                EscapeCsvField(employee.Email ?? ""),
                EscapeCsvField(employee.Position ?? ""),
                status,
                inviteStatus,
                employee.Budget?.TotalBudget.ToString("F2", CultureInfo.InvariantCulture) ?? "0.00",
                employee.Budget?.DailyLimit.ToString("F2", CultureInfo.InvariantCulture) ?? "0.00",
                period,
                autoRenew,
                employee.CreatedAt.ToString("yyyy-MM-dd HH:mm")
            ));
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public async Task<byte[]> ExportOrdersToCsvAsync(
        Guid companyId,
        string? statusFilter,
        string? dateFilter,
        CancellationToken cancellationToken = default)
    {
        // Address is now derived from Project (one project = one address)
        var query = _context.Orders
            .Include(o => o.Employee)
            .Include(o => o.Project)
            .Where(o => o.CompanyId == companyId);

        if (!string.IsNullOrWhiteSpace(statusFilter))
        {
            var status = OrderStatusExtensions.FromRussian(statusFilter);
            query = query.Where(o => o.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(dateFilter) && DateTime.TryParse(dateFilter, out var filterDate))
        {
            query = query.Where(o => o.OrderDate.Date == filterDate.Date);
        }

        var orders = await query
            .OrderByDescending(o => o.OrderDate)
            .ToListAsync(cancellationToken);

        var sb = new StringBuilder();
        
        // CSV Header (with BOM for Excel UTF-8 support)
        sb.Append('\uFEFF');
        sb.AppendLine("Дата;Тип;ФИО;Телефон;Комбо;Цена;Адрес;Статус;Дата создания");

        foreach (var order in orders)
        {
            var type = order.IsGuestOrder ? "Гостевой" : "Сотрудник";
            var name = order.Employee?.FullName ?? order.GuestName ?? "Гость";
            var phone = order.Employee?.Phone ?? "";
            var status = order.Status.ToRussian();
            
            sb.AppendLine(string.Join(";",
                order.OrderDate.ToString("yyyy-MM-dd"),
                type,
                EscapeCsvField(name),
                EscapeCsvField(phone),
                EscapeCsvField(order.ComboType),
                order.Price.ToString("F2", CultureInfo.InvariantCulture),
                EscapeCsvField(order.Project?.AddressFullAddress ?? ""),
                status,
                order.CreatedAt.ToString("yyyy-MM-dd HH:mm")
            ));
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    private static string EscapeCsvField(string field)
    {
        if (string.IsNullOrEmpty(field))
            return "";

        // If field contains separator, quotes, or newlines, wrap in quotes
        if (field.Contains(';') || field.Contains('"') || field.Contains('\n') || field.Contains('\r'))
        {
            return $"\"{field.Replace("\"", "\"\"")}\"";
        }

        return field;
    }
}

