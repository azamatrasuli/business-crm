using System.ComponentModel.DataAnnotations;

namespace YallaBusinessAdmin.Application.MealSubscriptions.Dtos;

/// <summary>
/// Request to create a new meal subscription for a project
/// </summary>
public record CreateSubscriptionRequest(
    [Required]
    Guid ProjectId,
    
    [Required]
    DateOnly StartDate,
    
    [Required]
    DateOnly EndDate,
    
    /// <summary>List of employee assignments</summary>
    [Required]
    [MinLength(1)]
    List<EmployeeAssignmentRequest> Employees
);

/// <summary>
/// Assignment configuration for a single employee
/// Address is derived from employee's project (one project = one address)
/// </summary>
public record EmployeeAssignmentRequest(
    [Required]
    Guid EmployeeId,
    
    /// <summary>EVERY_DAY, EVERY_OTHER_DAY, or CUSTOM</summary>
    string Pattern = "EVERY_DAY",
    
    /// <summary>List of specific dates (required if Pattern = CUSTOM)</summary>
    List<DateOnly>? CustomDates = null,
    
    /// <summary>Combo type (e.g., "Комбо 25", "Комбо 35")</summary>
    string ComboType = "Комбо 25"
);




