using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

/// <inheritdoc cref="IDrivingReminderJobService"/>
public sealed class DrivingReminderJobService(
    CourseIntellectDbContext dbContext,
    IDrivingNotifier notifier,
    IDrivingLedgerService ledgerService,
    ILogger<DrivingReminderJobService> logger) : IDrivingReminderJobService
{
    /// <summary>Evrak süresi için uyarı basamakları (gün).</summary>
    private static readonly int[] ExpiryThresholds = [30, 15, 7, 1];

    /// <summary>
    /// Kalan güne karşılık gelen uyarı basamağı: 14 gün kalmışsa "15 gün" basamağı.
    /// Tam eşitlik aramak kırılgandı — iş bir gün geç çalışırsa basamak atlanıyordu.
    /// Basamak dedupe anahtarına girdiği için her aralık için tek bildirim gider.
    /// </summary>
    private static int? ExpiryBucket(int daysLeft, params int[] extraThresholds)
    {
        var thresholds = ExpiryThresholds.Concat(extraThresholds).Distinct().OrderBy(x => x);
        foreach (var threshold in thresholds)
        {
            if (daysLeft <= threshold) return threshold;
        }
        return null; // henüz uyarı aralığında değil
    }

    /// <summary>Bakım kilometresine bu kadar kala uyarılır.</summary>
    private const int MaintenanceKilometerWindow = 500;

    /// <summary>Ders hakkı bu dakikanın altına düşünce uyarılır.</summary>
    private const int LowBalanceMinutes = 120;

    public async Task<int> RunVehicleComplianceRemindersAsync(CancellationToken cancellationToken = default)
    {
        var total = 0;
        await ForEachDrivingSchoolAsync(async () =>
        {
            total += await CheckVehicleDocumentsAsync(cancellationToken);
            total += await CheckMaintenanceKilometerAsync(cancellationToken);
            total += await CheckAppointmentsBlockedByExpiringDocsAsync(cancellationToken);
        }, "araç uygunluk", cancellationToken);

        logger.LogInformation("Sürücü kursu araç uygunluk hatırlatması bitti. Bildirim: {Count}.", total);
        return total;
    }

    /// <summary>
    /// Muayene, sigorta ve yüklenen evrakların son geçerlilik tarihi. Uyarı, kurumun
    /// belge bazında girdiği <c>ReminderDays</c> ve sabit basamaklar (30/15/7/1) üzerinden
    /// yapılır; her basamak için yalnız BİR kez bildirim gider.
    /// </summary>
    private async Task<int> CheckVehicleDocumentsAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var sent = 0;

        var vehicles = await dbContext.DrivingVehicles.AsNoTracking()
            .Where(x => x.IsActive)
            .Select(x => new { x.Id, x.PlateNumber, x.InspectionExpiresAtUtc, x.InsuranceExpiresAtUtc })
            .ToListAsync(cancellationToken);

        foreach (var vehicle in vehicles)
        {
            sent += await NotifyExpiryAsync(vehicle.Id, vehicle.PlateNumber, "Muayene", vehicle.InspectionExpiresAtUtc, now, cancellationToken);
            sent += await NotifyExpiryAsync(vehicle.Id, vehicle.PlateNumber, "Trafik sigortası", vehicle.InsuranceExpiresAtUtc, now, cancellationToken);
        }

        // Yüklenmiş diğer evraklar (ruhsat, kasko, egzoz, vergi, kurs kullanım belgesi…)
        var documents = await dbContext.DrivingVehicleDocuments.AsNoTracking()
            .Join(dbContext.DrivingVehicles.AsNoTracking().Where(v => v.IsActive),
                document => document.VehicleId, vehicle => vehicle.Id,
                (document, vehicle) => new { document.Id, document.VehicleId, vehicle.PlateNumber, document.DocumentType, document.ExpiresAtUtc, document.ReminderDays })
            .ToListAsync(cancellationToken);

        foreach (var document in documents)
        {
            var daysLeft = (int)Math.Floor((document.ExpiresAtUtc - now).TotalDays);
            var expired = daysLeft <= 0;

            // Kurumun belge bazında girdiği eşik de bir basamak sayılır.
            var bucket = expired ? 0 : ExpiryBucket(daysLeft, document.ReminderDays);
            if (bucket is null) continue;
            await notifier.NotifyManagersAsync(
                expired
                    ? $"{document.PlateNumber} — {document.DocumentType} süresi doldu"
                    : $"{document.PlateNumber} — {document.DocumentType} {daysLeft} gün sonra doluyor",
                expired
                    ? $"{document.DocumentType} belgesinin süresi {document.ExpiresAtUtc:dd.MM.yyyy} tarihinde doldu. Araç randevuya çıkamaz."
                    : $"{document.DocumentType} belgesi {document.ExpiresAtUtc:dd.MM.yyyy} tarihinde doluyor. Yenilemeyi unutmayın.",
                DrivingNotificationCategories.Fleet,
                // Her basamak için tek bildirim; iş her gün çalışsa da tekrar etmez.
                dedupeKey: $"vehicle-document-expiry:{document.Id}:{(expired ? "expired" : bucket.ToString())}",
                relatedEntityType: "DrivingVehicle",
                relatedEntityId: document.VehicleId.ToString(),
                cancellationToken: cancellationToken);
            sent++;
        }

        return sent;
    }

    private async Task<int> NotifyExpiryAsync(
        Guid vehicleId,
        string plate,
        string label,
        DateTime? expiresAtUtc,
        DateTime now,
        CancellationToken cancellationToken)
    {
        if (expiresAtUtc is not { } expires) return 0;

        var daysLeft = (int)Math.Floor((expires - now).TotalDays);
        var expired = daysLeft <= 0;
        var bucket = expired ? 0 : ExpiryBucket(daysLeft);
        if (bucket is null) return 0;

        await notifier.NotifyManagersAsync(
            expired ? $"{plate} — {label} süresi doldu" : $"{plate} — {label} {daysLeft} gün sonra doluyor",
            expired
                ? $"{label} {expires:dd.MM.yyyy} tarihinde doldu. Bu araçla randevu oluşturulamaz ve ders başlatılamaz."
                : $"{label} {expires:dd.MM.yyyy} tarihinde doluyor.",
            DrivingNotificationCategories.Fleet,
            dedupeKey: $"vehicle-expiry:{vehicleId}:{label}:{(expired ? "expired" : bucket.ToString())}",
            relatedEntityType: "DrivingVehicle",
            relatedEntityId: vehicleId.ToString(),
            cancellationToken: cancellationToken);
        return 1;
    }

    /// <summary>Bakım kilometresine yaklaşan veya geçen araçlar.</summary>
    private async Task<int> CheckMaintenanceKilometerAsync(CancellationToken cancellationToken)
    {
        var sent = 0;
        var now = DateTime.UtcNow;

        var due = await dbContext.DrivingVehicleServiceRecords.AsNoTracking()
            .Where(x => x.Status == "Completed" && (x.NextServiceKilometer != null || x.NextServiceAtUtc != null))
            .Join(dbContext.DrivingVehicles.AsNoTracking().Where(v => v.IsActive),
                record => record.VehicleId, vehicle => vehicle.Id,
                (record, vehicle) => new { record.Id, record.VehicleId, vehicle.PlateNumber, vehicle.CurrentKilometer, record.NextServiceKilometer, record.NextServiceAtUtc })
            .ToListAsync(cancellationToken);

        foreach (var record in due)
        {
            var kilometerDue = record.NextServiceKilometer is int next
                && record.CurrentKilometer >= next - MaintenanceKilometerWindow;
            var dateDue = record.NextServiceAtUtc is DateTime at && at <= now.AddDays(7);
            if (!kilometerDue && !dateDue) continue;

            var reason = kilometerDue
                ? $"Araç {record.CurrentKilometer} km'de, bakım kilometresi {record.NextServiceKilometer}."
                : $"Planlanan bakım tarihi: {record.NextServiceAtUtc:dd.MM.yyyy}.";

            await notifier.NotifyManagersAsync(
                $"{record.PlateNumber} — bakım zamanı yaklaştı",
                reason,
                DrivingNotificationCategories.Fleet,
                dedupeKey: $"maintenance-due:{record.Id}:{(kilometerDue ? "km" : "date")}",
                relatedEntityType: "DrivingVehicle",
                relatedEntityId: record.VehicleId.ToString(),
                cancellationToken: cancellationToken);
            sent++;
        }

        return sent;
    }

    /// <summary>
    /// Randevu kurulurken araç uygundu ama evrakı o tarihe kadar doluyorsa, ders günü
    /// geldiğinde araç kullanılamaz. Bu sessiz tuzağı önceden yakalayıp yönetimi uyarır.
    /// </summary>
    private async Task<int> CheckAppointmentsBlockedByExpiringDocsAsync(CancellationToken cancellationToken)
    {
        var blocking = DrivingAppointmentStatuses.Blocking.ToArray();
        var now = DateTime.UtcNow;

        var risky = await dbContext.DrivingAppointments.AsNoTracking()
            .Where(x => blocking.Contains(x.Status) && x.StartsAtUtc > now && x.StartsAtUtc < now.AddDays(30))
            .Join(dbContext.DrivingVehicles.AsNoTracking(), x => x.VehicleId, v => v.Id, (appointment, vehicle) => new { appointment, vehicle })
            .Where(x => x.vehicle.IsInMaintenance
                || x.vehicle.InspectionExpiresAtUtc == null || x.vehicle.InsuranceExpiresAtUtc == null
                || x.vehicle.InspectionExpiresAtUtc <= x.appointment.EndsAtUtc
                || x.vehicle.InsuranceExpiresAtUtc <= x.appointment.EndsAtUtc)
            .Select(x => new { AppointmentId = x.appointment.Id, x.appointment.StartsAtUtc, x.vehicle.PlateNumber, VehicleId = x.vehicle.Id })
            .Take(200)
            .ToListAsync(cancellationToken);

        foreach (var item in risky)
        {
            await notifier.NotifyManagersAsync(
                $"{item.PlateNumber} — randevu gününde araç kullanılamayacak",
                $"{DrivingAvailability.ToLocal(item.StartsAtUtc):dd.MM.yyyy HH:mm} randevusunda aracın evrakı geçersiz veya araç bakımda olacak. "
                    + "Randevuyu başka araca taşıyın.",
                DrivingNotificationCategories.Fleet,
                dedupeKey: $"appointment-vehicle-risk:{item.AppointmentId}",
                relatedEntityType: "DrivingAppointment",
                relatedEntityId: item.AppointmentId.ToString(),
                cancellationToken: cancellationToken);
        }

        return risky.Count;
    }

    public async Task<int> RunAppointmentRemindersAsync(CancellationToken cancellationToken = default)
    {
        var total = 0;
        await ForEachDrivingSchoolAsync(async () =>
        {
            // Yerel yarının tamamı: iş sabah çalışır, öğrenci bir gün önceden haberdar olur.
            var tomorrowLocal = DrivingAvailability.ToLocal(DateTime.UtcNow).Date.AddDays(1);
            var start = tomorrowLocal.AddHours(-DrivingAvailability.LocalUtcOffsetHours);
            var end = start.AddDays(1);

            var blocking = DrivingAppointmentStatuses.Blocking.ToArray();
            var appointments = await dbContext.DrivingAppointments.AsNoTracking()
                .Where(x => blocking.Contains(x.Status) && x.StartsAtUtc >= start && x.StartsAtUtc < end)
                .Join(dbContext.DrivingVehicles.AsNoTracking(), x => x.VehicleId, v => v.Id,
                    (appointment, vehicle) => new { appointment, vehicle.PlateNumber })
                .ToListAsync(cancellationToken);

            foreach (var item in appointments)
            {
                var when = DrivingAvailability.ToLocal(item.appointment.StartsAtUtc);
                var meeting = string.IsNullOrWhiteSpace(item.appointment.MeetingPoint)
                    ? string.Empty
                    : $" Buluşma: {item.appointment.MeetingPoint}.";

                await notifier.NotifyStudentAsync(item.appointment.StudentDrivingProfileId,
                    "Yarın direksiyon dersiniz var",
                    $"{when:dd.MM.yyyy HH:mm} — {item.PlateNumber}.{meeting}",
                    DrivingNotificationCategories.Appointment,
                    dedupeKey: $"appointment-reminder-student:{item.appointment.Id}",
                    relatedEntityType: "DrivingAppointment",
                    relatedEntityId: item.appointment.Id.ToString(),
                    cancellationToken: cancellationToken);

                await notifier.NotifyInstructorAsync(item.appointment.InstructorProfileId,
                    "Yarın dersiniz var",
                    $"{when:dd.MM.yyyy HH:mm} — {item.PlateNumber}.{meeting}",
                    DrivingNotificationCategories.Appointment,
                    dedupeKey: $"appointment-reminder-instructor:{item.appointment.Id}",
                    relatedEntityType: "DrivingAppointment",
                    relatedEntityId: item.appointment.Id.ToString(),
                    cancellationToken: cancellationToken);

                total += 2;
            }
        }, "randevu", cancellationToken);

        logger.LogInformation("Sürücü kursu randevu hatırlatması bitti. Bildirim: {Count}.", total);
        return total;
    }

    public async Task<int> RunStudentRemindersAsync(CancellationToken cancellationToken = default)
    {
        var total = 0;
        await ForEachDrivingSchoolAsync(async () =>
        {
            total += await CheckMissingDocumentsAsync(cancellationToken);
            total += await CheckLowLessonBalanceAsync(cancellationToken);
            total += await CheckOverduePaymentsAsync(cancellationToken);
        }, "kursiyer", cancellationToken);

        logger.LogInformation("Sürücü kursu kursiyer hatırlatması bitti. Bildirim: {Count}.", total);
        return total;
    }

    /// <summary>Dosyası eksik veya belgesi reddedilmiş kursiyerlere hatırlatma.</summary>
    private async Task<int> CheckMissingDocumentsAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var sent = 0;
        var today = DrivingAvailability.ToLocal(now).ToString("yyyy-MM-dd");

        var openStatuses = DrivingStudentStatuses.Open.ToArray();
        var students = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => openStatuses.Contains(x.Status))
            .Join(dbContext.Students.AsNoTracking(), x => x.StudentId, x => x.Id, (profile, student) => new { profile.Id, student.BirthDate })
            .ToListAsync(cancellationToken);

        foreach (var student in students)
        {
            var required = DrivingStudentRules.RequiredDocumentsFor(student.BirthDate, now);
            var satisfied = await dbContext.StudentDrivingDocuments.AsNoTracking()
                .Where(x => x.StudentDrivingProfileId == student.Id && x.IsCurrent
                    && x.Status == StudentDocumentStatus.Approved
                    && (x.ExpiresAtUtc == null || x.ExpiresAtUtc > now))
                .Select(x => x.DocumentType)
                .ToListAsync(cancellationToken);

            var missing = DrivingStudentRules.MissingDocuments(required, satisfied.ToHashSet());
            if (missing.Count == 0) continue;

            await notifier.NotifyStudentAsync(student.Id,
                $"{missing.Count} evrakınız eksik",
                "Kurs dosyanız tamamlanmadan direksiyon eğitimine başlayamazsınız. Eksikler: "
                    + string.Join(", ", missing.Take(4).Select(DrivingStudentRules.DocumentLabel))
                    + (missing.Count > 4 ? "…" : string.Empty),
                DrivingNotificationCategories.Document,
                // Günde bir kez; ertesi gün hâlâ eksikse tekrar hatırlatılır.
                dedupeKey: $"missing-documents:{student.Id}:{today}",
                relatedEntityType: "StudentDrivingProfile",
                relatedEntityId: student.Id.ToString(),
                cancellationToken: cancellationToken);
            sent++;
        }

        return sent;
    }

    /// <summary>Ders hakkı azalan kursiyerler — ek ders satışı buradan doğar.</summary>
    private async Task<int> CheckLowLessonBalanceAsync(CancellationToken cancellationToken)
    {
        var sent = 0;
        var schedulable = DrivingStudentStatuses.Schedulable.ToArray();
        var students = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => schedulable.Contains(x.Status))
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        foreach (var profileId in students)
        {
            var balance = await ledgerService.GetBalanceAsync(profileId, cancellationToken);
            if (balance.RemainingMinutes > LowBalanceMinutes || balance.RemainingMinutes <= 0) continue;

            await notifier.NotifyStudentAsync(profileId,
                "Ders hakkınız azalıyor",
                $"Kalan direksiyon hakkınız {balance.RemainingMinutes} dakika. Ek ders için kursunuzla görüşebilirsiniz.",
                DrivingNotificationCategories.Finance,
                // Aynı bakiye için tek bildirim; ders yaptıkça yeniden uyarılır.
                dedupeKey: $"low-balance:{profileId}:{balance.RemainingMinutes}",
                relatedEntityType: "StudentDrivingProfile",
                relatedEntityId: profileId.ToString(),
                cancellationToken: cancellationToken);
            sent++;
        }

        return sent;
    }

    /// <summary>Vadesi geçmiş taksiti olan kursiyerler.</summary>
    private async Task<int> CheckOverduePaymentsAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var week = DrivingAvailability.ToLocal(now).ToString("yyyy-'W'ww");
        var sent = 0;

        var students = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.EnrollmentContractId != null)
            .Select(x => new { x.Id, ContractId = x.EnrollmentContractId!.Value })
            .ToListAsync(cancellationToken);

        foreach (var student in students)
        {
            var overdue = await dbContext.FinanceInstallments.AsNoTracking()
                .Where(x => x.EnrollmentContractId == student.ContractId && x.DueDateUtc < now && x.PaidAmount < x.Amount)
                .Select(x => x.Amount - x.PaidAmount)
                .ToListAsync(cancellationToken);

            if (overdue.Count == 0) continue;

            await notifier.NotifyStudentAsync(student.Id,
                "Gecikmiş ödemeniz var",
                $"{overdue.Count} taksitinizin vadesi geçti. Toplam gecikmiş tutar: {overdue.Sum():N2} ₺. "
                    + "Borcunuz belirli bir eşiği aşarsa yeni randevu alamayabilirsiniz.",
                DrivingNotificationCategories.Finance,
                // Haftada bir: her gün borç hatırlatmak taciz olur.
                dedupeKey: $"payment-overdue:{student.Id}:{week}",
                relatedEntityType: "StudentDrivingProfile",
                relatedEntityId: student.Id.ToString(),
                cancellationToken: cancellationToken);
            sent++;
        }

        return sent;
    }

    public async Task<int> RunDailyOperationsSummaryAsync(CancellationToken cancellationToken = default)
    {
        var total = 0;
        await ForEachDrivingSchoolAsync(async () =>
        {
            var now = DateTime.UtcNow;
            var todayLocal = DrivingAvailability.ToLocal(now).Date;
            var start = todayLocal.AddHours(-DrivingAvailability.LocalUtcOffsetHours);
            var end = start.AddDays(1);
            var today = todayLocal.ToString("yyyy-MM-dd");

            var blocking = DrivingAppointmentStatuses.Blocking.ToArray();
            var lessonsToday = await dbContext.DrivingAppointments.AsNoTracking()
                .CountAsync(x => blocking.Contains(x.Status) && x.StartsAtUtc >= start && x.StartsAtUtc < end, cancellationToken);

            var vehiclesOut = await dbContext.DrivingVehicles.AsNoTracking()
                .CountAsync(x => x.IsActive && (x.IsInMaintenance
                    || x.InspectionExpiresAtUtc == null || x.InsuranceExpiresAtUtc == null
                    || x.InspectionExpiresAtUtc <= now || x.InsuranceExpiresAtUtc <= now), cancellationToken);

            var pendingDocuments = await dbContext.StudentDrivingDocuments.AsNoTracking()
                .CountAsync(x => x.IsCurrent && x.Status == StudentDocumentStatus.PendingApproval, cancellationToken);

            // Hiç iş yoksa yöneticiyi boş bildirimle rahatsız etme.
            if (lessonsToday == 0 && vehiclesOut == 0 && pendingDocuments == 0) return;

            await notifier.NotifyManagersAsync(
                "Günlük operasyon özeti",
                $"Bugün {lessonsToday} direksiyon dersi planlı. "
                    + $"Kullanılamayan araç: {vehiclesOut}. Onay bekleyen evrak: {pendingDocuments}.",
                DrivingNotificationCategories.Fleet,
                dedupeKey: $"daily-summary:{today}",
                cancellationToken: cancellationToken);
            total++;
        }, "günlük özet", cancellationToken);

        return total;
    }

    /// <summary>
    /// Yalnızca sürücü kursu olan ve modülü açık kurumlar için çalışır; her kurumda
    /// tenant override kurar, hata kurum bazında izole edilir, override her zaman temizlenir.
    /// </summary>
    private async Task ForEachDrivingSchoolAsync(Func<Task> action, string label, CancellationToken cancellationToken)
    {
        // Override yokken (job bağlamı) filtre kapalı → tüm kurumlar görünür.
        var tenantIds = await dbContext.Set<TenantWorkspace>()
            .AsNoTracking()
            .Where(x => x.InstitutionType == InstitutionType.DrivingSchool
                && x.DrivingSchoolModuleEnabled
                && x.Status == "active")
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        if (tenantIds.Count == 0) return;
        logger.LogInformation("Sürücü kursu {Label} işi başladı: {Count} kurum.", label, tenantIds.Count);

        foreach (var tenantId in tenantIds)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                dbContext.SetTenantOverride(tenantId);
                await action();
            }
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
            {
                logger.LogWarning(exception, "Kurum {TenantId} için sürücü kursu {Label} işi başarısız.", tenantId, label);
            }
            finally
            {
                dbContext.SetTenantOverride(null);
            }
        }
    }
}
