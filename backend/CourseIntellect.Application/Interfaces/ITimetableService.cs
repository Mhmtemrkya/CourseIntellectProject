using CourseIntellect.Application.DTOs.Timetable;

namespace CourseIntellect.Application.Interfaces;

public interface ITimetableService
{
    Task<IReadOnlyList<TimetableSlotResponse>> GetByTeacherAsync(Guid? teacherUserId, string? teacherName, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TimetableSlotResponse>> SetForTeacherAsync(SetTimetableRequest request, CancellationToken cancellationToken = default);

    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
