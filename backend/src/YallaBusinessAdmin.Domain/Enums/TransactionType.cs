namespace YallaBusinessAdmin.Domain.Enums;

/// <summary>
/// Type of a company transaction.
/// Maps to Postgres enum: transaction_type
/// </summary>
public enum TransactionType
{
    /// <summary>DEPOSIT - Money added to company balance</summary>
    Deposit,
    /// <summary>LUNCH_DEDUCTION - Regular lunch order deduction</summary>
    LunchDeduction,
    /// <summary>GUEST_ORDER - Guest order deduction</summary>
    GuestOrder,
    /// <summary>CLIENT_APP_ORDER - Order from Client App</summary>
    ClientAppOrder,
    /// <summary>REFUND - Refund to company balance</summary>
    Refund
}

public static class TransactionTypeExtensions
{
    public static string ToDatabase(this TransactionType type) => type switch
    {
        TransactionType.Deposit => "DEPOSIT",
        TransactionType.LunchDeduction => "LUNCH_DEDUCTION",
        TransactionType.GuestOrder => "GUEST_ORDER",
        TransactionType.ClientAppOrder => "CLIENT_APP_ORDER",
        TransactionType.Refund => "REFUND",
        _ => throw new ArgumentOutOfRangeException(nameof(type))
    };

    public static TransactionType FromDatabase(string value) => value switch
    {
        "DEPOSIT" => TransactionType.Deposit,
        "LUNCH_DEDUCTION" => TransactionType.LunchDeduction,
        "GUEST_ORDER" => TransactionType.GuestOrder,
        "CLIENT_APP_ORDER" => TransactionType.ClientAppOrder,
        "REFUND" => TransactionType.Refund,
        _ => throw new ArgumentOutOfRangeException(nameof(value))
    };
}

