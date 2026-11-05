using CourseIntellect.Application.DTOs.Assistant;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Öğrenci Başarı Raporu (6 sayfalık PDF) için veri. Asistanın öğrenci raporu, masaüstü Rapor
/// Merkezi ve mobil rapor ekranı aynı uçtan aynı PDF'i alır.
///
/// Kapsam: öğrenci yalnız kendini, veli çocuklarını, öğretmen ders verdiği sınıfları, yönetici
/// kurumdaki öğrencileri görür (sohbetteki hedef çözümüyle aynı kural). Rapor akademiktir:
/// muhasebe ve idari portal alamaz (GetStudentReport niyetinin kapısı).
/// </summary>
public sealed partial class AssistantService
{
    public async Task<(byte[] Content, string FileName)?> GetStudentSuccessPdfAsync(AssistantRequestContext context, Guid studentId, CancellationToken cancellationToken)
    {
        if (!await CanAsync(context, AssistantIntent.GetStudentReport, cancellationToken)) return null;
        var student = await ScopedStudentAsync(context, studentId, cancellationToken);
        if (student is null) return null;
        var report = await BuildSuccessReportAsync(context, student, cancellationToken);
        var slug = System.Text.RegularExpressions.Regex.Replace(RuleBasedAssistantIntentResolver.Fold(student.FullName), "[^a-z0-9]+", "-").Trim('-');
        return (StudentSuccessReportPdf.Render(report), $"ogrenci-basari-raporu-{(slug.Length > 0 ? slug : "ogrenci")}-{DateTime.UtcNow.AddHours(3):yyyyMMdd}.pdf");
    }

    /// <summary>Öğrenci profil ya da kullanıcı kimliğiyle; yalnız kullanıcının erişebildiği öğrenciler arasından.</summary>
    private async Task<StudentCandidate?> ScopedStudentAsync(AssistantRequestContext context, Guid studentId, CancellationToken ct)
    {
        bool Matches(StudentCandidate candidate) => candidate.Id == studentId || candidate.UserId == studentId;
        var portal = AssistantIntentCatalog.PortalOf(context.PrimaryRole);
        return portal switch
        {
            "student" => (await db.Students.AsNoTracking().Where(x => x.UserId == context.UserId).Select(ToStudentCandidate()).ToListAsync(ct)).FirstOrDefault(Matches),
            "parent" => (await ParentChildrenAsync(context, ct)).FirstOrDefault(Matches),
            "" => null,
            _ => (await StaffRosterAsync(context, portal, ct)).Select(entry => entry.Candidate).FirstOrDefault(Matches),
        };
    }

    private async Task<StudentSuccessReport> BuildSuccessReportAsync(AssistantRequestContext context, StudentCandidate student, CancellationToken ct)
    {
        var name = RuleBasedAssistantIntentResolver.Fold(student.FullName);
        var className = student.ClassName;
        bool Same(string other) => RuleBasedAssistantIntentResolver.Fold(other) == name;
        var institution = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.Id == context.TenantId).Select(x => x.Name).FirstOrDefaultAsync(ct) ?? string.Empty;

        // Sınav sonuçları öğrenci kimliğiyle eşlenir; kimliğe bağlanmamış eski sonuçta ad
        // (büyük/küçük harf ve Türkçe karakter farkı katlanarak) kullanılır.
        bool Mine(Guid? linkedId, string studentName) => linkedId is { } id ? id == student.Id : Same(studentName);
        var classResults = await db.ExamResults.AsNoTracking()
            .Where(x => x.ClassName == className)
            .Select(x => new { x.StudentId, x.StudentName, x.ExamTitle, x.Subject, x.DateLabel, x.Score, x.Net })
            .ToListAsync(ct);
        var mine = classResults.Where(x => Mine(x.StudentId, x.StudentName))
            .Select(x => new { x.ExamTitle, x.Subject, x.Score, x.Net, Date = AssistantDates.TryParse(x.DateLabel), x.DateLabel })
            .OrderBy(x => x.Date ?? DateTime.MinValue)
            .ToList();
        double? average = mine.Count > 0 ? Math.Round(mine.Average(x => (double)x.Score), 1) : null;
        double? classAverage = classResults.Count > 0 ? Math.Round(classResults.Average(x => (double)x.Score), 1) : null;
        // Sıralama anahtarı kimlik (yoksa ad): aynı adlı iki öğrenci tek kişi sayılmaz.
        var myKey = $"id:{student.Id}";
        var ranking = classResults
            .GroupBy(x => x.StudentId is { } id ? $"id:{id}" : Same(x.StudentName) ? myKey : $"name:{RuleBasedAssistantIntentResolver.Fold(x.StudentName)}")
            .Select(group => (Key: group.Key, Average: group.Average(x => (double)x.Score)))
            .OrderByDescending(x => x.Average).ToList();
        var rankIndex = ranking.FindIndex(x => x.Key == myKey);
        var classSize = await db.Students.AsNoTracking().CountAsync(x => x.ClassName == className, ct);

        // Devam: bütün yoklama kayıtları (ders bazında).
        var attendance = (await db.AttendanceEntries.AsNoTracking().Where(x => x.ClassName == className)
                .Select(x => new { x.StudentId, x.StudentName, x.Status }).ToListAsync(ct))
            .Where(x => Mine(x.StudentId, x.StudentName)).ToList();
        var absent = attendance.Count(x => AttendanceStatusMatcher.IsAbsent(x.Status));
        double? attendanceRate = attendance.Count > 0 ? Math.Round(100.0 * (attendance.Count - absent) / attendance.Count, 1) : null;

        // Ödev: sınıfa verilenlerden teslim edilenlerin oranı.
        var assignments = await db.HomeworkAssignments.AsNoTracking().Where(x => x.ClassName == className).Select(x => x.Id).ToListAsync(ct);
        var submittedIds = (await db.HomeworkSubmissions.AsNoTracking().Where(x => assignments.Contains(x.AssignmentId))
                .Select(x => new { x.AssignmentId, x.StudentName, x.StudentUserId }).ToListAsync(ct))
            .Where(x => x.StudentUserId == student.UserId || Same(x.StudentName))
            .Select(x => x.AssignmentId).Distinct().Count();
        double? homeworkRate = assignments.Count > 0 ? Math.Round(100.0 * submittedIds / assignments.Count, 1) : null;

        // Optik denemeler: öğrencinin ve sınıfın ders bazlı netleri.
        var classUserIds = await db.Students.AsNoTracking().Where(x => x.ClassName == className).Select(x => x.UserId).ToListAsync(ct);
        var optical = await (from row in db.OpticalExamStudentResults.AsNoTracking()
                             join exam in db.OpticalExams.AsNoTracking() on row.OpticalExamId equals exam.Id
                             where classUserIds.Contains(row.StudentUserId)
                             select new { exam.Id, exam.Title, exam.ExamDateUtc, row.StudentUserId, row.Subject, row.Correct, row.Wrong, row.Blank, row.Net })
            .ToListAsync(ct);
        var myOptical = optical.Where(x => x.StudentUserId == student.UserId).OrderByDescending(x => x.ExamDateUtc).ToList();

        // Ders bazlı: elle girilen sınav puanı varsa o, yoksa deneme neti.
        double? ClassSubjectAverage(string subject)
        {
            var scores = classResults.Where(x => x.Subject == subject).Select(x => (double)x.Score).ToList();
            return scores.Count > 0 ? Math.Round(scores.Average(), 1) : null;
        }
        var subjects = mine.GroupBy(x => x.Subject)
            .Select(group => new SuccessSubjectRow(group.Key, Math.Round(group.Average(x => (double)x.Score), 1), ClassSubjectAverage(group.Key), group.Count(), "puan"))
            .ToList();
        foreach (var group in myOptical.GroupBy(x => x.Subject).Where(group => subjects.All(s => s.Subject != group.Key)))
        {
            var classNets = optical.Where(x => x.Subject == group.Key).Select(x => (double)x.Net).ToList();
            subjects.Add(new(group.Key, Math.Round(group.Average(x => (double)x.Net), 1), classNets.Count > 0 ? Math.Round(classNets.Average(), 1) : null, group.Count(), "net"));
        }
        subjects = subjects.OrderByDescending(x => x.Count).ThenBy(x => x.Subject).ToList();

        var insight = await insights.GetStudentAsync(student.UserId, ct);
        SuccessTopicRow Topic(Application.DTOs.Insights.TopicInsightDto topic) => new(topic.Subject, topic.Topic, (double)topic.SuccessRate,
            topic.ClassSuccessRate is decimal rate ? (double)rate : null, topic.Diagnosis, topic.Trend, topic.Solved,
            topic.Priority, topic.SuggestedQuestions);

        var pending = (await HomeworkAsync(Guid.Empty, student, false, Voice(context, Guid.NewGuid()), ct)).Data is { } homeworkData
            && System.Text.Json.JsonSerializer.SerializeToElement(homeworkData, JsonOptions).TryGetProperty("items", out var items)
            ? items.GetArrayLength() : 0;

        return new StudentSuccessReport(
            institution,
            student.FullName,
            className,
            student.SchoolNumber ?? string.Empty,
            $"SA-{DateTime.UtcNow.AddHours(3):yyyyMMdd}-{student.Id.ToString("N")[..6].ToUpperInvariant()}",
            DateTime.UtcNow,
            average,
            classAverage,
            attendanceRate,
            absent,
            attendance.Count,
            homeworkRate,
            pending,
            mine.Count,
            rankIndex >= 0 && mine.Count > 0 ? rankIndex + 1 : null,
            Math.Max(classSize, ranking.Count),
            insight is { Solved: > 0 } ? (double)insight.SuccessRate : null,
            insight?.Solved ?? 0,
            subjects,
            insight?.WeakTopics.Select(Topic).ToList() ?? [],
            insight?.StrongTopics.Select(Topic).ToList() ?? [],
            mine.OrderByDescending(x => x.Date ?? DateTime.MinValue)
                .Select(x => new SuccessExamRow(x.Date is DateTime date ? AssistantDates.Short(date) : x.DateLabel, x.ExamTitle, x.Subject, x.Score, x.Net > 0 ? (double)x.Net : null))
                .ToList(),
            myOptical.Select(x => new SuccessOpticalRow(AssistantDates.Short(x.ExamDateUtc.AddHours(3)), x.Title, x.Subject, x.Correct, x.Wrong, x.Blank, Math.Round((double)x.Net, 2))).ToList(),
            mine.GroupBy(x => new { x.ExamTitle, x.Date }).OrderBy(x => x.Key.Date ?? DateTime.MinValue)
                .Select(group => new SuccessTrendPoint(group.Key.Date is DateTime date ? date.ToString("dd.MM") : group.Key.ExamTitle, Math.Round(group.Average(x => (double)x.Score), 1)))
                .TakeLast(12).ToList(),
            myOptical.GroupBy(x => new { x.Id, x.ExamDateUtc }).OrderBy(x => x.Key.ExamDateUtc)
                .Select(group => new SuccessTrendPoint(group.Key.ExamDateUtc.AddHours(3).ToString("dd.MM"), Math.Round(group.Sum(x => (double)x.Net), 1)))
                .TakeLast(12).ToList());
    }
}
