using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class DrivingAppointmentLifecycleService(
    CourseIntellectDbContext dbContext,
    IDrivingLedgerService ledgerService) : IDrivingAppointmentLifecycleService
{
    // Süresi geçtiğinde otomatik tamamlanabilecek AÇIK durumlar. InProgress dahil
    // DEĞİL: öğretmen dersi bizzat yürütüyor, değerlendirme akışıyla kapatır.
    private static readonly DrivingAppointmentStatus[] AutoCompletable =
    [
        DrivingAppointmentStatus.Planned,
        DrivingAppointmentStatus.Approved,
        DrivingAppointmentStatus.CheckedIn,
    ];

    // Yalnızca YAKIN geçmişteki randevular otomatik tamamlanır. Böylece özellik
    // ilk açıldığında aylar önce kapanmadan kalmış bayat randevular topluca
    // tamamlanıp öğrencilerin dakikasından toplu düşülmez (güvenli geçiş). İş her
    // 10 dk çalıştığı için biten randevu birkaç dakika içinde işlenir; hafta sonu
    // iş durursa diye 3 günlük pencere yeterli tampon bırakır. Daha eski açık
    // randevuları ofis elle (tamamla/iptal/gelmedi) kapatır.
    private static readonly TimeSpan LookbackWindow = TimeSpan.FromDays(3);

    public async Task<int> AutoCompletePastDueForCurrentTenantAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var earliest = now - LookbackWindow;
        var due = await dbContext.DrivingAppointments
            .Where(x => x.EndsAtUtc < now && x.EndsAtUtc >= earliest && AutoCompletable.Contains(x.Status))
            .ToListAsync(cancellationToken);
        if (due.Count == 0) return 0;

        var affectedProfiles = new HashSet<Guid>();
        foreach (var appointment in due)
        {
            var scheduledMinutes = Math.Max(1, (int)Math.Ceiling((appointment.EndsAtUtc - appointment.StartsAtUtc).TotalMinutes));
            // Otomatik ders kaydı — mezuniyet direksiyon dakikası bunu sayar; puan/km yok.
            var lesson = new DrivingLesson
            {
                AppointmentId = appointment.Id,
                StudentDrivingProfileId = appointment.StudentDrivingProfileId,
                InstructorProfileId = appointment.InstructorProfileId,
                VehicleId = appointment.VehicleId,
                StartedAtUtc = appointment.StartsAtUtc,
                CompletedAtUtc = appointment.EndsAtUtc,
                StartKilometer = 0,
                ChargedMinutes = scheduledMinutes,
                InstructorNote = "Sistem tarafından otomatik tamamlandı (randevu saati geçti).",
            };
            dbContext.DrivingLessons.Add(lesson);

            var from = appointment.Status;
            appointment.Status = DrivingAppointmentStatus.Completed;
            appointment.AutoCompleted = true;
            appointment.AttendanceConfirmed = false;

            // Rezervasyon kullanıma döner: bloke edilen süre serbest bırakılır, sonra
            // planlanan süre harcanmış işlenir (öğrenci geldi varsayımı). "Gelmedi"
            // işaretlenirse bu dakika iade edilir.
            await ledgerService.AddAsync(appointment.StudentDrivingProfileId, DrivingLedgerEntryType.ReservationReleased, scheduledMinutes,
                $"{appointment.StartsAtUtc:dd.MM.yyyy HH:mm} dersi otomatik tamamlandı, rezervasyon çözüldü",
                appointmentId: appointment.Id, cancellationToken: cancellationToken);
            await ledgerService.AddAsync(appointment.StudentDrivingProfileId, DrivingLedgerEntryType.LessonUsage, -scheduledMinutes,
                $"{appointment.StartsAtUtc:dd.MM.yyyy HH:mm} tarihli direksiyon dersi (otomatik)",
                appointmentId: appointment.Id, drivingLessonId: lesson.Id, cancellationToken: cancellationToken);

            dbContext.DrivingAppointmentStatusHistory.Add(new DrivingAppointmentStatusHistory
            {
                AppointmentId = appointment.Id,
                FromStatus = from,
                ToStatus = DrivingAppointmentStatus.Completed,
                ChangedByName = "Sistem",
                Reason = "Randevu saati geçti; otomatik tamamlandı.",
                Note = $"{scheduledMinutes} dk işlendi. Yoklama teyidi bekliyor.",
            });

            affectedProfiles.Add(appointment.StudentDrivingProfileId);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        foreach (var profileId in affectedProfiles)
            await ledgerService.SyncProfileCacheAsync(profileId, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return due.Count;
    }
}
