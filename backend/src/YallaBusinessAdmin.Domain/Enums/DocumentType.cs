namespace YallaBusinessAdmin.Domain.Enums;

/// <summary>
/// Type of a company document.
/// Maps to Postgres enum: document_type
/// </summary>
public enum DocumentType
{
    /// <summary>ACT_OF_RECONCILIATION - Reconciliation act document</summary>
    ActOfReconciliation,
    /// <summary>INVOICE_PDF - Invoice PDF document</summary>
    InvoicePdf,
    /// <summary>CONTRACT - Contract document</summary>
    Contract
}

public static class DocumentTypeExtensions
{
    public static string ToDatabase(this DocumentType type) => type switch
    {
        DocumentType.ActOfReconciliation => "ACT_OF_RECONCILIATION",
        DocumentType.InvoicePdf => "INVOICE_PDF",
        DocumentType.Contract => "CONTRACT",
        _ => throw new ArgumentOutOfRangeException(nameof(type))
    };

    public static DocumentType FromDatabase(string value) => value switch
    {
        "ACT_OF_RECONCILIATION" => DocumentType.ActOfReconciliation,
        "INVOICE_PDF" => DocumentType.InvoicePdf,
        "CONTRACT" => DocumentType.Contract,
        _ => throw new ArgumentOutOfRangeException(nameof(value))
    };
}

