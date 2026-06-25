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

        // 1) Öğretmenin kendi içinde aynı gün saat çakışması olamaz.
        for (var i = 0; i < slots.Count; i++)
        {
            for (var j = i + 1; j < slots.Count; j++)
            {
                if (slots[i].DayOfWeek == slots[j].DayOfWeek && Overlaps(slots[i], slots[j]))
                {
                    throw new InvalidOperationException(
                        $"{DayName(slots[i].DayOfWeek)} günü {slots[i].StartTime}-{slots[i].EndTime} ile {slots[j].StartTime}-{slots[j].EndTime} dersleri çakışıyor. Öğretmen aynı saatte birden fazla derse giremez.");
                }
            }
        }

        // 2) Aynı sınıf, aynı gün/saatte başka bir öğretmene atanamaz.
        var classNames = slots.Select(s => s.ClassName).Where(c => !string.IsNullOrWhiteSpace(c)).Distinct().ToList();
        if (classNames.Count > 0)
        {
            var otherSlots = await dbContext.TeacherTimetableSlots.AsNoTracking()
                .Where(item => classNames.Contains(item.ClassName)
                    && !((request.TeacherUserId != null && item.TeacherUserId == request.TeacherUserId)
                        || (name != string.Empty && item.TeacherName == name)))
                .ToListAsync(cancellationToken);

            foreach (var slot in slots)
            {
                if (string.IsNullOrWhiteSpace(slot.ClassName)) continue;
                var clash = otherSlots.FirstOrDefault(other =>
                    other.ClassName == slot.ClassName && other.DayOfWeek == slot.DayOfWeek && Overlaps(slot, other));
                if (clash is not null)
                {
                    throw new InvalidOperationException(
                        $"{slot.ClassName} sınıfı {DayName(slot.DayOfWeek)} günü {slot.StartTime}-{slot.EndTime} saatinde {clash.TeacherName} öğretmenine atanmış. Aynı sınıfa aynı saatte iki öğretmen atanamaz.");
                }
            }
        }

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

    private static bool Overlaps(TeacherTimetableSlot a, TeacherTimetableSlot b)
    {
        var startA = ToMinutes(a.StartTime);
        var endA = ToMinutes(a.EndTime);
        var startB = ToMinutes(b.StartTime);
        var endB = ToMinutes(b.EndTime);
        if (startA is null || endA is null || startB is null || endB is null) return false;
        return startA < endB && startB < endA;
    }

    private static int? ToMinutes(string? time)
    {
        if (string.IsNullOrWhiteSpace(time)) return null;
        var parts = time.Trim().Split(':');
        if (parts.Length < 2) return null;
        if (int.TryParse(parts[0], out var hh) && int.TryParse(parts[1], out var mm))
        {
            return hh * 60 + mm;
        }
        return null;
    }

    private static string DayName(int dayOfWeek) => dayOfWeek switch
    {
        1 => "Pazartesi",
        2 => "Salı",
        3 => "Çarşamba",
        4 => "Perşembe",
        5 => "Cuma",
        6 => "Cumartesi",
        7 => "Pazar",
        _ => $"Gün {dayOfWeek}",
    };
}
