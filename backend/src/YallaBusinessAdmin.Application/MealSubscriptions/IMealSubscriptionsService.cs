using YallaBusinessAdmin.Application.MealSubscriptions.Dtos;

namespace YallaBusinessAdmin.Application.MealSubscriptions;

public interface IMealSubscriptionsService
{
    // Subscription management
    Task<IEnumerable<SubscriptionResponse>> GetAllAsync(Guid projectId);
    Task<SubscriptionResponse?> GetByIdAsync(Guid id);
    Task<SubscriptionResponse> CreateAsync(CreateSubscriptionRequest request, Guid? userId);
    Task<bool> CancelAsync(Guid id);
    Task<bool> PauseAsync(Guid id);
    Task<bool> ResumeAsync(Guid id);
    
    // Assignment management
    Task<IEnumerable<MealAssignmentResponse>> GetAssignmentsAsync(Guid subscriptionId, DateOnly? fromDate = null, DateOnly? toDate = null);
    Task<IEnumerable<MealAssignmentResponse>> GetEmployeeAssignmentsAsync(Guid employeeId, DateOnly? fromDate = null, DateOnly? toDate = null);
    Task<IEnumerable<MealAssignmentResponse>> GetProjectAssignmentsAsync(Guid projectId, DateOnly? fromDate = null, DateOnly? toDate = null);
    Task<MealAssignmentResponse?> UpdateAssignmentAsync(Guid assignmentId, string? comboType = null);
    Task<bool> CancelAssignmentAsync(Guid assignmentId);
    
    // Freeze management
    Task<FreezeInfoResponse> GetFreezeInfoAsync(Guid employeeId);
    Task<MealAssignmentResponse?> FreezeAssignmentAsync(Guid assignmentId, string? reason = null);
    Task<MealAssignmentResponse?> UnfreezeAssignmentAsync(Guid assignmentId);
    
    // Calendar view
    Task<IEnumerable<CalendarDayResponse>> GetCalendarAsync(Guid projectId, DateOnly startDate, DateOnly endDate);
    
    // Price preview
    Task<decimal> CalculateTotalPriceAsync(CreateSubscriptionRequest request);
}


