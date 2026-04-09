using CourseIntellect.Application.DTOs.Meetings;

namespace CourseIntellect.Application.Interfaces;

public interface IMeetingRequestService
{
    Task<IReadOnlyList<MeetingRequestDto>> GetRequestsAsync(string? advisor, string? parentName, CancellationToken cancellationToken = default);
    Task<MeetingRequestDto> CreateRequestAsync(CreateMeetingRequestRequest request, CancellationToken cancellationToken = default);
    Task<MeetingRequestDto?> UpdateStatusAsync(Guid id, UpdateMeetingRequestStatusRequest request, CancellationToken cancellationToken = default);
}
