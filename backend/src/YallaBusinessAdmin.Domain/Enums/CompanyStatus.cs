namespace YallaBusinessAdmin.Domain.Enums;

/// <summary>
/// Status of a company.
/// Maps to Postgres enum: company_status
/// </summary>
public enum CompanyStatus
{
    /// <summary>ACTIVE - Company is active and can operate</summary>
    Active,
    /// <summary>BLOCKED_DEBT - Company is blocked due to debt</summary>
    BlockedDebt,
    /// <summary>ARCHIVED - Company is archived/soft deleted</summary>
    Archived
}

public static class CompanyStatusExtensions
{
    public static string ToDatabase(this CompanyStatus status) => status switch
    {
        CompanyStatus.Active => "ACTIVE",
        CompanyStatus.BlockedDebt => "BLOCKED_DEBT",
        CompanyStatus.Archived => "ARCHIVED",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };

    public static CompanyStatus FromDatabase(string value) => value switch
    {
        "ACTIVE" => CompanyStatus.Active,
        "BLOCKED_DEBT" => CompanyStatus.BlockedDebt,
        "ARCHIVED" => CompanyStatus.Archived,
        _ => throw new ArgumentOutOfRangeException(nameof(value))
    };
}

