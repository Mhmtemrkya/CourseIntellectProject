using CourseIntellect.Application.DTOs.PlatformOperations;

namespace CourseIntellect.Application.Interfaces;

public interface IPlatformOperationsService
{
    Task<PlatformOverviewDto> GetOverviewAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TenantWorkspaceDto>> GetTenantsAsync(CancellationToken cancellationToken = default);
    Task<TenantWorkspaceDto> UpsertTenantAsync(Guid? id, UpsertTenantWorkspaceRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SupportTicketDto>> GetSupportTicketsAsync(CancellationToken cancellationToken = default);
    Task<SupportTicketDto> CreateSupportTicketAsync(CreateSupportTicketRequest request, CancellationToken cancellationToken = default);
    Task<SupportTicketDto?> UpdateSupportTicketAsync(Guid id, UpdateSupportTicketRequest request, CancellationToken cancellationToken = default);
}
