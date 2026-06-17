using CourseIntellect.Application.DTOs.Admin;

namespace CourseIntellect.Application.Interfaces;

public interface IAdminDocumentService
{
    Task<AdminDocumentDto> CreateAsync(
        CreateDocumentRequest request,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AdminDocumentDto>> GetAsync(
        string? category,
        string? direction,
        string? status,
        CancellationToken cancellationToken = default);

    Task<AdminDocumentDto?> ArchiveAsync(
        Guid id,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default);
}
