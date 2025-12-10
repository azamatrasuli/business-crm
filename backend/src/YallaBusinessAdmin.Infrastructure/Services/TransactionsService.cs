using Microsoft.EntityFrameworkCore;
using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Transactions;
using YallaBusinessAdmin.Application.Transactions.Dtos;
using YallaBusinessAdmin.Domain.Enums;
using YallaBusinessAdmin.Infrastructure.Persistence;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class TransactionsService : ITransactionsService
{
    private readonly AppDbContext _context;

    public TransactionsService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<TransactionResponse>> GetAllAsync(
        Guid companyId,
        int page,
        int pageSize,
        string? type,
        DateTime? startDate,
        DateTime? endDate,
        Guid? projectId = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.CompanyTransactions
            .Where(t => t.CompanyId == companyId);

        if (projectId.HasValue)
            query = query.Where(t => t.ProjectId == projectId.Value);

        if (!string.IsNullOrWhiteSpace(type))
        {
            var transactionType = TransactionTypeExtensions.FromDatabase(type.ToUpper());
            query = query.Where(t => t.Type == transactionType);
        }

        if (startDate.HasValue)
            query = query.Where(t => t.CreatedAt >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(t => t.CreatedAt <= endDate.Value);

        var total = await query.CountAsync(cancellationToken);
        var transactions = await query
            .OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = transactions.Select(t => new TransactionResponse
        {
            Id = t.Id,
            Type = t.Type.ToDatabase(),
            Amount = t.Amount,
            Description = t.Description,
            InvoiceId = t.InvoiceId,
            DailyOrderId = t.DailyOrderId,
            CreatedAt = t.CreatedAt
        });

        return PagedResult<TransactionResponse>.Create(items, total, page, pageSize);
    }

    public async Task<TransactionResponse> GetByIdAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default)
    {
        var transaction = await _context.CompanyTransactions
            .FirstOrDefaultAsync(t => t.Id == id && t.CompanyId == companyId, cancellationToken)
            ?? throw new KeyNotFoundException("Транзакция не найдена");

        return new TransactionResponse
        {
            Id = transaction.Id,
            Type = transaction.Type.ToDatabase(),
            Amount = transaction.Amount,
            Description = transaction.Description,
            InvoiceId = transaction.InvoiceId,
            DailyOrderId = transaction.DailyOrderId,
            CreatedAt = transaction.CreatedAt
        };
    }

    public async Task<decimal> GetCurrentBalanceAsync(Guid companyId, CancellationToken cancellationToken = default)
    {
        var company = await _context.Companies
            .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken)
            ?? throw new KeyNotFoundException("Компания не найдена");

        return company.Budget;
    }

    public async Task<FinancialSummaryResponse> GetFinancialSummaryAsync(
        Guid companyId,
        Guid? projectId,
        CancellationToken cancellationToken = default)
    {
        decimal balance, overdraftLimit;
        string currencyCode, timezone;

        if (projectId.HasValue)
        {
            var project = await _context.Projects.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == projectId.Value && p.CompanyId == companyId, cancellationToken)
                ?? throw new KeyNotFoundException("Проект не найден");

            balance = project.Budget;
            overdraftLimit = project.OverdraftLimit;
            currencyCode = project.CurrencyCode ?? "TJS";
            timezone = project.Timezone ?? "Asia/Dushanbe";
        }
        else
        {
            var company = await _context.Companies.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken)
                ?? throw new KeyNotFoundException("Компания не найдена");

            balance = company.Budget;
            overdraftLimit = company.OverdraftLimit;
            currencyCode = company.CurrencyCode ?? "TJS";
            timezone = company.Timezone ?? "Asia/Dushanbe";
        }

        // Pending deductions (Active orders)
        var ordersQuery = _context.Orders.AsNoTracking()
            .Where(o => o.CompanyId == companyId && o.Status == OrderStatus.Active);
        if (projectId.HasValue)
            ordersQuery = ordersQuery.Where(o => o.ProjectId == projectId.Value);

        var pendingOrders = await ordersQuery.ToListAsync(cancellationToken);
        var pendingDeduction = pendingOrders.Sum(o => o.Price);
        var pendingOrdersCount = pendingOrders.Count;

        // Pending income (unpaid invoices)
        var invoicesQuery = _context.Invoices.AsNoTracking()
            .Where(i => i.CompanyId == companyId && i.Status != InvoiceStatus.Paid && i.Status != InvoiceStatus.Cancelled);
        if (projectId.HasValue)
            invoicesQuery = invoicesQuery.Where(i => i.ProjectId == projectId.Value);

        var pendingInvoices = await invoicesQuery.ToListAsync(cancellationToken);
        var pendingIncome = pendingInvoices.Sum(i => i.Amount);
        var pendingInvoicesCount = pendingInvoices.Count;

        var available = balance - pendingDeduction;
        var projectedBalance = balance + pendingIncome - pendingDeduction;
        var isLowBalance = available < 0 || (pendingDeduction > 0 && balance < pendingDeduction);

        string? warningMessage = null;
        if (available < 0)
            warningMessage = $"Недостаточно средств! После списания баланс будет {available:N0} {currencyCode}";
        else if (balance < pendingDeduction)
            warningMessage = "Баланс меньше суммы к списанию. Пополните счёт.";

        var tz = TimeZoneInfo.FindSystemTimeZoneById(timezone);
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz));

        return new FinancialSummaryResponse
        {
            Balance = balance,
            CurrencyCode = currencyCode,
            PendingIncome = pendingIncome,
            PendingInvoicesCount = pendingInvoicesCount,
            PendingDeduction = pendingDeduction,
            PendingOrdersCount = pendingOrdersCount,
            Available = available,
            ProjectedBalance = projectedBalance,
            OverdraftLimit = overdraftLimit,
            IsLowBalance = isLowBalance,
            WarningMessage = warningMessage,
            Date = today.ToString("yyyy-MM-dd")
        };
    }

    public async Task<PendingOperationsResponse> GetPendingOperationsAsync(
        Guid companyId,
        Guid? projectId,
        CancellationToken cancellationToken = default)
    {
        var ordersQuery = _context.Orders.AsNoTracking()
            .Include(o => o.Employee)
            .Where(o => o.CompanyId == companyId && o.Status == OrderStatus.Active);
        if (projectId.HasValue)
            ordersQuery = ordersQuery.Where(o => o.ProjectId == projectId.Value);

        var orders = await ordersQuery.OrderBy(o => o.OrderDate).ToListAsync(cancellationToken);

        var pendingOrders = orders.Select(o => new PendingOrderItem
        {
            Id = o.Id,
            Name = o.IsGuestOrder ? (o.GuestName ?? "Гость") : (o.Employee?.FullName ?? "Сотрудник"),
            ComboType = o.ComboType,
            Amount = o.Price,
            CurrencyCode = o.CurrencyCode,
            OrderDate = o.OrderDate,
            SettlementDate = DateOnly.FromDateTime(o.OrderDate).ToDateTime(new TimeOnly(23, 59, 59)),
            IsGuestOrder = o.IsGuestOrder
        }).ToList();

        var invoicesQuery = _context.Invoices.AsNoTracking()
            .Where(i => i.CompanyId == companyId && i.Status != InvoiceStatus.Paid && i.Status != InvoiceStatus.Cancelled);
        if (projectId.HasValue)
            invoicesQuery = invoicesQuery.Where(i => i.ProjectId == projectId.Value);

        var invoices = await invoicesQuery.OrderBy(i => i.DueDate).ToListAsync(cancellationToken);

        var pendingInvoices = invoices.Select(i => new PendingInvoiceItem
        {
            Id = i.Id,
            ExternalId = i.ExternalId,
            Amount = i.Amount,
            CurrencyCode = i.CurrencyCode,
            Status = i.Status.ToString(),
            DueDate = i.DueDate,
            CreatedAt = i.CreatedAt
        }).ToList();

        return new PendingOperationsResponse
        {
            PendingOrders = pendingOrders,
            PendingInvoices = pendingInvoices
        };
    }

    public async Task<FinancialOperationsPagedResponse> GetFinancialOperationsAsync(
        Guid companyId,
        Guid? projectId,
        int page,
        int pageSize,
        OperationStatusFilter statusFilter = OperationStatusFilter.All,
        OperationTypeFilter typeFilter = OperationTypeFilter.All,
        OperationSortField sortField = OperationSortField.Date,
        bool sortDescending = true,
        CancellationToken cancellationToken = default)
    {
        string currencyCode = "TJS";

        if (projectId.HasValue)
        {
            var project = await _context.Projects.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == projectId.Value && p.CompanyId == companyId, cancellationToken);
            if (project != null)
                currencyCode = project.CurrencyCode ?? "TJS";
        }

        var operations = new List<FinancialOperationResponse>();

        // 1. COMPLETED TRANSACTIONS
        if (statusFilter == OperationStatusFilter.All || statusFilter == OperationStatusFilter.Completed)
        {
            var txQuery = _context.CompanyTransactions.AsNoTracking()
                .Where(t => t.CompanyId == companyId);

            if (projectId.HasValue)
                txQuery = txQuery.Where(t => t.ProjectId == projectId.Value);

            if (typeFilter == OperationTypeFilter.Deposits)
                txQuery = txQuery.Where(t => t.Type == TransactionType.Deposit);
            else if (typeFilter == OperationTypeFilter.Deductions)
                txQuery = txQuery.Where(t => t.Type == TransactionType.LunchDeduction || t.Type == TransactionType.GuestOrder || t.Type == TransactionType.ClientAppOrder);
            else if (typeFilter == OperationTypeFilter.Refunds)
                txQuery = txQuery.Where(t => t.Type == TransactionType.Refund);

            var transactions = await txQuery.ToListAsync(cancellationToken);

            foreach (var t in transactions)
            {
                var isIncome = t.Type == TransactionType.Deposit || t.Type == TransactionType.Refund;
                operations.Add(new FinancialOperationResponse
                {
                    Id = t.Id,
                    Type = t.Type.ToDatabase(),
                    Status = "COMPLETED",
                    Amount = t.Amount,
                    CurrencyCode = currencyCode,
                    Description = BuildDescription(t.Type, t.Description),
                    Details = t.Description,
                    CreatedAt = t.CreatedAt,
                    ExecutionDate = t.CreatedAt, // Выполнено = дата реализации
                    IsIncome = isIncome,
                    ItemsCount = 1
                });
            }
        }

        // 2. PENDING DEDUCTIONS (Active orders)
        if ((statusFilter == OperationStatusFilter.All || statusFilter == OperationStatusFilter.PendingDeduction) &&
            typeFilter != OperationTypeFilter.Deposits && typeFilter != OperationTypeFilter.Refunds)
        {
            var ordersQuery = _context.Orders.AsNoTracking()
                .Include(o => o.Employee)
                .Where(o => o.CompanyId == companyId && o.Status == OrderStatus.Active);

            if (projectId.HasValue)
                ordersQuery = ordersQuery.Where(o => o.ProjectId == projectId.Value);

            var orders = await ordersQuery.ToListAsync(cancellationToken);
            var ordersByDate = orders.GroupBy(o => DateOnly.FromDateTime(o.OrderDate));

            foreach (var grp in ordersByDate)
            {
                var orderDate = grp.Key;
                var executionDate = orderDate.ToDateTime(new TimeOnly(23, 59, 59));
                var total = grp.Sum(o => o.Price);
                var empOrders = grp.Where(o => !o.IsGuestOrder).ToList();
                var guestOrders = grp.Where(o => o.IsGuestOrder).ToList();

                var names = empOrders.Take(3).Select(o => o.Employee?.FullName ?? "Сотрудник")
                    .Concat(guestOrders.Take(2).Select(o => o.GuestName ?? "Гость")).ToList();
                var remaining = grp.Count() - names.Count;
                var details = string.Join(", ", names) + (remaining > 0 ? $" +{remaining}" : "");

                var descParts = new List<string>();
                if (empOrders.Count > 0) descParts.Add($"{empOrders.Count} сотр.");
                if (guestOrders.Count > 0) descParts.Add($"{guestOrders.Count} гост.");

                operations.Add(new FinancialOperationResponse
                {
                    Id = grp.First().Id,
                    Type = "LUNCH_DEDUCTION",
                    Status = "PENDING_DEDUCTION",
                    Amount = -total,
                    CurrencyCode = currencyCode,
                    Description = string.Join(", ", descParts),
                    Details = details,
                    CreatedAt = executionDate, // Дата реализации = OrderDate
                    ExecutionDate = executionDate,
                    IsIncome = false,
                    ItemsCount = grp.Count()
                });
            }
        }

        // 3. PENDING INCOME (Unpaid invoices)
        if ((statusFilter == OperationStatusFilter.All || statusFilter == OperationStatusFilter.PendingIncome) &&
            typeFilter != OperationTypeFilter.Deductions && typeFilter != OperationTypeFilter.Refunds)
        {
            var invQuery = _context.Invoices.AsNoTracking()
                .Where(i => i.CompanyId == companyId && i.Status != InvoiceStatus.Paid && i.Status != InvoiceStatus.Cancelled);

            if (projectId.HasValue)
                invQuery = invQuery.Where(i => i.ProjectId == projectId.Value);

            var invoices = await invQuery.ToListAsync(cancellationToken);

            foreach (var inv in invoices)
            {
                var statusLabel = inv.Status == InvoiceStatus.Overdue ? "Просрочен" : "Ожидает";
                var execDate = inv.DueDate ?? inv.CreatedAt;

                operations.Add(new FinancialOperationResponse
                {
                    Id = inv.Id,
                    Type = "DEPOSIT",
                    Status = "PENDING_INCOME",
                    Amount = inv.Amount,
                    CurrencyCode = currencyCode,
                    Description = inv.ExternalId != null ? $"Счёт #{inv.ExternalId}" : "Счёт",
                    Details = statusLabel,
                    CreatedAt = execDate, // Дата реализации = DueDate
                    ExecutionDate = execDate,
                    IsIncome = true,
                    ItemsCount = 1
                });
            }
        }

        // SORTING by ExecutionDate (дата реализации)
        var sorted = sortField switch
        {
            OperationSortField.Amount => sortDescending 
                ? operations.OrderByDescending(o => Math.Abs(o.Amount))
                : operations.OrderBy(o => Math.Abs(o.Amount)),
            OperationSortField.Type => sortDescending
                ? operations.OrderByDescending(o => o.Type)
                : operations.OrderBy(o => o.Type),
            OperationSortField.Status => sortDescending
                ? operations.OrderByDescending(o => o.Status)
                : operations.OrderBy(o => o.Status),
            _ => sortDescending
                ? operations.OrderByDescending(o => o.ExecutionDate)
                : operations.OrderBy(o => o.ExecutionDate)
        };

        var total_count = operations.Count;
        var paged = sorted.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return new FinancialOperationsPagedResponse
        {
            Items = paged,
            Total = total_count,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(total_count / (double)pageSize)
        };
    }

    private static string BuildDescription(TransactionType type, string? details)
    {
        return type switch
        {
            TransactionType.LunchDeduction => details ?? "Обеды",
            TransactionType.GuestOrder => details ?? "Гость",
            TransactionType.Deposit => details ?? "Пополнение",
            TransactionType.Refund => details ?? "Возврат",
            TransactionType.ClientAppOrder => details ?? "Заказ",
            _ => details ?? "Операция"
        };
    }
}
