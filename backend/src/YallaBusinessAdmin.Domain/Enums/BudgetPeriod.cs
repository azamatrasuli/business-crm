namespace YallaBusinessAdmin.Domain.Enums;

/// <summary>
/// Budget period for employee budgets.
/// Maps to Postgres enum: budget_period
/// </summary>
public enum BudgetPeriod
{
    /// <summary>в День - Daily</summary>
    Daily,
    /// <summary>в Неделю - Weekly</summary>
    Weekly,
    /// <summary>в Месяц - Monthly</summary>
    Monthly
}

public static class BudgetPeriodExtensions
{
    public static string ToRussian(this BudgetPeriod period) => period switch
    {
        BudgetPeriod.Daily => "в День",
        BudgetPeriod.Weekly => "в Неделю",
        BudgetPeriod.Monthly => "в Месяц",
        _ => throw new ArgumentOutOfRangeException(nameof(period))
    };

    public static BudgetPeriod FromRussian(string value) => value switch
    {
        "в День" => BudgetPeriod.Daily,
        "в Неделю" => BudgetPeriod.Weekly,
        "в Месяц" => BudgetPeriod.Monthly,
        _ => throw new ArgumentOutOfRangeException(nameof(value))
    };
}

