using CourseIntellect.Application.DTOs.Attendance;
using CourseIntellect.Application.DTOs.Students;

namespace CourseIntellect.Application.Interfaces;

public interface IAttendanceService
{
    Task<IReadOnlyList<AttendanceEntryDto>> GetAttendanceAsync(
        string? studentName = null,
        string? className = null,
        Guid? studentId = null,
        StudentRecordScope? scope = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AttendanceEntryDto>> SaveLessonAttendanceAsync(
        SaveAttendanceRequest request,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
