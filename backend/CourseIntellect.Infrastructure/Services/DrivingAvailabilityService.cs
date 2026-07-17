using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Permissions;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <inheritdoc cref="IDrivingAvailabilityService"/>
public sealed class DrivingAvailabilityService(CourseIntellectDbContext dbContext) : IDrivingAvailabilityService
{
    public async Task<IReadOnlyList<AvailabilityViolation>> CheckAsync(
        AppointmentCandidate candidate,
        CancellationToken cancellationToken = default)
    {
        var settings = await dbContext.DrivingSchoolSettings.AsNoTracking().SingleOrDefaultAsync(cancellationToken)
            ?? new DrivingSchoolSettings();

        var violations = new List<AvailabilityViolation>();
        var lessonMinutes = (int)(candidate.EndsAtUtc - candidate.StartsAtUtc).TotalMinutes;

        // ─── Öğretmen izinli mi? ──────────────────────────────────────────────
        var leaves = await dbContext.DrivingInstructorLeaves.AsNoTracking()
            .Where(x => x.InstructorProfileId == candidate.InstructorProfileId
                && x.StartsAtUtc < candidate.EndsAtUtc && x.EndsAtUtc > candidate.StartsAtUtc)
            .Select(x => new LeaveWindow(x.StartsAtUtc, x.EndsAtUtc))
            .ToListAsync(cancellationToken);

        if (DrivingAvailability.IsOnLeave(leaves, candidate.StartsAtUtc, candidate.EndsAtUtc))
        {
            violations.Add(new AvailabilityViolation(
                DrivingAvailability.Codes.InstructorOnLeave,
                "Öğretmen bu tarihte izinli.",
                DrivingPermissions.OverrideAppointmentRule));
        }

        // ─── Çalışma gün ve saatleri ──────────────────────────────────────────
        var workingHours = await dbContext.DrivingInstructorWorkingHours.AsNoTracking()
            .Where(x => x.InstructorProfileId == candidate.InstructorProfileId)
            .Select(x => new WorkingWindow(x.DayOfWeek, x.StartMinute, x.EndMinute))
            .ToListAsync(cancellationToken);

        if (!DrivingAvailability.IsWithinWorkingHours(workingHours, candidate.StartsAtUtc, candidate.EndsAtUtc))
        {
            violations.Add(new AvailabilityViolation(
                DrivingAvailability.Codes.OutsideWorkingHours,
                "Randevu, öğretmenin çalışma gün/saatleri dışında.",
                DrivingPermissions.OverrideAppointmentRule));
        }

        // ─── Öğretmen-araç ataması ────────────────────────────────────────────
        var assignments = await dbContext.DrivingInstructorVehicleAssignments.AsNoTracking()
            .Where(x => x.InstructorProfileId == candidate.InstructorProfileId)
            .Select(x => new AssignmentWindow(x.VehicleId, x.AssignmentType, x.StartsOnUtc, x.EndsOnUtc, x.DaysOfWeekMask, x.Priority, x.IsActive))
            .ToListAsync(cancellationToken);

        if (!DrivingAvailability.IsVehicleAssigned(assignments, candidate.VehicleId, candidate.StartsAtUtc))
        {
            violations.Add(new AvailabilityViolation(
                DrivingAvailability.Codes.VehicleNotAssigned,
                "Bu araç, öğretmene atanmamış.",
                DrivingPermissions.OverrideAppointmentRule));
        }

        // ─── Günlük limitler ve hazırlık payı ─────────────────────────────────
        var (instructorSlots, vehicleSlots, studentSlots) = await LoadSameDaySlotsAsync(candidate, cancellationToken);

        if (DrivingAvailability.ExceedsDailyMinutes(instructorSlots, lessonMinutes, settings.MaxInstructorDailyMinutes))
        {
            violations.Add(new AvailabilityViolation(
                DrivingAvailability.Codes.InstructorDailyLimit,
                $"Öğretmenin günlük {settings.MaxInstructorDailyMinutes} dakikalık çalışma limiti aşılıyor.",
                DrivingPermissions.OverrideAppointmentRule));
        }

        if (DrivingAvailability.ExceedsDailyMinutes(vehicleSlots, lessonMinutes, settings.MaxVehicleDailyMinutes))
        {
            violations.Add(new AvailabilityViolation(
                DrivingAvailability.Codes.VehicleDailyLimit,
                $"Aracın günlük {settings.MaxVehicleDailyMinutes} dakikalık kullanım limiti aşılıyor.",
                DrivingPermissions.OverrideAppointmentRule));
        }

        if (DrivingAvailability.ExceedsDailyLessonCount(studentSlots.Count, settings.MaxStudentDailyLessons))
        {
            violations.Add(new AvailabilityViolation(
                DrivingAvailability.Codes.StudentDailyLimit,
                $"Öğrenci aynı gün en fazla {settings.MaxStudentDailyLessons} ders alabilir.",
                DrivingPermissions.OverrideAppointmentRule));
        }

        // MTSK mevzuatı: adaya günde en fazla 2 ders saati (120 dk) direksiyon eğitimi.
        if (DrivingAvailability.ExceedsDailyMinutes(studentSlots, lessonMinutes, settings.MaxStudentDailyMinutes))
        {
            violations.Add(new AvailabilityViolation(
                DrivingAvailability.Codes.StudentDailyMinutes,
                $"Mevzuat sınırı: öğrenci aynı gün en fazla {settings.MaxStudentDailyMinutes} dakika direksiyon eğitimi alabilir.",
                DrivingPermissions.OverrideAppointmentRule));
        }

        // Gece dersi yasağı: ders kurumun izin verdiği saat penceresine sığmalı.
        if (!DrivingAvailability.IsWithinAllowedHours(candidate.StartsAtUtc, candidate.EndsAtUtc, settings.LessonEarliestHour, settings.LessonLatestHour))
        {
            violations.Add(new AvailabilityViolation(
                DrivingAvailability.Codes.OutsideAllowedHours,
                $"Direksiyon dersi {settings.LessonEarliestHour:00}:00-{settings.LessonLatestHour:00}:00 saatleri arasında olmalıdır (gece dersi yasağı).",
                DrivingPermissions.OverrideAppointmentRule));
        }

        // Hazırlık payı öğretmen ve araç için ayrı ayrı aranır: aynı öğretmenin
        // arka arkaya iki dersi arasında yol/dinlenme süresi olmalı.
        var neighbours = instructorSlots.Concat(vehicleSlots).ToList();
        if (!DrivingAvailability.HasEnoughPreparationGap(neighbours, candidate.StartsAtUtc, candidate.EndsAtUtc, settings.PreparationMinutes))
        {
            violations.Add(new AvailabilityViolation(
                DrivingAvailability.Codes.PreparationGap,
                $"İki ders arasında en az {settings.PreparationMinutes} dakika hazırlık süresi olmalı.",
                DrivingPermissions.OverrideAppointmentRule));
        }

        // ─── Finansal bloke ───────────────────────────────────────────────────
        if (settings.FinancialHoldEnabled)
        {
            var overdue = await OverdueAmountAsync(candidate.StudentDrivingProfileId, cancellationToken);
            if (DrivingAvailability.IsFinanciallyBlocked(true, overdue, settings.FinancialHoldThreshold))
            {
                violations.Add(new AvailabilityViolation(
                    DrivingAvailability.Codes.FinancialHold,
                    $"Öğrencinin gecikmiş borcu ({overdue:N2} ₺) randevu eşiğini aşıyor.",
                    DrivingPermissions.OverrideFinancialHold));
            }
        }

        return violations;
    }

    public async Task<IReadOnlyList<AvailableInstructor>> SuggestInstructorsAsync(
        Guid studentDrivingProfileId,
        DateTime startsAtUtc,
        DateTime endsAtUtc,
        CancellationToken cancellationToken = default)
    {
        var student = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == studentDrivingProfileId, cancellationToken);
        if (student is null) return [];

        // Öğrenciden kaynaklanan engeller (günlük ders limiti, finansal bloke) varsa
        // hiçbir öğretmen işe yaramaz — "uygun öğretmen var" deyip sonra araç
        // listesini boş göstermek kullanıcıyı yanıltırdı.
        if (await IsStudentBlockedAsync(student.Id, startsAtUtc, endsAtUtc, cancellationToken)) return [];

        // Önce ucuz filtre: sınıf ve vites yetkinliği tutan aktif öğretmenler.
        var candidates = await dbContext.DrivingInstructorProfiles.AsNoTracking()
            .Where(x => x.IsActive)
            .Where(x => student.TransmissionType == TransmissionType.Manual ? x.CanTeachManual : x.CanTeachAutomatic)
            .Join(dbContext.Staff.AsNoTracking(), x => x.StaffId, x => x.Id, (profile, staff) => new { profile.Id, profile.LicenseClasses, staff.FullName })
            .ToListAsync(cancellationToken);

        var results = new List<AvailableInstructor>();
        foreach (var candidate in candidates)
        {
            var classes = candidate.LicenseClasses.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (!classes.Contains(student.LicenseClass, StringComparer.OrdinalIgnoreCase)) continue;

            // Aracı henüz seçilmediği için araç bağımlı kuralları atlıyoruz:
            // öğretmenin izni, çalışma saati ve günlük limiti yeterli ayıklamayı yapar.
            var violations = await CheckInstructorOnlyAsync(candidate.Id, startsAtUtc, endsAtUtc, cancellationToken);
            if (violations.Count > 0) continue;

            // Öğrencinin tercih ettiği öğretmen listenin başında görünür.
            var priority = student.PreferredInstructorProfileId == candidate.Id ? 0 : 50;
            results.Add(new AvailableInstructor(candidate.Id, candidate.FullName, priority));
        }

        return results.OrderBy(x => x.Priority).ThenBy(x => x.FullName, StringComparer.CurrentCulture).ToList();
    }

    public async Task<IReadOnlyList<AvailableVehicle>> SuggestVehiclesAsync(
        Guid studentDrivingProfileId,
        Guid instructorProfileId,
        DateTime startsAtUtc,
        DateTime endsAtUtc,
        CancellationToken cancellationToken = default)
    {
        var student = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == studentDrivingProfileId, cancellationToken);
        if (student is null) return [];

        var assignments = await dbContext.DrivingInstructorVehicleAssignments.AsNoTracking()
            .Where(x => x.InstructorProfileId == instructorProfileId && x.IsActive)
            .ToListAsync(cancellationToken);

        // Uygunsuz araç baştan elenir: bakımdaki veya evrakı geçersiz araç önerilmez.
        var vehicles = await dbContext.DrivingVehicles.AsNoTracking()
            .Where(x => x.IsActive && !x.IsInMaintenance)
            .Where(x => x.TransmissionType == student.TransmissionType && x.LicenseClass == student.LicenseClass)
            .Where(x => x.InspectionExpiresAtUtc > endsAtUtc && x.InsuranceExpiresAtUtc > endsAtUtc)
            .ToListAsync(cancellationToken);

        var results = new List<AvailableVehicle>();
        foreach (var vehicle in vehicles)
        {
            var violations = await CheckAsync(
                new AppointmentCandidate(studentDrivingProfileId, instructorProfileId, vehicle.Id, startsAtUtc, endsAtUtc),
                cancellationToken);
            if (violations.Count > 0) continue;

            var assignment = assignments
                .Where(x => x.VehicleId == vehicle.Id)
                .OrderBy(x => x.Priority)
                .FirstOrDefault();

            var priority = student.PreferredVehicleId == vehicle.Id
                ? 0
                : assignment?.Priority ?? 100;

            results.Add(new AvailableVehicle(
                vehicle.Id,
                vehicle.PlateNumber,
                assignment?.AssignmentType.ToString() ?? "Unassigned",
                priority));
        }

        return results.OrderBy(x => x.Priority).ThenBy(x => x.PlateNumber, StringComparer.Ordinal).ToList();
    }

    /// <summary>Öğrencinin kendisinden kaynaklanan engeller (öğretmen/araç seçiminden bağımsız).</summary>
    private async Task<bool> IsStudentBlockedAsync(
        Guid studentDrivingProfileId,
        DateTime startsAtUtc,
        DateTime endsAtUtc,
        CancellationToken cancellationToken)
    {
        var settings = await dbContext.DrivingSchoolSettings.AsNoTracking().SingleOrDefaultAsync(cancellationToken)
            ?? new DrivingSchoolSettings();

        var blocking = DrivingAppointmentStatuses.Blocking.ToArray();
        var (dayStart, dayEnd) = LocalDayBounds(startsAtUtc);
        var sameDayCount = await dbContext.DrivingAppointments.AsNoTracking()
            .CountAsync(x => x.StudentDrivingProfileId == studentDrivingProfileId
                && blocking.Contains(x.Status)
                && x.StartsAtUtc >= dayStart && x.StartsAtUtc < dayEnd, cancellationToken);

        if (DrivingAvailability.ExceedsDailyLessonCount(sameDayCount, settings.MaxStudentDailyLessons)) return true;

        if (settings.FinancialHoldEnabled)
        {
            var overdue = await OverdueAmountAsync(studentDrivingProfileId, cancellationToken);
            if (DrivingAvailability.IsFinanciallyBlocked(true, overdue, settings.FinancialHoldThreshold)) return true;
        }

        // Öğrencinin kendi takviminde çakışma varsa da hiçbir öğretmen işe yaramaz.
        return await dbContext.DrivingAppointments.AsNoTracking()
            .AnyAsync(x => x.StudentDrivingProfileId == studentDrivingProfileId
                && blocking.Contains(x.Status)
                && x.StartsAtUtc < endsAtUtc && x.EndsAtUtc > startsAtUtc, cancellationToken);
    }

    /// <summary>Öneri motorunun ilk elemesi: araçtan bağımsız öğretmen kuralları.</summary>
    private async Task<List<AvailabilityViolation>> CheckInstructorOnlyAsync(
        Guid instructorProfileId,
        DateTime startsAtUtc,
        DateTime endsAtUtc,
        CancellationToken cancellationToken)
    {
        var settings = await dbContext.DrivingSchoolSettings.AsNoTracking().SingleOrDefaultAsync(cancellationToken)
            ?? new DrivingSchoolSettings();
        var violations = new List<AvailabilityViolation>();
        var lessonMinutes = (int)(endsAtUtc - startsAtUtc).TotalMinutes;

        var leaves = await dbContext.DrivingInstructorLeaves.AsNoTracking()
            .Where(x => x.InstructorProfileId == instructorProfileId && x.StartsAtUtc < endsAtUtc && x.EndsAtUtc > startsAtUtc)
            .Select(x => new LeaveWindow(x.StartsAtUtc, x.EndsAtUtc))
            .ToListAsync(cancellationToken);
        if (DrivingAvailability.IsOnLeave(leaves, startsAtUtc, endsAtUtc))
            violations.Add(new AvailabilityViolation(DrivingAvailability.Codes.InstructorOnLeave, "İzinli.", null));

        var hours = await dbContext.DrivingInstructorWorkingHours.AsNoTracking()
            .Where(x => x.InstructorProfileId == instructorProfileId)
            .Select(x => new WorkingWindow(x.DayOfWeek, x.StartMinute, x.EndMinute))
            .ToListAsync(cancellationToken);
        if (!DrivingAvailability.IsWithinWorkingHours(hours, startsAtUtc, endsAtUtc))
            violations.Add(new AvailabilityViolation(DrivingAvailability.Codes.OutsideWorkingHours, "Çalışma saati dışında.", null));

        var blocking = DrivingAppointmentStatuses.Blocking.ToArray();
        var (dayStart, dayEnd) = LocalDayBounds(startsAtUtc);
        var slots = await dbContext.DrivingAppointments.AsNoTracking()
            .Where(x => x.InstructorProfileId == instructorProfileId && blocking.Contains(x.Status)
                && x.StartsAtUtc >= dayStart && x.StartsAtUtc < dayEnd)
            .Select(x => new BookedSlot(x.StartsAtUtc, x.EndsAtUtc))
            .ToListAsync(cancellationToken);

        if (slots.Any(x => x.StartsAtUtc < endsAtUtc && x.EndsAtUtc > startsAtUtc))
            violations.Add(new AvailabilityViolation("conflict", "Çakışan randevu.", null));

        if (DrivingAvailability.ExceedsDailyMinutes(slots, lessonMinutes, settings.MaxInstructorDailyMinutes))
            violations.Add(new AvailabilityViolation(DrivingAvailability.Codes.InstructorDailyLimit, "Günlük limit.", null));

        if (!DrivingAvailability.HasEnoughPreparationGap(slots, startsAtUtc, endsAtUtc, settings.PreparationMinutes))
            violations.Add(new AvailabilityViolation(DrivingAvailability.Codes.PreparationGap, "Hazırlık süresi yetersiz.", null));

        return violations;
    }

    /// <summary>Aynı YEREL gün içindeki mevcut randevular (limit ve hazırlık hesabı için).</summary>
    private async Task<(List<BookedSlot> Instructor, List<BookedSlot> Vehicle, List<BookedSlot> Student)> LoadSameDaySlotsAsync(
        AppointmentCandidate candidate,
        CancellationToken cancellationToken)
    {
        var blocking = DrivingAppointmentStatuses.Blocking.ToArray();
        var (dayStart, dayEnd) = LocalDayBounds(candidate.StartsAtUtc);

        var sameDay = await dbContext.DrivingAppointments.AsNoTracking()
            .Where(x => blocking.Contains(x.Status)
                && x.StartsAtUtc >= dayStart && x.StartsAtUtc < dayEnd
                && (candidate.ExcludeAppointmentId == null || x.Id != candidate.ExcludeAppointmentId))
            .Where(x => x.InstructorProfileId == candidate.InstructorProfileId
                || x.VehicleId == candidate.VehicleId
                || x.StudentDrivingProfileId == candidate.StudentDrivingProfileId)
            .Select(x => new { x.InstructorProfileId, x.VehicleId, x.StudentDrivingProfileId, x.StartsAtUtc, x.EndsAtUtc })
            .ToListAsync(cancellationToken);

        return (
            sameDay.Where(x => x.InstructorProfileId == candidate.InstructorProfileId).Select(x => new BookedSlot(x.StartsAtUtc, x.EndsAtUtc)).ToList(),
            sameDay.Where(x => x.VehicleId == candidate.VehicleId).Select(x => new BookedSlot(x.StartsAtUtc, x.EndsAtUtc)).ToList(),
            sameDay.Where(x => x.StudentDrivingProfileId == candidate.StudentDrivingProfileId).Select(x => new BookedSlot(x.StartsAtUtc, x.EndsAtUtc)).ToList());
    }

    /// <summary>Yerel günün UTC sınırları — "aynı gün" limitleri yerel takvime göre işler.</summary>
    private static (DateTime Start, DateTime End) LocalDayBounds(DateTime anyInstantUtc)
    {
        var localDate = DrivingAvailability.ToLocal(anyInstantUtc).Date;
        var start = localDate.AddHours(-DrivingAvailability.LocalUtcOffsetHours);
        return (start, start.AddDays(1));
    }

    /// <summary>Öğrencinin vadesi geçmiş ve ödenmemiş taksit toplamı.</summary>
    private async Task<decimal> OverdueAmountAsync(Guid studentDrivingProfileId, CancellationToken cancellationToken)
    {
        var contractId = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.Id == studentDrivingProfileId)
            .Select(x => x.EnrollmentContractId)
            .SingleOrDefaultAsync(cancellationToken);
        if (contractId is null) return 0;

        var now = DateTime.UtcNow;
        var overdue = await dbContext.FinanceInstallments.AsNoTracking()
            .Where(x => x.EnrollmentContractId == contractId && x.DueDateUtc < now && x.PaidAmount < x.Amount)
            .Select(x => x.Amount - x.PaidAmount)
            .ToListAsync(cancellationToken);

        return overdue.Sum();
    }
}
