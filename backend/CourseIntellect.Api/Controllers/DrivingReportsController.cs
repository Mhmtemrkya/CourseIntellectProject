using System.Globalization;
using System.Text;
using CourseIntellect.Api.Authorization;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Permissions;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Sürücü kursu raporları: eğitmen performansı, araç/filo kullanımı, iptal-devamsızlık
/// ve kursiyer ilerlemesi.
///
/// <para>Her rapor TEK bir <see cref="DrivingReportDocument"/> üretir; ekran (JSON), CSV
/// ve PDF aynı belgeden türer — böylece üç çıktı asla ayrışmaz.</para>
///
/// <para>YETKİ İNCELİĞİ: <c>driving.report.view</c> sekreterde ve filo sorumlusunda da var,
/// ama onlarda <c>driving.finance.report.view</c> YOK (katalog bunu bilerek kısıtlar).
/// Bu yüzden parasal sütunlar (servis maliyeti, yanan tutar) yalnızca finans rapor
/// yetkisi olana eklenir; aksi halde rapor, finansı görmemesi gereken role sızdırırdı.</para>
/// </summary>
[ApiController]
[Authorize]
[Route("api/driving-school/reports")]
public sealed class DrivingReportsController(
    CourseIntellectDbContext db,
    IDrivingPermissionService permissions,
    IDrivingReportPdfService pdf,
    IFileStorageService files) : ControllerBase
{
    private static readonly string[] ReportKeys = ["instructors", "vehicles", "cancellations", "students", "audit-package"];

    [HttpGet("{reportKey}")]
    [RequireDrivingPermission(DrivingPermissions.ReportView)]
    public async Task<IActionResult> Get(string reportKey, [FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (!ReportKeys.Contains(reportKey, StringComparer.OrdinalIgnoreCase))
            return NotFound(new { message = "Tanımsız rapor." });
        if (!TryRange(from, to, out var start, out var end, out var rangeError))
            return BadRequest(new { message = rangeError });

        var document = await BuildAsync(reportKey, start, end, await CanSeeFinanceAsync(ct), withBranding: false, ct);

        return Ok(new
        {
            key = reportKey,
            title = document.Title,
            description = document.Description,
            fromUtc = document.FromUtc,
            toUtc = document.ToUtc,
            includesFinance = await CanSeeFinanceAsync(ct),
            columns = document.Columns.Select(x => new { header = x.Header, numeric = x.Numeric }),
            rows = document.Rows,
            summary = document.Summary.Select(x => new { label = x.Label, value = x.Value }),
        });
    }

    [HttpGet("{reportKey}/export")]
    [RequireDrivingPermission(DrivingPermissions.ReportExport)]
    public async Task<IActionResult> Export(string reportKey, [FromQuery] string format, [FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (!ReportKeys.Contains(reportKey, StringComparer.OrdinalIgnoreCase))
            return NotFound(new { message = "Tanımsız rapor." });
        if (!TryRange(from, to, out var start, out var end, out var rangeError))
            return BadRequest(new { message = rangeError });

        var wantsPdf = string.Equals(format, "pdf", StringComparison.OrdinalIgnoreCase);
        if (!wantsPdf && !string.Equals(format, "csv", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Biçim yalnızca csv veya pdf olabilir." });

        var document = await BuildAsync(reportKey, start, end, await CanSeeFinanceAsync(ct), withBranding: wantsPdf, ct);
        var stamp = $"{Local(start):yyyyMMdd}-{Local(end.AddSeconds(-1)):yyyyMMdd}";
        var name = $"{reportKey}-raporu-{stamp}";

        if (wantsPdf) return File(pdf.Generate(document), "application/pdf", $"{name}.pdf");

        // Excel'in TR yerelinde ayracı doğru seçmesi için BOM + sep ipucu şart.
        var csv = BuildCsv(document);
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray();
        return File(bytes, "text/csv; charset=utf-8", $"{name}.csv");
    }

    // ─── Rapor üretimi ────────────────────────────────────────────────────────

    private Task<DrivingReportDocument> BuildAsync(string key, DateTime start, DateTime end, bool finance, bool withBranding, CancellationToken ct)
        => key.ToLowerInvariant() switch
        {
            "instructors" => InstructorsAsync(start, end, finance, withBranding, ct),
            "vehicles" => VehiclesAsync(start, end, finance, withBranding, ct),
            "cancellations" => CancellationsAsync(start, end, finance, withBranding, ct),
            "audit-package" => AuditPackageAsync(start, end, withBranding, ct),
            _ => StudentsAsync(start, end, finance, withBranding, ct),
        };

    /// <summary>
    /// Denetim paketi: MEB denetçisinin sorduğu her şey tek raporda — eksik/geçersiz
    /// kursiyer evrakları, süresi geçmiş/yaklaşan araç belgeleri, araç yaş sınırı ve
    /// personel çalışma izinleri. Satır yoksa kurum "denetime hazır" demektir.
    /// Tarih aralığından bağımsız ANLIK durum raporudur.
    /// </summary>
    private async Task<DrivingReportDocument> AuditPackageAsync(DateTime start, DateTime end, bool branding, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var soon = now.AddDays(30);
        var rows = new List<IReadOnlyList<string>>();
        static string LocalDate(DateTime? value) => value is { } v ? v.AddHours(3).ToString("dd.MM.yyyy") : "—";

        // ─── 1) Kursiyer evrakları (açık dosyalar) ────────────────────────────
        var openStatuses = DrivingStudentStatuses.Open.ToArray();
        var students = await db.StudentDrivingProfiles.AsNoTracking()
            .Where(x => openStatuses.Contains(x.Status))
            .Join(db.Students.AsNoTracking(), p => p.StudentId, s => s.Id,
                (p, s) => new { p.Id, p.StudentNumber, s.FullName, s.BirthDate })
            .ToListAsync(ct);
        var studentIds = students.Select(x => x.Id).ToList();
        var documents = await db.StudentDrivingDocuments.AsNoTracking()
            .Where(x => studentIds.Contains(x.StudentDrivingProfileId) && x.IsCurrent)
            .Select(x => new { x.StudentDrivingProfileId, x.DocumentType, x.Status, x.ExpiresAtUtc })
            .ToListAsync(ct);
        var documentsByStudent = documents.ToLookup(x => x.StudentDrivingProfileId);

        var missingDocumentStudents = 0;
        foreach (var student in students.OrderBy(x => x.StudentNumber))
        {
            var required = DrivingStudentRules.RequiredDocumentsFor(student.BirthDate, now);
            var satisfied = documentsByStudent[student.Id]
                .Where(x => DrivingStudentRules.CountsAsSatisfied(x.Status, x.ExpiresAtUtc, now))
                .Select(x => x.DocumentType)
                .ToHashSet();
            var missing = DrivingStudentRules.MissingDocuments(required, satisfied);
            if (missing.Count == 0) continue;
            missingDocumentStudents++;
            rows.Add(["Kursiyer evrakları", $"#{student.StudentNumber} {student.FullName}",
                string.Join(", ", missing.Select(DrivingStudentRules.DocumentLabel)), "EKSİK"]);
        }

        // ─── 2) Araç belgeleri, muayene/sigorta ve yaş sınırı ─────────────────
        var settings = await db.DrivingSchoolSettings.AsNoTracking().SingleOrDefaultAsync(ct) ?? new DrivingSchoolSettings();
        var vehicles = await db.DrivingVehicles.AsNoTracking().Where(x => x.IsActive).ToListAsync(ct);
        var vehicleIssues = 0;
        foreach (var vehicle in vehicles.OrderBy(x => x.PlateNumber))
        {
            void VehicleIssue(string subject, DateTime? expires)
            {
                if (expires is not { } value || value > soon) return;
                vehicleIssues++;
                rows.Add(["Araç belgeleri", vehicle.PlateNumber, subject + " — " + LocalDate(value),
                    value <= now ? "SÜRESİ GEÇTİ" : "30 GÜN İÇİNDE DOLUYOR"]);
            }
            VehicleIssue("Muayene", vehicle.InspectionExpiresAtUtc);
            VehicleIssue("Sigorta", vehicle.InsuranceExpiresAtUtc);

            if (DrivingAvailability.ExceedsVehicleAge(vehicle.ModelYear, settings.MaxVehicleAgeYears, now))
            {
                vehicleIssues++;
                rows.Add(["Araç belgeleri", vehicle.PlateNumber,
                    $"Araç yaşı ({vehicle.ModelYear} model) kurumun {settings.MaxVehicleAgeYears} yıl sınırını aşıyor", "YAŞ SINIRI"]);
            }
        }

        var vehicleDocuments = await db.DrivingVehicleDocuments.AsNoTracking()
            .Where(x => x.ExpiresAtUtc <= soon)
            .Join(db.DrivingVehicles.AsNoTracking(), d => d.VehicleId, v => v.Id, (d, v) => new { d.DocumentType, d.ExpiresAtUtc, v.PlateNumber, v.IsActive })
            .Where(x => x.IsActive)
            .OrderBy(x => x.ExpiresAtUtc)
            .ToListAsync(ct);
        foreach (var document in vehicleDocuments)
        {
            vehicleIssues++;
            rows.Add(["Araç belgeleri", document.PlateNumber, $"{document.DocumentType} — {LocalDate(document.ExpiresAtUtc)}",
                document.ExpiresAtUtc <= now ? "SÜRESİ GEÇTİ" : "30 GÜN İÇİNDE DOLUYOR"]);
        }

        // ─── 3) Personel çalışma izinleri ─────────────────────────────────────
        var instructors = await db.DrivingInstructorProfiles.AsNoTracking()
            .Where(x => x.IsActive)
            .Join(db.Staff.AsNoTracking(), x => x.StaffId, x => x.Id, (profile, staff) => new { staff.FullName, profile.WorkingPermitNo, profile.WorkingPermitExpiresAtUtc })
            .ToListAsync(ct);
        var permitIssues = 0;
        foreach (var instructor in instructors.OrderBy(x => x.FullName, StringComparer.CurrentCulture))
        {
            if (instructor.WorkingPermitExpiresAtUtc is not { } expires)
            {
                permitIssues++;
                rows.Add(["Personel çalışma izni", instructor.FullName, "Çalışma izni bitiş tarihi sisteme girilmemiş", "EKSİK KAYIT"]);
            }
            else if (expires <= soon)
            {
                permitIssues++;
                rows.Add(["Personel çalışma izni", instructor.FullName,
                    $"İzin no {(string.IsNullOrWhiteSpace(instructor.WorkingPermitNo) ? "—" : instructor.WorkingPermitNo)} — {LocalDate(expires)}",
                    expires <= now ? "SÜRESİ GEÇTİ" : "30 GÜN İÇİNDE DOLUYOR"]);
            }
        }

        return await DocumentAsync(
            "Denetim Paketi",
            "MEB denetimine hazırlık: eksik kursiyer evrakları, araç belge/muayene/yaş durumu ve personel çalışma izinleri (anlık durum).",
            start, end, branding,
            [
                new DrivingReportColumn("Bölüm"), new DrivingReportColumn("Konu"),
                new DrivingReportColumn("Detay"), new DrivingReportColumn("Durum"),
            ],
            rows,
            [
                ("Denetime hazır", rows.Count == 0 ? "EVET" : "HAYIR"),
                ("Eksik evraklı kursiyer", missingDocumentStudents.ToString()),
                ("Araç belge/yaş sorunu", vehicleIssues.ToString()),
                ("Çalışma izni sorunu", permitIssues.ToString()),
            ],
            ct);
    }

    private async Task<DrivingReportDocument> InstructorsAsync(DateTime start, DateTime end, bool finance, bool branding, CancellationToken ct)
    {
        var instructors = await db.DrivingInstructorProfiles.AsNoTracking()
            .Join(db.Staff.AsNoTracking(), profile => profile.StaffId, staff => staff.Id,
                (profile, staff) => new { profile.Id, staff.FullName })
            .ToListAsync(ct);

        var appointments = await db.DrivingAppointments.AsNoTracking()
            .Where(x => x.StartsAtUtc >= start && x.StartsAtUtc < end)
            .Select(x => new { x.InstructorProfileId, x.Status })
            .ToListAsync(ct);

        var lessons = await db.DrivingLessons.AsNoTracking()
            .Where(x => x.StartedAtUtc >= start && x.StartedAtUtc < end && x.CompletedAtUtc != null)
            .Select(x => new
            {
                x.InstructorProfileId, x.ChargedMinutes,
                x.TrafficRulesScore, x.VehicleControlScore, x.ManeuversScore, x.SafetyScore,
            })
            .ToListAsync(ct);

        var rows = new List<IReadOnlyList<string>>();
        var totalMinutes = 0;
        var totalCompleted = 0;

        foreach (var instructor in instructors.OrderBy(x => x.FullName, StringComparer.CurrentCulture))
        {
            var own = appointments.Where(x => x.InstructorProfileId == instructor.Id).ToList();
            var ownLessons = lessons.Where(x => x.InstructorProfileId == instructor.Id).ToList();
            if (own.Count == 0 && ownLessons.Count == 0) continue;

            var completed = own.Count(x => x.Status == DrivingAppointmentStatus.Completed);
            var cancelled = own.Count(x => DrivingAppointmentStatuses.IsCancelled(x.Status));
            var noShow = own.Count(x => x.Status == DrivingAppointmentStatus.NoShow);
            var minutes = ownLessons.Sum(x => x.ChargedMinutes);

            var scores = ownLessons
                .Select(x => new[] { x.TrafficRulesScore, x.VehicleControlScore, x.ManeuversScore, x.SafetyScore }
                    .Where(score => score.HasValue).Select(score => (double)score!.Value).ToList())
                .Where(list => list.Count > 0)
                .Select(list => list.Average())
                .ToList();

            totalMinutes += minutes;
            totalCompleted += completed;

            rows.Add([
                instructor.FullName,
                own.Count.ToString(Tr),
                completed.ToString(Tr),
                cancelled.ToString(Tr),
                noShow.ToString(Tr),
                minutes.ToString(Tr),
                (minutes / 60.0).ToString("0.0", Tr),
                scores.Count > 0 ? scores.Average().ToString("0.00", Tr) : "-",
            ]);
        }

        return await DocumentAsync(
            "Eğitmen Performans Raporu",
            "Eğitmen başına randevu dağılımı, işlenen ders süresi ve değerlendirme ortalaması.",
            start, end, branding,
            [
                new("Eğitmen"), new("Randevu", true), new("Tamamlanan", true), new("İptal", true),
                new("Devamsızlık", true), new("Dakika", true), new("Saat", true), new("Ort. Puan", true),
            ],
            rows,
            [
                ("Eğitmen", rows.Count.ToString(Tr)),
                ("Tamamlanan ders", totalCompleted.ToString(Tr)),
                ("İşlenen süre", $"{totalMinutes / 60.0:0.0} sa"),
            ],
            ct);
    }

    private async Task<DrivingReportDocument> VehiclesAsync(DateTime start, DateTime end, bool finance, bool branding, CancellationToken ct)
    {
        var vehicles = await db.DrivingVehicles.AsNoTracking()
            .Select(x => new { x.Id, x.PlateNumber, x.Brand, x.Model, x.CurrentKilometer })
            .ToListAsync(ct);

        var lessons = await db.DrivingLessons.AsNoTracking()
            .Where(x => x.StartedAtUtc >= start && x.StartedAtUtc < end)
            .Select(x => new { x.VehicleId, x.ChargedMinutes, x.StartKilometer, x.EndKilometer, x.CompletedAtUtc })
            .ToListAsync(ct);

        var services = await db.DrivingVehicleServiceRecords.AsNoTracking()
            .Where(x => x.ReportedAtUtc >= start && x.ReportedAtUtc < end)
            .Select(x => new { x.VehicleId, x.LaborCost, x.PartsCost, x.Status, x.VehicleUsable })
            .ToListAsync(ct);

        var columns = new List<DrivingReportColumn>
        {
            new("Plaka"), new("Araç"), new("Ders", true), new("Dakika", true),
            new("Yapılan KM", true), new("Servis Kaydı", true), new("Açık Arıza", true),
        };
        if (finance) columns.Add(new DrivingReportColumn("Servis Maliyeti", true));

        var rows = new List<IReadOnlyList<string>>();
        var totalKm = 0;
        var totalMinutes = 0;
        decimal totalCost = 0;

        foreach (var vehicle in vehicles.OrderBy(x => x.PlateNumber, StringComparer.CurrentCulture))
        {
            var own = lessons.Where(x => x.VehicleId == vehicle.Id).ToList();
            var ownServices = services.Where(x => x.VehicleId == vehicle.Id).ToList();
            if (own.Count == 0 && ownServices.Count == 0) continue;

            var minutes = own.Where(x => x.CompletedAtUtc != null).Sum(x => x.ChargedMinutes);
            var km = own
                .Where(x => x.EndKilometer.HasValue && x.EndKilometer.Value > x.StartKilometer)
                .Sum(x => x.EndKilometer!.Value - x.StartKilometer);
            var openFaults = ownServices.Count(x => x.Status == "Open" && !x.VehicleUsable);
            var cost = ownServices.Sum(x => x.LaborCost + x.PartsCost);

            totalKm += km;
            totalMinutes += minutes;
            totalCost += cost;

            var row = new List<string>
            {
                vehicle.PlateNumber,
                $"{vehicle.Brand} {vehicle.Model}".Trim(),
                own.Count.ToString(Tr),
                minutes.ToString(Tr),
                km.ToString(Tr),
                ownServices.Count.ToString(Tr),
                openFaults.ToString(Tr),
            };
            if (finance) row.Add(Money(cost));
            rows.Add(row);
        }

        var summary = new List<(string, string)>
        {
            ("Araç", rows.Count.ToString(Tr)),
            ("Toplam ders süresi", $"{totalMinutes / 60.0:0.0} sa"),
            ("Yapılan KM", totalKm.ToString(Tr)),
        };
        if (finance) summary.Add(("Servis maliyeti", Money(totalCost)));

        return await DocumentAsync(
            "Araç Kullanım ve Filo Maliyet Raporu",
            "Araç başına ders yükü, yapılan kilometre ve servis kayıtları.",
            start, end, branding, columns, rows, summary, ct);
    }

    private async Task<DrivingReportDocument> CancellationsAsync(DateTime start, DateTime end, bool finance, bool branding, CancellationToken ct)
    {
        var settings = await db.DrivingSchoolSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        var lateWindow = TimeSpan.FromHours(settings?.LateCancellationHours ?? 24);

        var appointments = await db.DrivingAppointments.AsNoTracking()
            .Where(x => x.StartsAtUtc >= start && x.StartsAtUtc < end)
            .Select(x => new { x.Id, x.StudentDrivingProfileId, x.StartsAtUtc, x.Status, x.CancelledAtUtc, x.CancellationReason })
            .ToListAsync(ct);

        var total = appointments.Count;
        var closed = appointments
            .Where(x => DrivingAppointmentStatuses.IsCancelled(x.Status) || x.Status == DrivingAppointmentStatus.NoShow)
            .ToList();

        // Yanan dakika defterden okunur — burada yeniden hesaplanmaz (tek kaynak: ledger).
        var burned = await db.DrivingLessonLedgerEntries.AsNoTracking()
            .Where(x => x.CreatedAtUtc >= start && x.CreatedAtUtc < end)
            .Where(x => x.EntryType == DrivingLedgerEntryType.NoShowDeductedMinutes
                     || x.EntryType == DrivingLedgerEntryType.CancelledDeductedMinutes)
            .Select(x => new { x.AppointmentId, x.MinutesDelta })
            .ToListAsync(ct);

        var burnedByAppointment = burned
            .Where(x => x.AppointmentId.HasValue)
            .GroupBy(x => x.AppointmentId!.Value)
            .ToDictionary(x => x.Key, x => Math.Abs(x.Sum(entry => entry.MinutesDelta)));

        var profileIds = closed.Select(x => x.StudentDrivingProfileId).Distinct().ToList();
        var students = await db.StudentDrivingProfiles.AsNoTracking()
            .Where(x => profileIds.Contains(x.Id))
            .Join(db.Students.AsNoTracking(), profile => profile.StudentId, student => student.Id,
                (profile, student) => new { profile.Id, student.FullName, profile.EnrollmentContractId, profile.PurchasedDrivingMinutes })
            .ToListAsync(ct);
        var studentById = students.ToDictionary(x => x.Id);

        // Yanan dakikanın parasal karşılığı sözleşmeden türetilir (dakika başı ücret);
        // ayrı bir "ceza tutarı" alanı tutulmadığı için TAHMİNİdir, öyle etiketlenir.
        var contractIds = students.Where(x => x.EnrollmentContractId.HasValue).Select(x => x.EnrollmentContractId!.Value).ToList();
        var contracts = await db.EnrollmentContracts.AsNoTracking()
            .Where(x => contractIds.Contains(x.Id))
            .Select(x => new { x.Id, x.NetAmount })
            .ToListAsync(ct);
        var netByContract = contracts.ToDictionary(x => x.Id, x => x.NetAmount);

        var columns = new List<DrivingReportColumn>
        {
            new("Kursiyer"), new("Ders Tarihi"), new("Durum"), new("İptal Zamanı"),
            new("Geç İptal"), new("Yanan Dakika", true),
        };
        if (finance) columns.Add(new DrivingReportColumn("Tahmini Tutar", true));

        var rows = new List<IReadOnlyList<string>>();
        var lateCount = 0;
        var totalBurned = 0;
        decimal totalValue = 0;

        foreach (var item in closed.OrderByDescending(x => x.StartsAtUtc))
        {
            studentById.TryGetValue(item.StudentDrivingProfileId, out var student);
            var burnedMinutes = burnedByAppointment.GetValueOrDefault(item.Id);
            var isLate = item.Status != DrivingAppointmentStatus.NoShow
                         && item.CancelledAtUtc.HasValue
                         && item.StartsAtUtc - item.CancelledAtUtc.Value < lateWindow;
            if (isLate) lateCount++;
            totalBurned += burnedMinutes;

            decimal value = 0;
            if (student is not null && burnedMinutes > 0
                && student.PurchasedDrivingMinutes > 0
                && student.EnrollmentContractId.HasValue
                && netByContract.TryGetValue(student.EnrollmentContractId.Value, out var net))
            {
                value = Math.Round(net / student.PurchasedDrivingMinutes * burnedMinutes, 2);
                totalValue += value;
            }

            var row = new List<string>
            {
                student?.FullName ?? "-",
                Local(item.StartsAtUtc).ToString("dd.MM.yyyy HH:mm", Tr),
                DrivingAppointmentStatuses.Label(item.Status),
                item.CancelledAtUtc.HasValue ? Local(item.CancelledAtUtc.Value).ToString("dd.MM.yyyy HH:mm", Tr) : "-",
                item.Status == DrivingAppointmentStatus.NoShow ? "-" : (isLate ? "Evet" : "Hayır"),
                burnedMinutes.ToString(Tr),
            };
            if (finance) row.Add(value > 0 ? Money(value) : "-");
            rows.Add(row);
        }

        var noShowCount = closed.Count(x => x.Status == DrivingAppointmentStatus.NoShow);
        var cancelRate = total > 0 ? (double)closed.Count / total * 100 : 0;

        var summary = new List<(string, string)>
        {
            ("Toplam randevu", total.ToString(Tr)),
            ("İptal + devamsızlık", $"{closed.Count} (%{cancelRate:0.0})"),
            ("Geç iptal", lateCount.ToString(Tr)),
            ("Devamsızlık", noShowCount.ToString(Tr)),
            ("Yanan dakika", totalBurned.ToString(Tr)),
        };
        if (finance) summary.Add(("Tahmini kayıp", Money(totalValue)));

        return await DocumentAsync(
            "İptal ve Devamsızlık Raporu",
            finance
                ? "İptal/devamsızlık dökümü, yanan ders hakkı ve sözleşmeden türetilen tahmini tutar."
                : "İptal/devamsızlık dökümü ve yanan ders hakkı.",
            start, end, branding, columns, rows, summary, ct);
    }

    private async Task<DrivingReportDocument> StudentsAsync(DateTime start, DateTime end, bool finance, bool branding, CancellationToken ct)
    {
        var profiles = await db.StudentDrivingProfiles.AsNoTracking()
            .Join(db.Students.AsNoTracking(), profile => profile.StudentId, student => student.Id,
                (profile, student) => new
                {
                    profile.Id, student.FullName, profile.Status, profile.LicenseClass,
                    profile.PurchasedDrivingMinutes, profile.UsedDrivingMinutes,
                })
            .ToListAsync(ct);

        var documents = await db.StudentDrivingDocuments.AsNoTracking()
            .Where(x => x.IsCurrent)
            .Select(x => new { x.StudentDrivingProfileId, x.Status, x.ExpiresAtUtc })
            .ToListAsync(ct);

        var attendance = await db.DrivingTheoryAttendances.AsNoTracking()
            .Select(x => new { x.StudentDrivingProfileId, x.Status })
            .ToListAsync(ct);

        var candidates = await db.DrivingExamCandidates.AsNoTracking()
            .Join(db.DrivingExamSessions.AsNoTracking(), candidate => candidate.ExamSessionId, session => session.Id,
                (candidate, session) => new
                {
                    candidate.StudentDrivingProfileId, candidate.Status, candidate.AttemptNo, session.ExamType,
                })
            .ToListAsync(ct);

        var graduations = await db.DrivingGraduationRecords.AsNoTracking()
            .Select(x => new { x.StudentDrivingProfileId, x.Status })
            .ToListAsync(ct);

        var rows = new List<IReadOnlyList<string>>();
        var graduatedCount = 0;
        var notSatExamCount = 0;
        var now = DateTime.UtcNow;

        foreach (var profile in profiles.OrderBy(x => x.FullName, StringComparer.CurrentCulture))
        {
            var remaining = Math.Max(0, profile.PurchasedDrivingMinutes - profile.UsedDrivingMinutes);
            var progress = profile.PurchasedDrivingMinutes > 0
                ? (double)profile.UsedDrivingMinutes / profile.PurchasedDrivingMinutes * 100
                : 0;

            var ownDocuments = documents.Where(x => x.StudentDrivingProfileId == profile.Id).ToList();
            // Süresi dolan onaylı belge dosyayı eksiğe düşürür — naif "Approved" sayımı
            // kursiyeri hazır gösterirdi. Kural tek yerde: DrivingStudentRules.
            var approvedDocuments = ownDocuments.Count(x => DrivingStudentRules.CountsAsSatisfied(x.Status, x.ExpiresAtUtc, now));

            var ownAttendance = attendance.Where(x => x.StudentDrivingProfileId == profile.Id).ToList();
            var present = ownAttendance.Count(x => x.Status == DrivingTheoryAttendanceStatus.Present
                                                || x.Status == DrivingTheoryAttendanceStatus.Late);
            var attendanceRate = ownAttendance.Count > 0 ? (double)present / ownAttendance.Count * 100 : 0;

            var theory = candidates.Where(x => x.StudentDrivingProfileId == profile.Id && x.ExamType == DrivingExamType.TheoryEExam).ToList();
            var practice = candidates.Where(x => x.StudentDrivingProfileId == profile.Id && x.ExamType == DrivingExamType.DrivingPractice).ToList();

            // Mezuniyet iki yerden okunur: mezuniyet kaydı (asıl kaynak) ve kursiyer
            // durumu. Yalnızca kayda bakmak, durumu Graduated olup kaydı olmayan
            // kursiyerleri "mezun değil" sayıp raporu eksik gösteriyordu. Geri alınmış
            // mezuniyet (Revoked) her hâlükârda mezun sayılmaz.
            var graduation = graduations.FirstOrDefault(x => x.StudentDrivingProfileId == profile.Id);
            var isGraduated = graduation?.Status != DrivingGraduationStatus.Revoked
                && (graduation?.Status == DrivingGraduationStatus.Graduated
                    || profile.Status == DrivingStudentStatus.Graduated);
            if (isGraduated) graduatedCount++;

            // "Sınava girmemiş" = hiçbir sınava FİİLEN girmemiş. Yalnızca sonucu
            // olan denemeler (geçti/kaldı) sınava girmiş sayılır; Planned henüz
            // girilmemiş bir randevu, Cancelled ise hiç yapılmamış demektir —
            // ikisini de girmiş saymak listeyi olduğundan küçük gösterirdi.
            var satAnyExam = theory.Concat(practice).Any(x =>
                x.Status == DrivingExamCandidateStatus.Passed
                || x.Status == DrivingExamCandidateStatus.Failed);
            if (!satAnyExam) notSatExamCount++;

            rows.Add([
                profile.FullName,
                profile.LicenseClass,
                profile.Status.ToString(),
                profile.UsedDrivingMinutes.ToString(Tr),
                remaining.ToString(Tr),
                $"%{progress:0}",
                ownAttendance.Count > 0 ? $"%{attendanceRate:0}" : "-",
                $"{approvedDocuments}/{ownDocuments.Count}",
                ExamCell(theory.Select(x => (x.Status, x.AttemptNo))),
                ExamCell(practice.Select(x => (x.Status, x.AttemptNo))),
                graduation?.Status == DrivingGraduationStatus.Revoked ? "Geri alındı" : isGraduated ? "Mezun" : "-",
            ]);
        }

        return await DocumentAsync(
            "Kursiyer İlerleme ve Sınav Raporu",
            "Ders hakkı kullanımı, teorik devam, evrak durumu ve sınav sonuçları.",
            start, end, branding,
            [
                new("Kursiyer"), new("Sınıf"), new("Durum"), new("Kullanılan dk", true), new("Kalan dk", true),
                new("İlerleme", true), new("Teorik Devam", true), new("Evrak", true),
                new("E-sınav"), new("Direksiyon Sınavı"), new("Mezuniyet"),
            ],
            rows,
            [
                ("Kursiyer", rows.Count.ToString(Tr)),
                ("Mezun", graduatedCount.ToString(Tr)),
                ("Sınava girmemiş", notSatExamCount.ToString(Tr)),
            ],
            ct);
    }

    private static string ExamCell(IEnumerable<(DrivingExamCandidateStatus Status, int AttemptNo)> attempts)
    {
        var list = attempts.ToList();
        if (list.Count == 0) return "-";
        if (list.Any(x => x.Status == DrivingExamCandidateStatus.Passed))
            return $"Geçti ({list.Max(x => x.AttemptNo)}. denemede)";
        if (list.Any(x => x.Status == DrivingExamCandidateStatus.Planned)) return "Planlandı";
        return $"Kaldı ({list.Count} deneme)";
    }

    // ─── Ortak ────────────────────────────────────────────────────────────────

    private async Task<DrivingReportDocument> DocumentAsync(
        string title, string description, DateTime start, DateTime end, bool branding,
        IReadOnlyList<DrivingReportColumn> columns, IReadOnlyList<IReadOnlyList<string>> rows,
        IReadOnlyList<(string Label, string Value)> summary, CancellationToken ct)
    {
        var tenant = db.CurrentTenantId is Guid tenantId
            ? await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == tenantId, ct)
            : null;

        string? color = null;
        byte[]? logo = null;
        if (branding)
        {
            var settings = await db.DrivingSchoolSettings.AsNoTracking().FirstOrDefaultAsync(ct);
            color = settings?.CertificatePrimaryColor;
            logo = await ReadLogoAsync(settings?.CertificateLogoUrl, ct);
        }

        return new DrivingReportDocument(
            tenant?.Name ?? "Sürücü Kursu",
            title, description, start, end, columns, rows, summary, color, logo);
    }

    /// <summary>Sertifika görselleriyle aynı kısıt: yalnızca kurumun kendi yüklediği yol, boyut ve imza kontrollü.</summary>
    private async Task<byte[]?> ReadLogoAsync(string? url, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(url)
            || !url.StartsWith("/uploads/driving-certificate-assets/", StringComparison.OrdinalIgnoreCase)) return null;

        var bytes = await files.ReadBytesAsync(url, ct);
        if (bytes is null || bytes.Length is 0 or > 5 * 1024 * 1024) return null;

        var png = bytes.Length > 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
        var jpeg = bytes.Length > 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF;
        return png || jpeg ? bytes : null;
    }

    private static string BuildCsv(DrivingReportDocument document)
    {
        var builder = new StringBuilder();
        builder.Append("sep=;\n");
        builder.Append(Escape(document.Title)).Append(';')
            .Append(Escape($"{Local(document.FromUtc):dd.MM.yyyy} - {Local(document.ToUtc):dd.MM.yyyy}")).Append('\n');

        foreach (var (label, value) in document.Summary)
            builder.Append(Escape(label)).Append(';').Append(Escape(value)).Append('\n');

        builder.Append('\n');
        builder.AppendJoin(';', document.Columns.Select(x => Escape(x.Header))).Append('\n');
        foreach (var row in document.Rows)
            builder.AppendJoin(';', row.Select(Escape)).Append('\n');

        return builder.ToString();
    }

    private static string Escape(string value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        var needsQuotes = value.Contains(';') || value.Contains('"') || value.Contains('\n');
        var escaped = value.Replace("\"", "\"\"");
        return needsQuotes ? $"\"{escaped}\"" : escaped;
    }

    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");
    private static string Money(decimal value) => value.ToString("#,##0.00", Tr);
    private static DateTime Local(DateTime utc) => utc.AddHours(3);

    private static bool TryRange(DateTime? from, DateTime? to, out DateTime start, out DateTime end, out string error)
    {
        start = from ?? DateTime.UtcNow.Date.AddDays(-30);
        end = to ?? DateTime.UtcNow.Date.AddDays(1);
        error = string.Empty;

        if (end <= start || end - start > TimeSpan.FromDays(400))
        {
            error = "Tarih aralığı geçersiz.";
            return false;
        }
        return true;
    }

    private Task<bool> CanSeeFinanceAsync(CancellationToken ct)
        => permissions.HasAsync(User, DrivingPermissions.FinanceReportView, ct);

    private async Task<bool> CanUseModuleAsync(CancellationToken ct)
    {
        if (db.CurrentTenantId is not Guid tenantId) return false;
        var tenant = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == tenantId, ct);
        return tenant is not null
            && tenant.InstitutionType == InstitutionType.DrivingSchool
            && tenant.DrivingSchoolModuleEnabled
            && string.Equals(tenant.Status, "active", StringComparison.OrdinalIgnoreCase);
    }
}
