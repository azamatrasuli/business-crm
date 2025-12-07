namespace YallaBusinessAdmin.Application.Common.Constants;

/// <summary>
/// Idempotency key generators for critical operations
/// </summary>
public static class IdempotencyKeys
{
    // Order operations
    public static string DailyOrder(Guid employeeId, DateTime date) 
        => $"order:employee:{employeeId}:date:{date:yyyy-MM-dd}";
    
    public static string GuestOrder(Guid companyId, string guestName, DateTime date, string comboType) 
        => $"guest-order:company:{companyId}:name:{guestName}:date:{date:yyyy-MM-dd}:combo:{comboType}";
    
    // Compensation operations
    public static string CompensationTransaction(Guid employeeId, DateTime date, decimal amount, string? restaurantName) 
        => $"compensation:employee:{employeeId}:date:{date:yyyy-MM-dd}:amount:{amount}:restaurant:{restaurantName ?? "none"}";
    
    // Subscription operations
    public static string SubscriptionCreation(Guid employeeId, Guid projectId, string comboType, DateOnly startDate) 
        => $"subscription:employee:{employeeId}:project:{projectId}:combo:{comboType}:start:{startDate}";
    
    // Invoice operations
    public static string InvoicePayment(Guid invoiceId, decimal amount) 
        => $"invoice-payment:invoice:{invoiceId}:amount:{amount}";
    
    // Budget operations
    public static string BudgetTopUp(Guid companyId, decimal amount, DateTime timestamp) 
        => $"budget-topup:company:{companyId}:amount:{amount}:ts:{timestamp:yyyyMMddHHmmss}";
}

