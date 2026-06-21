using CourseIntellect.Application.DTOs.Timetable;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class TimetableService(CourseIntellectDbContext dbContext) : ITimetableService
{
    public async Task<IReadOnlyList<TimetableSlotResponse>> GetByTeacherAsync(
        Guid? teacherUserId,
        string? teacherName,
        CancellationToken cancellationToken = default)
    {
        var name = (teacherName ?? string.Empty).Trim();
        if (teacherUserId is null && name == string.Empty) return [];

        var slots = await dbContext.TeacherTimetableSlots.AsNoTracking()
            .Where(item => (teacherUserId != null && item.TeacherUserId == teacherUserId)
                || (name != string.Empty && item.TeacherName == name))
            .OrderBy(item => item.DayOfWeek).ThenBy(item => item.StartTime)
            .ToListAsync(cancellationToken);

        return slots.Select(Map).ToList();
    }

    public async Task<IReadOnlyList<TimetableSlotResponse>> SetForTeacherAsync(
        SetTimetableRequest request,
        CancellationToken cancellationToken = default)
    {
        var name = (request.TeacherName ?? string.Empty).Trim();
        if (request.TeacherUserId is null && name == string.Empty)
        {
            throw new InvalidOperationException("Öğretmen bilgisi zorunludur.");
        }

        // Öğretmenin tüm slotlarını sil + yeniden yaz (tam set).
        var existing = await dbContext.TeacherTimetableSlots
            .Where(item => (request.TeacherUserId != null && item.TeacherUserId == request.TeacherUserId)
                || (name != string.Empty && item.TeacherName == name))
            .ToListAsync(cancellationToken);
        if (existing.Count > 0)
        {
            dbContext.TeacherTimetableSlots.RemoveRange(existing);
        }

        var slots = (request.Slots ?? [])
            .Where(s => s.DayOfWeek is >= 1 and <= 7 && !string.IsNullOrWhiteSpace(s.StartTime) && !string.IsNullOrWhiteSpace(s.EndTime))
            .Select(s => new TeacherTimetableSlot
            {
                TeacherUserId = request.TeacherUserId,
                TeacherName = name,
                DayOfWeek = s.DayOfWeek,
                StartTime = s.StartTime.Trim(),
                EndTime = s.EndTime.Trim(),
                ClassName = s.ClassName?.Trim() ?? string.Empty,
                Lesson = s.Lesson?.Trim() ?? string.Empty,
            })
            .ToList();

        if (slots.Count > 0)
        {
            await dbContext.TeacherTimetableSlots.AddRangeAsync(slots, cancellationToken);
        }
        await dbContext.SaveChangesAsync(cancellationToken);

        return slots.OrderBy(s => s.DayOfWeek).ThenBy(s => s.StartTime).Select(Map).ToList();
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var slot = await dbContext.TeacherTimetableSlots.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (slot is null) return false;
        dbContext.TeacherTimetableSlots.Remove(slot);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static TimetableSlotResponse Map(TeacherTimetableSlot slot) => new(
        slot.Id, slot.TeacherUserId, slot.TeacherName, slot.DayOfWeek, slot.StartTime, slot.EndTime, slot.ClassName, slot.Lesson);
}
