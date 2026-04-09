using CourseIntellect.Application.DTOs.ContactMessages;

namespace CourseIntellect.Application.Interfaces;

public interface IContactMessageService
{
    Task<IReadOnlyList<ContactMessageDto>> GetAllAsync(string? search, string? status, bool? starred, CancellationToken cancellationToken = default);
    Task<ContactMessageDetailDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ContactMessageDto> CreateAsync(CreateContactMessageRequest request, string ipAddress, CancellationToken cancellationToken = default);
    Task<ContactMessageDto?> UpdateStatusAsync(Guid id, UpdateContactMessageStatusRequest request, CancellationToken cancellationToken = default);
    Task<ContactMessageDetailDto?> MarkAsReadAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ContactMessageDetailDto?> ToggleStarAsync(Guid id, bool isStarred, CancellationToken cancellationToken = default);
    Task<ContactMessageDetailDto?> MarkAsRepliedAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ContactMessageDetailDto?> ArchiveAsync(Guid id, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
