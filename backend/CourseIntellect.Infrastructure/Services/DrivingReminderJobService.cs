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
    public async Task<int> RunComplianceRemindersAsync(CancellationToken cancellationToken = default)
    {
        var total = 0;
        await ForEachDrivingSchoolAsync(async () =>
        {
            total += await CheckTermDeadlinesAsync(cancellationToken);
            total += await CheckWorkingPermitsAsync(cancellationToken);
            total += await CheckLastExamAttemptsAsync(cancellationToken);
            total += await CheckAttendanceRiskAsync(cancellationToken);
        }, "MEBBİS/mevzuat uyum", cancellationToken);

        logger.LogInformation("Sürücü kursu uyum hatırlatması bitti. Bildirim: {Count}.", total);
        return total;
    }

    /// <summary>
    /// Dönem kayıt kesim tarihi yaklaşırken (7/3/1 gün) yöneticiye MEBBİS eksiği
    /// olan aday sayısıyla birlikte uyarı gider — kimse sayfayı açmasa da.
    /// </summary>
    private async Task<int> CheckTermDeadlinesAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var sent = 0;
        var groups = await dbContext.DrivingStudentGroups.AsNoTracking()
            .Where(x => x.IsActive && x.RegistrationDeadlineUtc != null && x.RegistrationDeadlineUtc > now)
            .ToListAsync(cancellationToken);

        foreach (var group in groups)
        {
            var daysLeft = (int)Math.Ceiling((group.RegistrationDeadlineUtc!.Value - now).TotalDays);
            var bucket = daysLeft <= 1 ? 1 : daysLeft <= 3 ? 3 : daysLeft <= 7 ? 7 : (int?)null;
            if (bucket is null) continue;

            // Eksik hesabı hafif tutulur: MEBBİS kimlik alanları + zorunlu evraklar.
            var students = await dbContext.StudentDrivingProfiles.AsNoTracking()
                .Where(x => x.StudentGroupId == group.Id)
                .Join(dbContext.Students.AsNoTracking(), p => p.StudentId, s => s.Id,
                    (p, s) => new { p.Id, p.FatherName, p.MotherName, p.BirthPlace, p.IdentitySerialNo, p.Phone, s.BirthDate })
                .ToListAsync(cancellationToken);
            var studentIds = students.Select(x => x.Id).ToList();
            var documents = await dbContext.StudentDrivingDocuments.AsNoTracking()
                .Where(x => studentIds.Contains(x.StudentDrivingProfileId) && x.IsCurrent)
                .Select(x => new { x.StudentDrivingProfileId, x.DocumentType, x.Status, x.ExpiresAtUtc })
                .ToListAsync(cancellationToken);
            var documentsByStudent = documents.ToLookup(x => x.StudentDrivingProfileId);

            var incomplete = students.Count(student =>
            {
                var identityMissing = string.IsNullOrWhiteSpace(student.FatherName)
                    || string.IsNullOrWhiteSpace(student.MotherName)
                    || string.IsNullOrWhiteSpace(student.BirthPlace)
                    || string.IsNullOrWhiteSpace(student.IdentitySerialNo)
                    || string.IsNullOrWhiteSpace(student.Phone);
                if (identityMissing) return true;
                var required = DrivingStudentRules.RequiredDocumentsFor(student.BirthDate, now);
                var satisfied = documentsByStudent[student.Id]
                    .Where(x => DrivingStudentRules.CountsAsSatisfied(x.Status, x.ExpiresAtUtc, now))
                    .Select(x => x.DocumentType).ToHashSet();
                return DrivingStudentRules.MissingDocuments(required, satisfied).Count > 0;
            });

            await notifier.NotifyManagersAsync(
                $"Dönem kapanışına {daysLeft} gün: {group.Name}",
                incomplete > 0
                    ? $"{students.Count} kursiyerden {incomplete} adayın MEBBİS bilgisi/evrakı eksik. Kesim tarihi: {group.RegistrationDeadlineUtc:dd.MM.yyyy}."
                    : $"{students.Count} kursiyerin tamamı MEBBİS girişine hazır. Kesim tarihi: {group.RegistrationDeadlineUtc:dd.MM.yyyy}.",
                DrivingNotificationCategories.Document,
                dedupeKey: $"term-deadline:{group.Id}:{bucket}",
                relatedEntityType: nameof(DrivingStudentGroup), relatedEntityId: group.Id.ToString(),
                cancellationToken: cancellationToken);
            sent++;
        }
        return sent;
    }

    /// <summary>MEB çalışma izni süresi: 30/15/7/1 gün kala ve dolduğunda yöneticiye uyarı.</summary>
    private async Task<int> CheckWorkingPermitsAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var sent = 0;
        var instructors = await dbContext.DrivingInstructorProfiles.AsNoTracking()
            .Where(x => x.IsActive && x.WorkingPermitExpiresAtUtc != null)
            .Join(dbContext.Staff.AsNoTracking(), p => p.StaffId, s => s.Id,
                (p, s) => new { p.Id, s.FullName, p.WorkingPermitNo, Expires = p.WorkingPermitExpiresAtUtc!.Value })
            .ToListAsync(cancellationToken);

        foreach (var instructor in instructors)
        {
            var daysLeft = (int)Math.Floor((instructor.Expires - now).TotalDays);
            var expired = daysLeft <= 0;
            var bucket = expired ? 0 : ExpiryBucket(daysLeft);
            if (bucket is null) continue;

            await notifier.NotifyManagersAsync(
                expired ? "Çalışma izni doldu" : $"Çalışma izni {daysLeft} gün içinde doluyor",
                $"{instructor.FullName} — MEB çalışma izni"
                    + (string.IsNullOrWhiteSpace(instructor.WorkingPermitNo) ? "" : $" ({instructor.WorkingPermitNo})")
                    + $" bitiş: {instructor.Expires:dd.MM.yyyy}. {(expired ? "Süresi dolmuş izinle ders verilemez; yenileyin." : "Yenileme başvurusunu planlayın.")}",
                DrivingNotificationCategories.Document,
                dedupeKey: $"working-permit:{instructor.Id}:{bucket}",
                relatedEntityType: "DrivingInstructorProfile", relatedEntityId: instructor.Id.ToString(),
                cancellationToken: cancellationToken);
            sent++;
        }
        return sent;
    }

    /// <summary>
    /// Son sınav hakkına gelen adaylar (3/4 hak tüketilmiş): bir başarısızlık daha
    /// dönemi düşürür — yönetici önceden bilsin, ek hazırlık planlansın.
    /// </summary>
    private async Task<int> CheckLastExamAttemptsAsync(CancellationToken cancellationToken)
    {
        var sent = 0;
        var attempts = await dbContext.DrivingExamCandidates.AsNoTracking()
            .Where(x => x.Status != DrivingExamCandidateStatus.Cancelled)
            .Join(dbContext.DrivingExamSessions.AsNoTracking(), c => c.ExamSessionId, s => s.Id,
                (c, s) => new { c.StudentDrivingProfileId, s.ExamType, c.Status })
            .ToListAsync(cancellationToken);

        var lastAttempt = attempts
            .GroupBy(x => new { x.StudentDrivingProfileId, x.ExamType })
            // Son hak: kullanılan deneme MaxAttempts-1 VE tür henüz geçilmemiş.
            .Where(g => g.Count() == DrivingExamRules.MaxAttempts - 1
                && !g.Any(x => x.Status == DrivingExamCandidateStatus.Passed))
            .ToList();
        if (lastAttempt.Count == 0) return 0;

        var profileIds = lastAttempt.Select(x => x.Key.StudentDrivingProfileId).Distinct().ToList();
        var names = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => profileIds.Contains(x.Id) && x.Status != DrivingStudentStatus.Cancelled && x.Status != DrivingStudentStatus.Graduated)
            .Join(dbContext.Students.AsNoTracking(), p => p.StudentId, s => s.Id, (p, s) => new { p.Id, p.StudentNumber, s.FullName })
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        foreach (var group in lastAttempt)
        {
            if (!names.TryGetValue(group.Key.StudentDrivingProfileId, out var student)) continue;
            await notifier.NotifyManagersAsync(
                "Son sınav hakkı",
                $"#{student.StudentNumber} {student.FullName} — {DrivingExamRules.ExamTypeLabel(group.Key.ExamType)} için son hakkına geldi. Bir başarısızlık daha dönemi düşürür; ek hazırlık planlayın.",
                DrivingNotificationCategories.Exam,
                dedupeKey: $"last-attempt:{group.Key.StudentDrivingProfileId}:{group.Key.ExamType}",
                relatedEntityType: "StudentDrivingProfile", relatedEntityId: group.Key.StudentDrivingProfileId.ToString(),
                cancellationToken: cancellationToken);
            sent++;
        }
        return sent;
    }

    /// <summary>
    /// Teorik devam riski: asgari devam oranının altına düşen kursiyer dönemini
    /// kaybeder. Hesap, mezuniyet kontrolüyle aynı mazeret politikasını kullanır.
    /// </summary>
    private async Task<int> CheckAttendanceRiskAsync(CancellationToken cancellationToken)
    {
        var settings = await dbContext.DrivingSchoolSettings.AsNoTracking().SingleOrDefaultAsync(cancellationToken)
            ?? new DrivingSchoolSettings();
        var sent = 0;

        var records = await dbContext.DrivingTheoryAttendances.AsNoTracking()
            .Join(dbContext.DrivingTheorySessions.AsNoTracking().Where(x => x.Status != DrivingTheorySessionStatus.Cancelled),
                a => a.TheorySessionId, s => s.Id,
                (a, s) => new { a.StudentDrivingProfileId, a.Status, Minutes = (int)(s.EndsAtUtc - s.StartsAtUtc).TotalMinutes })
            .ToListAsync(cancellationToken);
        if (records.Count == 0) return 0;

        var atRisk = new List<Guid>();
        foreach (var group in records.GroupBy(x => x.StudentDrivingProfileId))
        {
            var scheduled = group.Sum(x => x.Minutes);
            var attended = group.Where(x => x.Status is DrivingTheoryAttendanceStatus.Present or DrivingTheoryAttendanceStatus.Late).Sum(x => x.Minutes);
            var excused = group.Where(x => x.Status == DrivingTheoryAttendanceStatus.Excused).Sum(x => x.Minutes);
            var denominator = settings.ExcusedAbsencePolicy == DrivingExcusedAbsencePolicy.ExcludeFromCalculation ? Math.Max(0, scheduled - excused) : scheduled;
            if (settings.ExcusedAbsencePolicy == DrivingExcusedAbsencePolicy.CountsAsPresent) attended += excused;
            if (denominator == 0) continue;
            var percent = attended * 100m / denominator;
            if (percent < settings.MinimumTheoryAttendancePercent) atRisk.Add(group.Key);
        }
        if (atRisk.Count == 0) return 0;

        var students = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => atRisk.Contains(x.Id) && DrivingStudentStatuses.Open.Contains(x.Status))
            .Join(dbContext.Students.AsNoTracking(), p => p.StudentId, s => s.Id, (p, s) => new { p.Id, p.StudentNumber, s.FullName })
            .ToListAsync(cancellationToken);

        foreach (var student in students)
        {
            await notifier.NotifyManagersAsync(
                "Devam riski — dönem yanabilir",
                $"#{student.StudentNumber} {student.FullName} — teorik devam oranı asgari %{settings.MinimumTheoryAttendancePercent:0.##} sınırının altında. Devamsızlık sürerse dönem yanar.",
                DrivingNotificationCategories.Document,
                dedupeKey: $"attendance-risk:{student.Id}",
                relatedEntityType: "StudentDrivingProfile", relatedEntityId: student.Id.ToString(),
                cancellationToken: cancellationToken);
            sent++;
        }
        return sent;
    }

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
