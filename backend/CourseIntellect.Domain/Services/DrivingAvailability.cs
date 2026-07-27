using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Services;

/// <summary>Bir randevu kuralının ihlali. Ezilebilirse hangi izinle ezilebileceğini söyler.</summary>
public sealed record AvailabilityViolation(string Code, string Message, string? OverridableWith);

/// <summary>Kural değerlendirmesi için gereken sadeleştirilmiş atama görünümü.</summary>
public readonly record struct AssignmentWindow(
    Guid VehicleId,
    VehicleAssignmentType Type,
    DateTime? StartsOnUtc,
    DateTime? EndsOnUtc,
    int DaysOfWeekMask,
    int Priority,
    bool IsActive);

public readonly record struct WorkingWindow(DayOfWeek DayOfWeek, int StartMinute, int EndMinute);

public readonly record struct LeaveWindow(DateTime StartsAtUtc, DateTime EndsAtUtc);

/// <summary>Aynı gün içindeki komşu randevu (hazırlık süresi ve günlük limit için).</summary>
public readonly record struct BookedSlot(DateTime StartsAtUtc, DateTime EndsAtUtc);

/// <summary>
/// Randevu uygunluk kurallarının saf hesabı. Veritabanına dokunmaz; tüm kurallar
/// burada tek yerde yaşar ve testlenir. Kurum saatleri YEREL (UTC+3) yorumlanır —
/// öğretmen "09:00-18:00 çalışıyorum" derken yerel saati kastediyor.
/// </summary>
public static class DrivingAvailability
{
    /// <summary>Proje genelinde kullanılan Türkiye saat farkı.</summary>
    public const int LocalUtcOffsetHours = 3;

    public static DateTime ToLocal(DateTime utc) => utc.AddHours(LocalUtcOffsetHours);

    public static class Codes
    {
        public const string InstructorOnLeave = "instructor_on_leave";
        public const string OutsideWorkingHours = "outside_working_hours";
        public const string VehicleNotAssigned = "vehicle_not_assigned";
        public const string InstructorDailyLimit = "instructor_daily_limit";
        public const string VehicleDailyLimit = "vehicle_daily_limit";
        public const string StudentDailyLimit = "student_daily_limit";
        public const string StudentDailyMinutes = "student_daily_minutes";
        public const string OutsideAllowedHours = "outside_allowed_hours";
        public const string InstructorPermitExpired = "instructor_permit_expired";
        public const string VehicleTooOld = "vehicle_too_old";
        public const string PreparationGap = "preparation_gap";
        public const string FinancialHold = "financial_hold";
    }

    /// <summary>
    /// Usta öğreticinin çalışma izin belgesi ders tarihinde geçerli mi?
    /// Tarih hiç girilmemişse kısıt yoktur (kurum henüz işlememiştir).
    /// </summary>
    public static bool IsWorkingPermitValid(DateTime? permitExpiresAtUtc, DateTime lessonStartsAtUtc)
        => permitExpiresAtUtc is not { } expires || expires > lessonStartsAtUtc;

    /// <summary>
    /// Öğretmen profilindeki çalışma izni alanları kendi içinde tutarlı mı?
    /// Eski/henüz belge takibi açılmamış kayıtlarda iki alan da boşsa profil
    /// çalışmaya devam eder. Alanlardan biri girildiyse ikisi de zorunludur ve
    /// bitiş tarihi değerlendirme anından ileri olmalıdır.
    /// </summary>
    public static bool IsWorkingPermitConfigurationReady(
        string? permitNo,
        DateTime? permitExpiresAtUtc,
        DateTime atUtc)
    {
        var hasNumber = !string.IsNullOrWhiteSpace(permitNo);
        var hasExpiry = permitExpiresAtUtc.HasValue;
        if (!hasNumber && !hasExpiry) return true;
        return hasNumber && hasExpiry && permitExpiresAtUtc > atUtc;
    }

    /// <summary>
    /// Araç, MTSK yaş sınırını aşıyor mu? Sınır 0 = kapalı; model yılı
    /// girilmemişse (0) kural uygulanmaz. Yaş = ders yılı − model yılı.
    /// </summary>
    public static bool ExceedsVehicleAge(int modelYear, int maxAgeYears, DateTime lessonStartsAtUtc)
        => maxAgeYears > 0 && modelYear > 0 && ToLocal(lessonStartsAtUtc).Year - modelYear > maxAgeYears;

    /// <summary>
    /// Ders, kurumun izin verdiği yerel saat penceresine sığıyor mu? MTSK mevzuatı
    /// direksiyon eğitimini gün ışığına bağlar (gece dersi yasağı). Earliest >= Latest
    /// ise kısıt yoktur (kurum bilerek kapatmıştır). Gece yarısını aşan ders sığmaz.
    /// </summary>
    public static bool IsWithinAllowedHours(DateTime startsAtUtc, DateTime endsAtUtc, int earliestHour, int latestHour)
    {
        if (earliestHour >= latestHour) return true;

        var startLocal = ToLocal(startsAtUtc);
        var endLocal = ToLocal(endsAtUtc);
        if (startLocal.Date != endLocal.Date) return false;

        var startMinute = (int)startLocal.TimeOfDay.TotalMinutes;
        var endMinute = (int)endLocal.TimeOfDay.TotalMinutes;
        return startMinute >= earliestHour * 60 && endMinute <= latestHour * 60;
    }

    /// <summary>Öğretmen o aralıkta izinli mi?</summary>
    public static bool IsOnLeave(IEnumerable<LeaveWindow> leaves, DateTime startsAtUtc, DateTime endsAtUtc)
        => leaves.Any(x => x.StartsAtUtc < endsAtUtc && x.EndsAtUtc > startsAtUtc);

    /// <summary>
    /// Randevu, öğretmenin o güne ait çalışma penceresine TAMAMEN sığıyor mu?
    /// Hiç çalışma saati tanımlanmamışsa kısıt yoktur (kurum henüz girmemiştir).
    /// </summary>
    public static bool IsWithinWorkingHours(IReadOnlyCollection<WorkingWindow> hours, DateTime startsAtUtc, DateTime endsAtUtc)
    {
        if (hours.Count == 0) return true;

        var startLocal = ToLocal(startsAtUtc);
        var endLocal = ToLocal(endsAtUtc);

        // Gece yarısını aşan randevu hiçbir günlük pencereye sığmaz.
        if (startLocal.Date != endLocal.Date) return false;

        var dayWindows = hours.Where(x => x.DayOfWeek == startLocal.DayOfWeek).ToList();
        if (dayWindows.Count == 0) return false; // o gün çalışmıyor

        var startMinute = (int)startLocal.TimeOfDay.TotalMinutes;
        var endMinute = (int)endLocal.TimeOfDay.TotalMinutes;
        return dayWindows.Any(x => startMinute >= x.StartMinute && endMinute <= x.EndMinute);
    }

    /// <summary>
    /// Öğretmenin bu aracı o tarihte kullanma yetkisi var mı? Hiç atama
    /// tanımlanmamışsa kısıt yoktur; bir kez atama girildiyse artık zorunludur.
    /// </summary>
    public static bool IsVehicleAssigned(
        IReadOnlyCollection<AssignmentWindow> assignments,
        Guid vehicleId,
        DateTime startsAtUtc)
    {
        if (assignments.Count == 0) return true;

        var local = ToLocal(startsAtUtc);
        return assignments.Any(x =>
            x.IsActive
            && x.VehicleId == vehicleId
            && (x.StartsOnUtc is null || x.StartsOnUtc <= startsAtUtc)
            && (x.EndsOnUtc is null || x.EndsOnUtc >= startsAtUtc)
            && MatchesDay(x, local.DayOfWeek));
    }

    private static bool MatchesDay(AssignmentWindow assignment, DayOfWeek day)
    {
        if (assignment.Type != VehicleAssignmentType.SpecificDays) return true;
        if (assignment.DaysOfWeekMask == 0) return true;
        return (assignment.DaysOfWeekMask & (1 << (int)day)) != 0;
    }

    /// <summary>Aynı yerel gündeki toplam dakika, limiti aşıyor mu? (limit 0 = sınırsız)</summary>
    public static bool ExceedsDailyMinutes(
        IEnumerable<BookedSlot> sameDaySlots,
        int newLessonMinutes,
        int dailyLimitMinutes)
    {
        if (dailyLimitMinutes <= 0) return false;
        var existing = sameDaySlots.Sum(x => (int)(x.EndsAtUtc - x.StartsAtUtc).TotalMinutes);
        return existing + newLessonMinutes > dailyLimitMinutes;
    }

    /// <summary>Öğrencinin aynı gün alabileceği ders sayısı aşıldı mı? (limit 0 = sınırsız)</summary>
    public static bool ExceedsDailyLessonCount(int sameDayLessonCount, int dailyLimit)
        => dailyLimit > 0 && sameDayLessonCount + 1 > dailyLimit;

    /// <summary>
    /// İki ders arasında hazırlık/yol payı var mı? Aynı öğretmenin ya da aracın
    /// bir önceki dersi bitmeden yenisi başlayamaz — arada en az bu kadar boşluk olmalı.
    /// </summary>
    public static bool HasEnoughPreparationGap(
        IEnumerable<BookedSlot> neighbours,
        DateTime startsAtUtc,
        DateTime endsAtUtc,
        int preparationMinutes)
    {
        if (preparationMinutes <= 0) return true;
        var gap = TimeSpan.FromMinutes(preparationMinutes);

        return neighbours.All(x =>
            // Yeni randevu, komşunun bitişinden en az "gap" kadar sonra başlıyor
            startsAtUtc >= x.EndsAtUtc + gap
            // ya da komşunun başlangıcından en az "gap" kadar önce bitiyor.
            || endsAtUtc + gap <= x.StartsAtUtc);
    }

    /// <summary>Borç eşiği aşıldıysa randevu kapanır (kurum ayarı açıksa).</summary>
    public static bool IsFinanciallyBlocked(bool holdEnabled, decimal overdueAmount, decimal threshold)
        => holdEnabled && threshold > 0 && overdueAmount >= threshold;
}
