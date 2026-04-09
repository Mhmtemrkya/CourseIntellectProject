namespace CourseIntellect.Application.DTOs.Meetings;

public sealed record CreateMeetingRequestRequest(
    string ParentName,
    string StudentName,
    string Advisor,
    string Topic,
    string Slot,
    bool OnlineMeeting,
    string Note
);
