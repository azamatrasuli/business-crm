namespace YallaBusinessAdmin.Domain.Enums;

/// <summary>
/// Status of an invoice.
/// Maps to Postgres enum: invoice_status
/// </summary>
public enum InvoiceStatus
{
    /// <summary>UNPAID - Invoice is awaiting payment</summary>
    Unpaid,
    /// <summary>PAID - Invoice has been paid</summary>
    Paid,
    /// <summary>CANCELLED - Invoice was cancelled</summary>
    Cancelled,
    /// <summary>OVERDUE - Invoice is past due date</summary>
    Overdue
}

public static class InvoiceStatusExtensions
{
    public static string ToDatabase(this InvoiceStatus status) => status switch
    {
        InvoiceStatus.Unpaid => "UNPAID",
        InvoiceStatus.Paid => "PAID",
        InvoiceStatus.Cancelled => "CANCELLED",
        InvoiceStatus.Overdue => "OVERDUE",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };

    public static InvoiceStatus FromDatabase(string value) => value switch
    {
        "UNPAID" => InvoiceStatus.Unpaid,
        "PAID" => InvoiceStatus.Paid,
        "CANCELLED" => InvoiceStatus.Cancelled,
        "OVERDUE" => InvoiceStatus.Overdue,
        _ => throw new ArgumentOutOfRangeException(nameof(value))
    };
}

