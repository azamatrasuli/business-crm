using YallaBusinessAdmin.Domain.Enums;

namespace YallaBusinessAdmin.Domain.StateMachines;

/// <summary>
/// State machine for order status transitions
/// Ensures valid state transitions for daily meal orders
/// </summary>
public static class OrderStateMachine
{
    private static readonly Dictionary<OrderStatus, HashSet<OrderStatus>> AllowedTransitions = new()
    {
        // Active -> Paused, Completed, Cancelled
        [OrderStatus.Active] = new() { OrderStatus.Paused, OrderStatus.Completed, OrderStatus.Cancelled },
        
        // Paused -> Active, Cancelled (can resume or cancel)
        [OrderStatus.Paused] = new() { OrderStatus.Active, OrderStatus.Cancelled },
        
        // Completed -> None (terminal state - order was delivered)
        [OrderStatus.Completed] = new(),
        
        // Cancelled -> None (terminal state - order was cancelled)
        [OrderStatus.Cancelled] = new()
    };

    /// <summary>
    /// Check if transition from current to target status is allowed
    /// </summary>
    public static bool CanTransition(OrderStatus current, OrderStatus target)
    {
        return AllowedTransitions.TryGetValue(current, out var allowed) && allowed.Contains(target);
    }

    /// <summary>
    /// Transition to new status with validation
    /// </summary>
    /// <exception cref="InvalidOperationException">When transition is not allowed</exception>
    public static OrderStatus Transition(OrderStatus current, OrderStatus target)
    {
        if (!CanTransition(current, target))
        {
            throw new InvalidOperationException(
                $"Невозможно перевести заказ из статуса '{current.ToRussian()}' в '{target.ToRussian()}'. " +
                GetAllowedTransitionsMessage(current));
        }
        
        return target;
    }

    /// <summary>
    /// Get available transitions from current status
    /// </summary>
    public static IReadOnlySet<OrderStatus> GetAllowedTransitions(OrderStatus current)
    {
        return AllowedTransitions.TryGetValue(current, out var allowed) 
            ? allowed 
            : new HashSet<OrderStatus>();
    }

    /// <summary>
    /// Check if status is terminal (no further transitions possible)
    /// </summary>
    public static bool IsTerminal(OrderStatus status)
    {
        return status == OrderStatus.Cancelled || status == OrderStatus.Completed;
    }

    /// <summary>
    /// Check if order can be modified (not in terminal state)
    /// </summary>
    public static bool CanModify(OrderStatus status)
    {
        return !IsTerminal(status);
    }

    private static string GetAllowedTransitionsMessage(OrderStatus current)
    {
        var allowed = GetAllowedTransitions(current);
        if (allowed.Count == 0)
        {
            return "Это конечный статус, дальнейшие переходы невозможны.";
        }
        
        var allowedNames = allowed.Select(s => s.ToRussian());
        return $"Доступные переходы: {string.Join(", ", allowedNames)}";
    }
}

