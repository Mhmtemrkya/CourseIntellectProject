namespace CourseIntellect.Application.DTOs.Meetings;

public sealed record MeetingRequestDto(
    Guid Id,
    string ParentName,
    string StudentName,
    string Advisor,
    string Topic,
    string Slot,
    bool OnlineMeeting,
    string Note,
    string Status
);
