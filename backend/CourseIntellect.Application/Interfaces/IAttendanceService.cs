using CourseIntellect.Application.DTOs.Attendance;

namespace CourseIntellect.Application.Interfaces;

public interface IAttendanceService
{
    Task<IReadOnlyList<AttendanceEntryDto>> GetAttendanceAsync(
        string? studentName = null,
        string? className = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AttendanceEntryDto>> SaveLessonAttendanceAsync(
        SaveAttendanceRequest request,
        CancellationToken cancellationToken = default);
}
