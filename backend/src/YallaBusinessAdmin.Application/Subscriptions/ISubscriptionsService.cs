using YallaBusinessAdmin.Application.Common.Models;
using YallaBusinessAdmin.Application.Subscriptions.Dtos;

namespace YallaBusinessAdmin.Application.Subscriptions;

public interface ISubscriptionsService
{
    Task<PagedResult<SubscriptionResponse>> GetAllAsync(
        Guid companyId,
        int page,
        int pageSize,
        string? search,
        bool? isActive,
        CancellationToken cancellationToken = default);
    
    Task<SubscriptionResponse> GetByIdAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default);
    
    Task<SubscriptionResponse> GetByEmployeeIdAsync(Guid employeeId, Guid companyId, CancellationToken cancellationToken = default);
    
    Task<SubscriptionResponse> CreateAsync(CreateSubscriptionRequest request, Guid companyId, CancellationToken cancellationToken = default);
    
    Task<SubscriptionResponse> UpdateAsync(Guid id, UpdateSubscriptionDetailsRequest request, Guid companyId, CancellationToken cancellationToken = default);
    
    Task DeleteAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default);
    
    Task<object> BulkCreateAsync(BulkCreateSubscriptionRequest request, Guid companyId, CancellationToken cancellationToken = default);
    
    Task<object> BulkUpdateAsync(BulkUpdateSubscriptionRequest request, Guid companyId, CancellationToken cancellationToken = default);
    
    // Pause/Resume functionality
    Task<SubscriptionResponse> PauseAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default);
    
    Task<SubscriptionResponse> ResumeAsync(Guid id, Guid companyId, CancellationToken cancellationToken = default);
    
    Task<object> BulkPauseAsync(IEnumerable<Guid> subscriptionIds, Guid companyId, CancellationToken cancellationToken = default);
    
    Task<object> BulkResumeAsync(IEnumerable<Guid> subscriptionIds, Guid companyId, CancellationToken cancellationToken = default);
    
    // Price preview
    Task<PricePreviewResponse> GetPricePreviewAsync(Guid id, string newComboType, Guid companyId, CancellationToken cancellationToken = default);
}

