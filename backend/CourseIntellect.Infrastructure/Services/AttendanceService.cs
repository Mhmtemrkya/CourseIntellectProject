using CourseIntellect.Application.DTOs.Attendance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AttendanceService(CourseIntellectDbContext dbContext) : IAttendanceService
{
    public async Task<IReadOnlyList<AttendanceEntryDto>> GetAttendanceAsync(
        string? studentName = null,
        string? className = null,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.Set<AttendanceEntry>().AsQueryable();

        if (!string.IsNullOrWhiteSpace(studentName))
        {
            query = query.Where(x => x.StudentName == studentName.Trim());
        }

        if (!string.IsNullOrWhiteSpace(className))
        {
            query = query.Where(x => x.ClassName == className.Trim());
        }

        return await query
            .OrderByDescending(x => x.LessonDate)
            .ThenBy(x => x.Lesson)
            .Select(x => new AttendanceEntryDto(
                x.Id,
                x.StudentName,
                x.ClassName,
                x.LessonDate,
                x.Status,
                x.Lesson))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AttendanceEntryDto>> SaveLessonAttendanceAsync(
        SaveAttendanceRequest request,
        CancellationToken cancellationToken = default)
    {
        var lessonDate = (request.LessonDate ?? DateTime.Now).Date;

        var existing = await dbContext.Set<AttendanceEntry>()
            .Where(x =>
                x.ClassName == request.ClassName &&
                x.Lesson == request.Lesson &&
                x.LessonDate.Date == lessonDate)
            .ToListAsync(cancellationToken);

        dbContext.Set<AttendanceEntry>().RemoveRange(existing);

        var entries = request.Students
            .Where(x => !string.IsNullOrWhiteSpace(x.Name))
            .Select(x => new AttendanceEntry
            {
                StudentName = x.Name.Trim(),
                ClassName = request.ClassName.Trim(),
                Lesson = request.Lesson.Trim(),
                LessonDate = lessonDate,
                Status = MapStatus(x.Status)
            })
            .ToList();

        await dbContext.Set<AttendanceEntry>().AddRangeAsync(entries, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return entries
            .OrderBy(x => x.StudentName)
            .Select(x => new AttendanceEntryDto(
                x.Id,
                x.StudentName,
                x.ClassName,
                x.LessonDate,
                x.Status,
                x.Lesson))
            .ToList();
    }

    private static string MapStatus(string value) => value.Trim() switch
    {
        "present" => "Katildi",
        "late" => "Gec",
        "excuse" => "Izinli",
        "Katildi" => "Katildi",
        "Gec" => "Gec",
        "Izinli" => "Izinli",
        _ => "Devamsiz",
    };
}
