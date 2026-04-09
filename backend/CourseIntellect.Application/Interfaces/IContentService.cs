using CourseIntellect.Application.DTOs.Contents;

namespace CourseIntellect.Application.Interfaces;

public interface IContentService
{
    Task<IReadOnlyList<ContentDto>> GetContentsAsync(bool visibleOnly, CancellationToken cancellationToken = default);
    Task<ContentDto> CreateContentAsync(CreateContentRequest request, CancellationToken cancellationToken = default);
    Task<ContentDto?> UpdateContentAsync(Guid id, CreateContentRequest request, CancellationToken cancellationToken = default);
    Task<ContentDto?> UpdateStatusAsync(Guid id, UpdateContentStatusRequest request, CancellationToken cancellationToken = default);
}
