using System.Security.Claims;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Okul/kurs kurum sahibinin ana paneli — sürücü kursu operasyon merkezinin okul
/// karşılığı. Kurum sahibinin görmesi gereken her sayaç TEK uçtan, sunucuda
/// hesaplanarak döner; masaüstü ve mobil aynı gövdeyi kullanır.
///
/// <para>Güvenlik: tenant + şube izolasyonu global query filter ile otomatiktir
/// (ayrıca elle filtre uygulanmaz). Modül bazlı sayaçlar <see cref="IEntitlementService"/>
/// ile kapıdan geçer — kurumun paketinde veya kullanıcının özel rolünde olmayan
/// modülün sayacı hiç hesaplanmaz ve gövdeye <c>null</c> olarak yazılır; istemci
/// null gelen kartı çizmez. Böylece panoda yetkisiz veri sızmaz.</para>
///
/// <para><paramref name="from"/>/<paramref name="to"/> verilirse DÖNEMSEL sayaçlar
/// (yeni kayıt, devam oranı, tahsilat, gider) o aralık için hesaplanır; yapısal
/// sayaçlar (aktif öğrenci, sınıf, bekleyen onay…) her zaman "şu an"ın fotoğrafıdır.</para>
/// </summary>
[ApiController]
[Authorize(Roles = "Admin,Administrative,BranchManager")]
[Route("api/admin/dashboard")]
public sealed class SchoolDashboardController(
    CourseIntellectDbContext dbContext,
    IEntitlementService entitlementService,
    IMessageService messageService,
    ITenantContext tenantContext) : ControllerBase
{
    private static readonly string[] PresentStatuses = ["Katildi", "Gec", "Izinli"];

    // Sınıf defteri ClassesController ile AYNI iki yapılandırma türünde tutulur.
    private const string ClassRegistryType = "class-registry";
    private const string ClassManagementType = "class-management";

    /// <summary>
    /// Uyarıların kurum sahibine gösterilme sırası. Aynı ciddiyetteki uyarılar bu
    /// sırayla dizilir: para kaybettiren iş önce, bilgilendirme sonra. Listede
    /// olmayan tür sona düşer.
    /// </summary>
    private static readonly string[] AlertPriority =
        ["Finance", "Approval", "Consent", "Attendance", "Task", "Leave", "Document", "Account", "Library"];

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var rangeStart = (from?.ToUniversalTime() ?? now.Date);
        var rangeEnd = (to?.ToUniversalTime() ?? now.Date.AddDays(1));
        if (rangeEnd <= rangeStart || rangeEnd - rangeStart > TimeSpan.FromDays(400))
        {
            return BadRequest(new { message = "Tarih aralığı geçersiz." });
        }

        var timeZone = ResolveInstitutionTimeZone();
        var localToday = TimeZoneInfo.ConvertTimeFromUtc(now, timeZone).Date;
        var todayStart = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(localToday, DateTimeKind.Unspecified), timeZone);
        var todayEnd = todayStart.AddDays(1);
        var soon = now.AddDays(30);

        var canSee = await ResolveModuleAccessAsync(cancellationToken);
        var alerts = new List<AlertItem>();

        // ── Kişi/sınıf sayaçları: pasif hesaplar hiçbir sayıma girmez ────────────
        var students = dbContext.Students.AsNoTracking()
            .Join(dbContext.Users.AsNoTracking(), s => s.UserId, u => u.Id, (s, u) => new { s.ClassName, s.CreatedAtUtc, u.Status });
        var activeStudents = await students.CountAsync(x => x.Status != UserStatus.Passive, cancellationToken);
        var newRegistrations = await students.CountAsync(
            x => x.Status != UserStatus.Passive && x.CreatedAtUtc >= rangeStart && x.CreatedAtUtc < rangeEnd, cancellationToken);
        var activeClasses = await students
            .Where(x => x.Status != UserStatus.Passive && x.ClassName != "")
            .Select(x => x.ClassName)
            .Distinct()
            .CountAsync(cancellationToken);

        var staff = dbContext.Staff.AsNoTracking()
            .Join(dbContext.Users.AsNoTracking(), s => s.UserId, u => u.Id, (s, u) => new { s.Role, u.Status });
        var activeTeachers = await staff.CountAsync(x => x.Status != UserStatus.Passive && x.Role == UserRole.Teacher, cancellationToken);
        var activeStaff = await staff.CountAsync(x => x.Status != UserStatus.Passive, cancellationToken);
        var passiveAccounts = await dbContext.Users.AsNoTracking().CountAsync(x => x.Status == UserStatus.Passive, cancellationToken);

        // Bugünün ders sayısı program çözümlemesinin tek kaynağından okunur.
        var todayLessons = 0;
        if (tenantContext.CurrentTenantId is Guid tenantId)
        {
            var todayName = TurkishDayName(localToday.DayOfWeek);
            var entries = await ScheduleController.LoadEntriesAsync(dbContext, tenantId, cancellationToken);
            todayLessons = entries.Count(entry => string.Equals(entry.Day, todayName, StringComparison.OrdinalIgnoreCase));
        }

        // ── Yoklama ──────────────────────────────────────────────────────────────
        int? todayAbsent = null;
        int? attendanceRate = null;
        if (canSee.Attendance)
        {
            todayAbsent = await dbContext.AttendanceEntries.AsNoTracking()
                .Where(x => x.LessonDate >= todayStart && x.LessonDate < todayEnd && x.Status == "Devamsiz")
                .Select(x => x.StudentName)
                .Distinct()
                .CountAsync(cancellationToken);

            var statusCounts = await dbContext.AttendanceEntries.AsNoTracking()
                .Where(x => x.LessonDate >= rangeStart && x.LessonDate < rangeEnd)
                .GroupBy(x => x.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToListAsync(cancellationToken);
            var total = statusCounts.Sum(x => x.Count);
            attendanceRate = total == 0
                ? 0
                : (int)Math.Round(100m * statusCounts.Where(x => PresentStatuses.Contains(x.Status)).Sum(x => x.Count) / total);

            if (todayAbsent > 0)
            {
                alerts.Add(BuildAlert("Attendance", "Warning", "Bugün devamsız öğrenci",
                    $"{todayAbsent} öğrenci bugün derse gelmedi.", "/attendance"));
            }
        }

        // ── Sınavlar: planlanmış sınavlar uyumluluk anlık görüntüsünde tutulur ───
        int? upcomingExams = null;
        if (canSee.Exams)
        {
            var plannedExams = await CompatibilitySnapshotStore.LoadListAsync<PlannedExamSnapshot>(
                dbContext, PlannedExamsController.SectionKey, cancellationToken);
            upcomingExams = plannedExams.Count(exam =>
                ExamSessionsController.TryResolvePlannedStartUtc(
                    string.IsNullOrWhiteSpace(exam.StartTime) ? exam.DateLabel : $"{exam.DateLabel} {exam.StartTime}",
                    out var startsAtUtc)
                && startsAtUtc >= now && startsAtUtc <= soon);
        }

        // ── Soru kutusu: öğretmen yanıtı gelmemiş konular. Konu durumu yanıt
        // eklendiğinde "Yanıtlandı"ya çekilir (QuestionThreadService), bu yüzden
        // yanıt tablosunu taramaya gerek yok.
        int? pendingQuestions = canSee.Questions
            ? await dbContext.StudentQuestionThreads.AsNoTracking()
                .CountAsync(x => x.Status != "Yanıtlandı", cancellationToken)
            : null;

        // ── İletişim ─────────────────────────────────────────────────────────────
        int? unreadMessages = null;
        if (canSee.Chat)
        {
            var (userId, fullName) = CurrentUser();
            if (userId != Guid.Empty)
            {
                var threads = await messageService.GetThreadsAsync(userId, fullName, cancellationToken);
                unreadMessages = threads.Sum(x => x.UnreadCount);
            }
        }

        int? pendingMeetings = canSee.Meetings
            ? await dbContext.MeetingRequests.AsNoTracking().CountAsync(x => x.Status == "Bekliyor", cancellationToken)
            : null;
        int? activeAnnouncements = canSee.Announcements
            ? await dbContext.Announcements.AsNoTracking().CountAsync(cancellationToken)
            : null;

        // ── Personel / idari operasyon ───────────────────────────────────────────
        int? pendingLeaves = null;
        int? todayOnLeave = null;
        if (canSee.StaffHr)
        {
            pendingLeaves = await dbContext.StaffLeaveRequests.AsNoTracking()
                .CountAsync(x => x.Status == "Pending", cancellationToken);
            todayOnLeave = await dbContext.StaffLeaveRequests.AsNoTracking()
                .CountAsync(x => x.Status == "Approved" && x.StartDateUtc < todayEnd && x.EndDateUtc >= todayStart, cancellationToken);
        }

        int? pendingApprovals = canSee.Approvals
            ? await dbContext.ApprovalRequests.AsNoTracking().CountAsync(x => x.Status == "Pending", cancellationToken)
            : null;

        int? openTasks = null;
        int? overdueTasks = null;
        if (canSee.Tasks)
        {
            openTasks = await dbContext.AdminTasks.AsNoTracking()
                .CountAsync(x => x.Status == "Open" || x.Status == "InProgress", cancellationToken);
            overdueTasks = await dbContext.AdminTasks.AsNoTracking()
                .CountAsync(x => (x.Status == "Open" || x.Status == "InProgress")
                    && x.DueDateUtc != null && x.DueDateUtc < now, cancellationToken);
            if (overdueTasks > 0)
            {
                alerts.Add(BuildAlert("Task", "Critical", "Süresi geçmiş görev",
                    $"{overdueTasks} görevin teslim tarihi geçti.", "/admin/task-center"));
            }
        }

        int? expiringDocuments = null;
        if (canSee.Documents)
        {
            expiringDocuments = await dbContext.AdminDocuments.AsNoTracking()
                .CountAsync(x => x.Status == "Active" && x.ExpiryDateUtc != null && x.ExpiryDateUtc <= soon, cancellationToken);
            if (expiringDocuments > 0)
            {
                alerts.Add(BuildAlert("Document", "Warning", "Süresi dolan belge",
                    $"{expiringDocuments} belgenin geçerliliği 30 gün içinde bitiyor.", "/admin/documents"));
            }
        }

        int? passwordResetRequests = canSee.PasswordReset
            ? await dbContext.PasswordResetRequests.AsNoTracking().CountAsync(x => x.Status == "Pending", cancellationToken)
            : null;

        // ── Finans: yalnız finans modülü açık olan kullanıcıya ───────────────────
        decimal? collections = null;
        decimal? expenses = null;
        decimal? net = null;
        int? pendingInstallments = null;
        decimal? pendingInstallmentAmount = null;
        int? overdueInstallments = null;
        decimal? overdueInstallmentAmount = null;
        if (canSee.Finance)
        {
            // NOT: Tutarlar sunucuda toplanır ama SQL SUM yerine seçilen aralığın
            // tutar sütunu okunup bellekte toplanır — decimal toplama tüm
            // sağlayıcılarda (Postgres/SQLite) aynı sonucu versin diye.
            var paymentAmounts = await dbContext.FinancePayments.AsNoTracking()
                .Where(x => x.PaidAtUtc >= rangeStart && x.PaidAtUtc < rangeEnd)
                .Select(x => x.Amount)
                .ToListAsync(cancellationToken);
            collections = paymentAmounts.Sum();

            // Gider = işletme gideri (ortak /finance/expenses defteri) + bordro + fatura.
            // Ana paneldeki kazanç/gider grafiği de aynı üç kaynağı toplar.
            var operationalExpenseAmounts = await dbContext.DrivingExpenses.AsNoTracking()
                .Where(x => x.ExpenseDateUtc >= rangeStart && x.ExpenseDateUtc < rangeEnd)
                .Select(x => x.Amount)
                .ToListAsync(cancellationToken);
            var operationalExpense = operationalExpenseAmounts.Sum();
            var salaryAmounts = await dbContext.AccountingSalaries.AsNoTracking()
                .Where(x => x.CreatedAtUtc >= rangeStart && x.CreatedAtUtc < rangeEnd)
                .Select(x => x.Amount)
                .ToListAsync(cancellationToken);
            var invoiceAmounts = await dbContext.AccountingInvoices.AsNoTracking()
                .Where(x => x.CreatedAtUtc >= rangeStart && x.CreatedAtUtc < rangeEnd)
                .Select(x => x.Amount)
                .ToListAsync(cancellationToken);
            expenses = operationalExpense
                + salaryAmounts.Sum(MoneyParser.Parse)
                + invoiceAmounts.Sum(MoneyParser.Parse);
            net = collections - expenses;

            var openInstallments = await dbContext.FinanceInstallments.AsNoTracking()
                .Where(x => x.Amount > x.PaidAmount)
                .Select(x => new { Remaining = x.Amount - x.PaidAmount, x.DueDateUtc })
                .ToListAsync(cancellationToken);
            pendingInstallments = openInstallments.Count;
            pendingInstallmentAmount = openInstallments.Sum(x => x.Remaining);
            var overdue = openInstallments.Where(x => x.DueDateUtc < now).ToList();
            overdueInstallments = overdue.Count;
            overdueInstallmentAmount = overdue.Sum(x => x.Remaining);

            if (overdueInstallments > 0)
            {
                alerts.Add(BuildAlert("Finance", "Critical", "Geciken tahsilat",
                    $"{overdueInstallments} taksitin vadesi geçti · ₺{overdueInstallmentAmount:N0}", "/finance/late-payments"));
            }
        }

        // ── Yan modüller ─────────────────────────────────────────────────────────
        int? overdueLoans = null;
        if (canSee.Library)
        {
            overdueLoans = await dbContext.LibraryLoans.AsNoTracking()
                .CountAsync(x => x.ReturnedAtUtc == null && x.DueAtUtc < now, cancellationToken);
            if (overdueLoans > 0)
            {
                alerts.Add(BuildAlert("Library", "Warning", "Gecikmiş kitap",
                    $"{overdueLoans} ödünç kitabın iade tarihi geçti.", "/library"));
            }
        }

        int? pendingGuidance = canSee.Guidance
            ? await dbContext.GuidanceAppointments.AsNoTracking().CountAsync(x => x.Status == "Bekliyor", cancellationToken)
            : null;

        // İmza bekleyen onam formu: tablete gönderilmiş ama imzalanmamış kayıt.
        // Taslak (henüz tablete gitmemiş) sayılmaz — o personelin elindeki iş değil.
        int? pendingConsentForms = null;
        if (canSee.Consent)
        {
            pendingConsentForms = await dbContext.ConsentFormRecords.AsNoTracking()
                .CountAsync(x => x.Status == ConsentFormStatus.AwaitingSignature, cancellationToken);
            if (pendingConsentForms > 0)
            {
                alerts.Add(BuildAlert("Consent", "Warning", "İmzasız evrak",
                    $"{pendingConsentForms} onam formu imza bekliyor.", "/students"));
            }
        }

        int? activeServiceRoutes = null;
        if (canSee.Service)
        {
            activeServiceRoutes = await dbContext.ServiceRoutes.AsNoTracking().CountAsync(x => x.IsActive, cancellationToken);
        }

        if (pendingApprovals > 0)
        {
            alerts.Add(BuildAlert("Approval", "Warning", "Bekleyen onay",
                $"{pendingApprovals} talep yönetici onayı bekliyor.", "/admin/personnel-approvals"));
        }
        if (pendingLeaves > 0)
        {
            alerts.Add(BuildAlert("Leave", "Warning", "Bekleyen izin talebi",
                $"{pendingLeaves} personel izin talebi karar bekliyor.", "/admin/staff-hr"));
        }
        if (passwordResetRequests > 0)
        {
            alerts.Add(BuildAlert("Account", "Warning", "Şifre sıfırlama talebi",
                $"{passwordResetRequests} kullanıcı şifre sıfırlama bekliyor.", "/admin/password-reset-requests"));
        }

        // ── Son 6 ayın yeni kayıt eğilimi ────────────────────────────────────────
        var seriesStart = new DateTime(localToday.Year, localToday.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-5);
        var monthlyRegistrations = await dbContext.Students.AsNoTracking()
            .Where(x => x.CreatedAtUtc >= seriesStart)
            .GroupBy(x => new { x.CreatedAtUtc.Year, x.CreatedAtUtc.Month })
            .Select(x => new { x.Key.Year, x.Key.Month, Count = x.Count() })
            .ToListAsync(cancellationToken);
        var registrationSeries = Enumerable.Range(0, 6).Select(offset =>
        {
            var month = seriesStart.AddMonths(offset);
            return new
            {
                label = month.ToString("MMM", System.Globalization.CultureInfo.GetCultureInfo("tr-TR")),
                value = monthlyRegistrations.FirstOrDefault(x => x.Year == month.Year && x.Month == month.Month)?.Count ?? 0,
            };
        }).ToList();

        Response.Headers.CacheControl = "no-store, private";
        Response.Headers.Pragma = "no-cache";

        return Ok(new
        {
            generatedAtUtc = now,
            rangeFromUtc = rangeStart,
            rangeToUtc = rangeEnd,
            kpis = new
            {
                activeStudents,
                activeTeachers,
                activeStaff,
                activeClasses,
                todayLessons,
                newRegistrations,
                passiveAccounts,
                todayAbsent,
                attendanceRate,
                upcomingExams,
                pendingQuestions,
                unreadMessages,
                pendingMeetings,
                activeAnnouncements,
                pendingLeaves,
                todayOnLeave,
                pendingApprovals,
                openTasks,
                overdueTasks,
                expiringDocuments,
                passwordResetRequests,
                collections,
                expenses,
                net,
                pendingInstallments,
                pendingInstallmentAmount,
                overdueInstallments,
                overdueInstallmentAmount,
                overdueLoans,
                pendingGuidance,
                pendingConsentForms,
                activeServiceRoutes,
            },
            // Panonun EN ÜSTÜNDEKİ eylem bloğunu bu liste besler: önce kritikler,
            // sonra kurum sahibinin müdahale sırası (para → onay → evrak → devamsızlık…).
            alerts = alerts
                .OrderBy(x => x.Severity == "Critical" ? 0 : 1)
                .ThenBy(x => Array.IndexOf(AlertPriority, x.Type) is var index && index >= 0 ? index : AlertPriority.Length)
                .ToList(),
            charts = new { monthlyRegistrations = registrationSeries },
        });
    }

    /// <summary>
    /// Yeni kurum kurulum sihirbazı: kurumun "yayına hazır" olması için gereken
    /// adımlar ve hangilerinin bittiği. Adımlar BAĞIMLILIK sırasındadır —
    /// sınıf olmadan program, program olmadan sağlıklı kayıt kurulamaz.
    ///
    /// <para>Her adım kendi verisinden hesaplanır (kullanıcının "bitti" işaretine
    /// güvenilmez): kurum bir adımı başka bir ekrandan tamamladıysa sihirbaz da
    /// bunu görür. Hepsi bitince <c>completed</c> true döner ve istemci bloğu
    /// hiç çizmez.</para>
    /// </summary>
    [HttpGet("setup")]
    public async Task<IActionResult> GetSetup(CancellationToken cancellationToken)
    {
        // Sınıf defteri ClassesController ile AYNI iki kaynağın birleşimidir:
        // elle tanımlanan sınıflar + öğrencilerin sınıf adları. Yalnız birine
        // bakmak, sınıfları zaten dolu bir kuruma "sınıf tanımlayın" derdi.
        var registeredClasses = await dbContext.PlatformConfigurations.AsNoTracking()
            .Where(x => x.ConfigurationType == ClassRegistryType || x.ConfigurationType == ClassManagementType)
            .Select(x => x.DisplayName)
            .ToListAsync(cancellationToken);
        var studentClasses = await dbContext.Students.AsNoTracking()
            .Where(x => x.ClassName != "")
            .Select(x => x.ClassName)
            .Distinct()
            .ToListAsync(cancellationToken);
        var classCount = registeredClasses.Concat(studentClasses)
            .Select(CompatibilitySnapshotStore.NormalizeClassName)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count();

        var teacherCount = await dbContext.Staff.AsNoTracking()
            .Join(dbContext.Users.AsNoTracking(), s => s.UserId, u => u.Id, (s, u) => new { s.Role, u.Status })
            .CountAsync(x => x.Status != UserStatus.Passive && x.Role == UserRole.Teacher, cancellationToken);

        var lessonCount = 0;
        if (tenantContext.CurrentTenantId is Guid tenantId)
        {
            var entries = await ScheduleController.LoadEntriesAsync(dbContext, tenantId, cancellationToken);
            lessonCount = entries.Count;
        }

        // "Ücret planı" kurumda ayrı bir varlık değil: ücret her öğrencinin kayıt
        // sözleşmesinde yaşar. Bu yüzden adım "ilk kayıt + ücret sözleşmesi"dir.
        var contractCount = await dbContext.EnrollmentContracts.AsNoTracking()
            .CountAsync(cancellationToken);

        var steps = new[]
        {
            BuildStep("classes", "Sınıfları tanımlayın", classCount,
                "Öğrenci kaydı, yoklama ve ders programı sınıf listesine dayanır.",
                "/classes", "Sınıf ekle", "sınıf tanımlı"),
            BuildStep("teachers", "Öğretmenleri ekleyin", teacherCount,
                "Kadronuzu tanıtın; ders programı ve sınıf atamaları için gerekli.",
                "/admin/staff-registration", "Öğretmen ekle", "öğretmen kayıtlı"),
            BuildStep("schedule", "Ders programını kurun", lessonCount,
                "Haftalık program; yoklama ve günlük ders sayacının kaynağıdır.",
                "/schedule", "Programı aç", "ders saati planlı"),
            BuildStep("enrollment", "İlk kaydı ve ücret sözleşmesini oluşturun", contractCount,
                "Ücret ve taksit planı öğrencinin kayıt sözleşmesinde tutulur.",
                "/admin/student-registration", "Öğrenci kaydet", "kayıt sözleşmesi"),
        };

        Response.Headers.CacheControl = "no-store, private";

        return Ok(new
        {
            completed = steps.All(x => x.Done),
            completedSteps = steps.Count(x => x.Done),
            totalSteps = steps.Length,
            steps,
        });
    }

    private static SetupStep BuildStep(
        string key, string title, int count, string description,
        string actionPath, string actionLabel, string countLabel)
        => new(key, title, description, count > 0, count, countLabel, actionPath, actionLabel);

    private sealed record SetupStep(
        string Key, string Title, string Description, bool Done,
        int Count, string CountLabel, string ActionPath, string ActionLabel);

    private (Guid UserId, string FullName) CurrentUser()
    {
        var raw = User.FindFirstValue("nameid") ?? User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return (Guid.TryParse(raw, out var userId) ? userId : Guid.Empty, User.FindFirstValue("name") ?? string.Empty);
    }

    private static AlertItem BuildAlert(string type, string severity, string title, string message, string actionPath)
        => new(type, severity, title, message, actionPath);

    private sealed record AlertItem(string Type, string Severity, string Title, string Message, string ActionPath);

    /// <summary>
    /// Panoya hangi modülün sayaçlarının yazılabileceğini paket + özel rol kapısından
    /// geçirerek belirler. Kapalı modülün sorgusu hiç çalıştırılmaz.
    /// </summary>
    private async Task<ModuleAccess> ResolveModuleAccessAsync(CancellationToken cancellationToken)
    {
        Task<bool> Allowed(string module) => entitlementService.IsAllowedAsync(User, module, null, cancellationToken);
        return new ModuleAccess(
            Attendance: await Allowed("attendance"),
            Exams: await Allowed("exams"),
            Questions: await Allowed("questions"),
            Chat: await Allowed("chat"),
            Meetings: await Allowed("meetings"),
            Announcements: await Allowed("notifications"),
            StaffHr: await Allowed("staff-hr"),
            Approvals: await Allowed("approvals"),
            Tasks: await Allowed("tasks"),
            Documents: await Allowed("documents"),
            PasswordReset: await Allowed("password-reset"),
            Finance: await Allowed("finance"),
            Library: await Allowed("library"),
            Guidance: await Allowed("guidance"),
            Service: await Allowed("service"),
            // Onam formları öğrenci modülünün bir özelliğidir (ConsentController ile aynı kapı).
            Consent: await entitlementService.IsAllowedAsync(User, "students", "consent", cancellationToken));
    }

    private sealed record ModuleAccess(
        bool Attendance,
        bool Exams,
        bool Questions,
        bool Chat,
        bool Meetings,
        bool Announcements,
        bool StaffHr,
        bool Approvals,
        bool Tasks,
        bool Documents,
        bool PasswordReset,
        bool Finance,
        bool Library,
        bool Guidance,
        bool Service,
        bool Consent);

    private static string TurkishDayName(DayOfWeek day) => day switch
    {
        DayOfWeek.Monday => "Pazartesi",
        DayOfWeek.Tuesday => "Salı",
        DayOfWeek.Wednesday => "Çarşamba",
        DayOfWeek.Thursday => "Perşembe",
        DayOfWeek.Friday => "Cuma",
        DayOfWeek.Saturday => "Cumartesi",
        _ => "Pazar",
    };

    private static TimeZoneInfo ResolveInstitutionTimeZone()
    {
        foreach (var id in new[] { "Europe/Istanbul", "Turkey Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }

        return TimeZoneInfo.CreateCustomTimeZone("TR", TimeSpan.FromHours(3), "Türkiye", "Türkiye");
    }
}
