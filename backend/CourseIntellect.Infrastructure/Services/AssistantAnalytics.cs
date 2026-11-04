using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using CourseIntellect.Application.DTOs.Assistant;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Analiz ve rapor araçları: devamsızlık sıralaması, sınav eğilimi, sınıf kıyası, erken uyarı,
/// sınıf özeti, finans raporu ve öğrenci raporu. Hepsi "report" kartı üretir (metrik, tablo,
/// grafik, bölüm, not) ve aynı kart PDF'e dökülür. Bütün sayılar burada hesaplanır; model
/// yalnız kısa yorum yazar.
///
/// Kapsam: öğretmen yalnız derse girdiği sınıfları, veli çocuklarını, öğrenci kendini görür
/// (<see cref="AgentStudentAsync"/>, <see cref="AgentClassesAsync"/>, <see cref="StaffRosterAsync"/>).
/// </summary>
public sealed partial class AssistantService
{
    private static readonly CultureInfo EnCulture = CultureInfo.GetCultureInfo("en-US");

    private sealed record ReportColumn(string Key, string Label, string Align = "left");
    private sealed record ReportSeries(string Key, string Label);
    private sealed record ReportChart(string Kind, string X, IReadOnlyList<ReportSeries> Series);
    private sealed record ReportMetric(string Label, string Value, string Tone = "info");
    private sealed record ReportSection(string Title, IReadOnlyList<string> Lines);
    private sealed record ReportData(
        string Kind,
        string Title,
        string Subtitle,
        IReadOnlyList<ReportMetric> Metrics,
        IReadOnlyList<ReportColumn> Columns,
        IReadOnlyList<Dictionary<string, object?>> Rows,
        ReportChart? Chart,
        IReadOnlyList<ReportSection> Sections,
        IReadOnlyList<string> Notes,
        Guid? StudentId = null);

    private static string L(AgentState state, string tr, string en) => state.Voice.English ? en : tr;
    private static string Num(AgentState state, double value) => Math.Round(value, 1).ToString("0.#", state.Voice.English ? EnCulture : TrCulture);
    private static string Money(AgentState state, decimal value) => state.Voice.English ? $"₺{value.ToString("N0", EnCulture)}" : $"{value.ToString("N0", TrCulture)} ₺";
    private static double Round1(double value) => Math.Round(value, 1, MidpointRounding.AwayFromZero);

    /// <summary>Rapor kartı + modele giden özet. Satırların yalnız ilk 15'i modele gider.</summary>
    private static ToolOutcome Report(AgentState state, AssistantIntent intent, ReportData data, string summary, bool terminal = false)
    {
        var card = Build(state.Conversation.Id, "report", summary, data, intent);
        var forModel = JsonSerializer.Serialize(new
        {
            ozet = summary,
            metrikler = data.Metrics.Select(metric => $"{metric.Label}: {metric.Value}"),
            satirlar = data.Rows.Take(15),
            bolumler = data.Sections,
            notlar = data.Notes,
        }, JsonOptions);
        return new(forModel.Length <= ToolOutputLimit ? forModel : forModel[..ToolOutputLimit] + "…", card, terminal);
    }

    private ToolOutcome EmptyReport(AgentState state, AssistantIntent intent, string? text = null) =>
        new(string.Empty, Build(state.Conversation.Id, "text", text ?? state.Voice.ReportEmpty(), null, intent), true);

    /// <summary>Kullanıcının kapsamındaki öğrenciler; sınıf belirtildiyse o sınıflar.</summary>
    private async Task<List<StudentCandidate>> ScopedStudentsAsync(AgentState state, IReadOnlyCollection<string>? classes, CancellationToken ct)
    {
        var roster = (await StaffRosterAsync(state.Context, state.Voice.Portal, ct)).Select(entry => entry.Candidate);
        if (classes is not null)
        {
            var wanted = classes.Select(NormalizeClass).ToHashSet();
            roster = roster.Where(student => wanted.Contains(NormalizeClass(student.ClassName)));
        }
        return roster.ToList();
    }

    /// <summary>Son <paramref name="days"/> gündeki yoklama kayıtları, öğrenci adı başına (devamsız, geç, toplam).</summary>
    /// <summary>
    /// Öğrenci başına (profil kimliği) devamsızlık sayıları. Kimliğe bağlı kayıt yalnız
    /// kendi öğrencisine, bağlanmamış eski kayıt aynı adlı öğrenciye sayılır; aynı adlı
    /// iki öğrencinin devamsızlığı birbirine karışmaz.
    /// </summary>
    private async Task<Dictionary<Guid, (int Absent, int Late, int Total)>> AttendanceCountsAsync(IReadOnlyCollection<StudentCandidate> students, int days, CancellationToken ct)
    {
        var since = DateTime.UtcNow.Date.AddDays(-(days - 1));
        var ids = students.Select(x => (Guid?)x.Id).Distinct().ToList();
        var names = students.Select(x => x.FullName).Distinct().ToList();
        var grouped = await db.AttendanceEntries.AsNoTracking()
            .Where(x => x.LessonDate >= since && (ids.Contains(x.StudentId) || (x.StudentId == null && names.Contains(x.StudentName))))
            .GroupBy(x => new { x.StudentId, x.StudentName, x.Status })
            .Select(group => new { group.Key.StudentId, group.Key.StudentName, group.Key.Status, Count = group.Count() })
            .ToListAsync(ct);
        return students
            .GroupBy(x => x.Id)
            .Select(group => group.First())
            .ToDictionary(
                student => student.Id,
                student =>
                {
                    var rows = grouped.Where(x => x.StudentId is { } linked ? linked == student.Id : x.StudentName == student.FullName).ToList();
                    return (rows.Where(x => AttendanceStatusMatcher.IsAbsent(x.Status)).Sum(x => x.Count),
                            rows.Where(x => AttendanceStatusMatcher.IsLate(x.Status)).Sum(x => x.Count),
                            rows.Sum(x => x.Count));
                });
    }

    // ── Devamsızlık sıralaması ──────────────────────────────────────────────

    private async Task<ToolOutcome> AttendanceRankingAsync(AgentState state, JsonElement args, CancellationToken ct)
    {
        const AssistantIntent intent = AssistantIntent.GetAttendanceRanking;
        var days = Math.Clamp(Int(args, "days") ?? 30, 1, 365);
        var top = Math.Clamp(Int(args, "top") ?? 10, 1, 50);
        var requested = Str(args, "class_name");
        var (classes, stop) = await AgentClassesAsync(state, requested, ct);
        if (stop is not null) return stop;

        var students = await ScopedStudentsAsync(state, requested.Length > 0 ? classes : null, ct);
        var counts = await AttendanceCountsAsync(students, days, ct);
        var ranked = students
            .GroupBy(x => x.Id).Select(group => group.First())
            .Select(student => (Student: student, Counts: counts.GetValueOrDefault(student.Id)))
            .Where(item => item.Counts.Absent > 0)
            .OrderByDescending(item => item.Counts.Absent).ThenByDescending(item => item.Counts.Late).ThenBy(item => item.Student.FullName)
            .ToList();

        var period = L(state, $"Son {days} gün", $"Last {days} days");
        var scope = requested.Length > 0 ? string.Join(", ", classes) : L(state, state.Voice.Portal == "teacher" ? "Sınıflarınız" : "Tüm sınıflar", state.Voice.Portal == "teacher" ? "Your classes" : "All classes");
        if (ranked.Count == 0)
            return EmptyReport(state, intent, L(state, $"{period} içinde {scope} için devamsızlık kaydı yok.", $"No absences recorded for {scope} in the {period.ToLowerInvariant()}."));

        var shown = ranked.Take(top).ToList();
        var rows = shown.Select((item, index) => new Dictionary<string, object?>
        {
            ["rank"] = index + 1,
            ["student"] = item.Student.FullName,
            ["className"] = item.Student.ClassName,
            ["absent"] = item.Counts.Absent,
            ["late"] = item.Counts.Late,
            ["total"] = item.Counts.Total,
        }).ToList();
        var data = new ReportData("attendance_ranking",
            L(state, "En çok devamsızlık yapanlar", "Most absences"),
            $"{scope} · {period}",
            [
                new(L(state, "Devamsızlığı olan öğrenci", "Students with absences"), ranked.Count.ToString(TrCulture), "warn"),
                new(L(state, "Toplam devamsız ders", "Total missed lessons"), ranked.Sum(x => x.Counts.Absent).ToString(TrCulture)),
                new(L(state, "Dönem", "Period"), period),
            ],
            [
                new("rank", "#", "right"),
                new("student", L(state, "Öğrenci", "Student")),
                new("className", L(state, "Sınıf", "Class")),
                new("absent", L(state, "Devamsız ders", "Missed"), "right"),
                new("late", L(state, "Geç", "Late"), "right"),
                new("total", L(state, "Yoklama", "Records"), "right"),
            ],
            rows,
            new("bar", "student", [new("absent", L(state, "Devamsız ders", "Missed lessons"))]),
            [],
            [L(state, "Sayılar ders bazındadır: bir gün 6 derse gelmeyen öğrenci 6 devamsız ders sayılır.", "Counts are per lesson.")]);
        var leaders = string.Join(", ", shown.Take(3).Select(item => $"{item.Student.FullName} ({item.Counts.Absent})"));
        return Report(state, intent, data, L(state, $"{period} içinde en çok devamsızlık yapanlar: {leaders}.", $"Most absences in the {period.ToLowerInvariant()}: {leaders}."));
    }

    // ── Sınav eğilimi ───────────────────────────────────────────────────────

    private sealed record TrendExam(DateTime? Date, string Title, Dictionary<string, double> Values, double? Total);

    private async Task<ToolOutcome> ExamTrendAsync(AgentState state, JsonElement args, CancellationToken ct)
    {
        const AssistantIntent intent = AssistantIntent.GetExamTrend;
        var lastN = Math.Clamp(Int(args, "last_n") ?? 5, 2, 12);
        var subject = RuleBasedAssistantIntentResolver.Fold(Str(args, "subject"));
        List<Guid> userIds;
        List<string> names;
        string scope;

        // Öğrenci ve veli yalnız kendi/çocuğunun eğilimini görür; personel öğrenci adı verirse tek öğrenci, yoksa sınıf.
        if (state.Voice.Portal is "student" or "parent" || Str(args, "student").Length > 0)
        {
            var (student, stop) = await AgentStudentAsync(state, args, intent, ct);
            if (stop is not null) return stop;
            userIds = [student!.UserId];
            names = [student.FullName];
            scope = student.FullName;
        }
        else
        {
            var requested = Str(args, "class_name");
            var (classes, stop) = await AgentClassesAsync(state, requested, ct);
            if (stop is not null) return stop;
            var students = await ScopedStudentsAsync(state, requested.Length > 0 ? classes : null, ct);
            userIds = students.Select(x => x.UserId).Distinct().ToList();
            names = students.Select(x => x.FullName).Distinct().ToList();
            scope = requested.Length > 0 ? string.Join(", ", classes) : L(state, state.Voice.Portal == "teacher" ? "Sınıflarınız" : "Tüm sınıflar", state.Voice.Portal == "teacher" ? "Your classes" : "All classes");
        }

        bool SubjectMatches(string value)
        {
            if (subject.Length == 0) return true;
            var folded = RuleBasedAssistantIntentResolver.Fold(value);
            return folded.Contains(subject) || subject.Contains(folded);
        }

        // Optik denemeler gerçek tarih ve net taşır; varsa onlar esas alınır. Yoksa elle girilen sınav sonuçları (puan).
        var optical = await (from result in db.OpticalExamStudentResults.AsNoTracking()
                             join exam in db.OpticalExams.AsNoTracking() on result.OpticalExamId equals exam.Id
                             where userIds.Contains(result.StudentUserId)
                             select new { ExamId = exam.Id, exam.Title, exam.ExamDateUtc, result.StudentUserId, result.Subject, result.Net })
            .ToListAsync(ct);
        optical = optical.Where(x => SubjectMatches(x.Subject)).ToList();

        List<TrendExam> exams;
        string unit;
        if (optical.Count > 0)
        {
            unit = "net";
            exams = optical.GroupBy(x => x.ExamId).Select(group => new TrendExam(
                    group.First().ExamDateUtc.AddHours(3).Date,
                    group.First().Title,
                    group.GroupBy(x => x.Subject).ToDictionary(item => item.Key, item => Round1(item.Average(x => (double)x.Net))),
                    subject.Length == 0 ? Round1(group.GroupBy(x => x.StudentUserId).Average(student => student.Sum(x => (double)x.Net))) : null))
                .ToList();
        }
        else
        {
            unit = L(state, "puan", "points");
            var classic = (await db.ExamResults.AsNoTracking().Where(x => names.Contains(x.StudentName))
                    .Select(x => new { x.ExamTitle, x.DateLabel, x.Subject, x.Score }).ToListAsync(ct))
                .Where(x => SubjectMatches(x.Subject)).ToList();
            exams = classic.GroupBy(x => new { x.ExamTitle, x.DateLabel }).Select(group => new TrendExam(
                    AssistantDates.TryParse(group.Key.DateLabel),
                    group.Key.ExamTitle,
                    group.GroupBy(x => x.Subject).ToDictionary(item => item.Key, item => Round1(item.Average(x => (double)x.Score))),
                    null))
                .ToList();
        }
        if (exams.Count == 0) return EmptyReport(state, intent, L(state, $"{scope} için eğilim çıkaracak sınav sonucu bulamadım.", $"I couldn't find exam results for {scope}."));

        exams = exams.OrderBy(x => x.Date ?? DateTime.MinValue).ThenBy(x => x.Title).TakeLast(lastN).ToList();
        var subjects = exams.SelectMany(x => x.Values.Keys).GroupBy(x => x).OrderByDescending(x => x.Count()).ThenBy(x => x.Key).Select(x => x.Key).Take(6).ToList();
        var hasTotal = exams.Any(x => x.Total is not null);

        var columns = new List<ReportColumn> { new("date", L(state, "Tarih", "Date")), new("exam", L(state, "Sınav", "Exam")) };
        columns.AddRange(subjects.Select((name, index) => new ReportColumn($"s{index}", name, "right")));
        if (hasTotal) columns.Add(new("total", L(state, "Toplam net", "Total net"), "right"));
        var rows = exams.Select(exam =>
        {
            var row = new Dictionary<string, object?>
            {
                ["date"] = exam.Date is DateTime date ? AssistantDates.Short(date) : "-",
                ["exam"] = exam.Title,
            };
            for (var index = 0; index < subjects.Count; index++)
                row[$"s{index}"] = exam.Values.TryGetValue(subjects[index], out var value) ? value : null;
            if (hasTotal) row["total"] = exam.Total;
            return row;
        }).ToList();

        // Değişim: her ders için ilk ve son sınav arasındaki fark.
        var changes = subjects
            .Select((name, index) => (Name: name,
                First: exams.Select(x => x.Values.TryGetValue(name, out var v) ? (double?)v : null).FirstOrDefault(v => v is not null),
                Last: exams.Select(x => x.Values.TryGetValue(name, out var v) ? (double?)v : null).LastOrDefault(v => v is not null)))
            .Where(x => x.First is not null && x.Last is not null)
            .Select(x => (x.Name, First: x.First!.Value, Last: x.Last!.Value, Delta: Round1(x.Last!.Value - x.First!.Value)))
            .ToList();
        var notes = changes.Select(x => $"{x.Name}: {Num(state, x.First)} → {Num(state, x.Last)} ({(x.Delta >= 0 ? "+" : "−")}{Num(state, Math.Abs(x.Delta))} {unit})").ToList();

        var series = new List<ReportSeries>();
        if (hasTotal) series.Add(new("total", L(state, "Toplam net", "Total net")));
        series.AddRange(subjects.Take(hasTotal ? 3 : 4).Select((name, index) => new ReportSeries($"s{index}", name)));
        var last = exams[^1];
        var metrics = new List<ReportMetric>
        {
            new(L(state, "Sınav sayısı", "Exams"), exams.Count.ToString(TrCulture)),
            new(L(state, "Öğrenci", "Students"), names.Count.ToString(TrCulture)),
        };
        if (last.Total is double lastTotal) metrics.Add(new(L(state, "Son deneme ort. net", "Last exam avg net"), Num(state, lastTotal)));
        else if (subjects.Count > 0 && last.Values.TryGetValue(subjects[0], out var lastValue)) metrics.Add(new($"{subjects[0]} ({L(state, "son", "last")})", Num(state, lastValue)));

        string summary;
        if (exams.Count < 2 || changes.Count == 0)
            summary = L(state, $"{scope} için şimdilik tek sınav var; eğilim için en az iki sınav gerekiyor.", $"There is only one exam for {scope} so far; a trend needs at least two.");
        else
        {
            var up = changes.MaxBy(x => x.Delta);
            var down = changes.MinBy(x => x.Delta);
            summary = up.Delta > 0 && down.Delta < 0
                ? L(state, $"{scope}, son {exams.Count} sınavda en çok {up.Name} dersinde yükseldi (+{Num(state, up.Delta)} {unit}), en çok {down.Name} dersinde düştü (−{Num(state, Math.Abs(down.Delta))} {unit}).",
                    $"Over the last {exams.Count} exams {scope} improved most in {up.Name} (+{Num(state, up.Delta)}) and dropped most in {down.Name} (−{Num(state, Math.Abs(down.Delta))}).")
                : up.Delta > 0
                    ? L(state, $"{scope}, son {exams.Count} sınavda bütün derslerde yükselişte; en çok {up.Name} (+{Num(state, up.Delta)} {unit}).", $"{scope} is improving in every subject; most in {up.Name} (+{Num(state, up.Delta)}).")
                    : down.Delta < 0
                        ? L(state, $"{scope}, son {exams.Count} sınavda düşüşte; en çok {down.Name} (−{Num(state, Math.Abs(down.Delta))} {unit}).", $"{scope} is declining; most in {down.Name} (−{Num(state, Math.Abs(down.Delta))}).")
                        : L(state, $"{scope}, son {exams.Count} sınavda yatay seyrediyor.", $"{scope} is flat over the last {exams.Count} exams.");
        }

        var data = new ReportData("exam_trend",
            L(state, "Sınav eğilimi", "Exam trend"),
            $"{scope} · {L(state, $"son {exams.Count} sınav", $"last {exams.Count} exams")}{(subject.Length > 0 && subjects.Count > 0 ? $" · {subjects[0]}" : string.Empty)}",
            metrics, columns, rows,
            new("line", "date", series),
            [],
            notes);
        // Tek sınavda yorumlanacak eğilim yok: modelin "sabit kaldı" gibi uydurmasına yer bırakılmaz.
        return Report(state, intent, data, summary, terminal: exams.Count < 2 || changes.Count == 0);
    }

    // ── Sınıf kıyası ────────────────────────────────────────────────────────

    private async Task<ToolOutcome> CompareClassesAsync(AgentState state, JsonElement args, CancellationToken ct)
    {
        const AssistantIntent intent = AssistantIntent.CompareClasses;
        var metric = Str(args, "metric").ToLowerInvariant() switch { "attendance" => "attendance", "homework" => "homework", _ => "exam" };
        if (metric == "attendance" && !await CanAsync(state.Context, AssistantIntent.GetAttendanceRanking, ct)) metric = "exam";
        var (classes, _) = await AgentClassesAsync(state, string.Empty, ct);
        var grade = Int(args, "grade");
        var selected = classes.Where(name => grade is null || NormalizeClass(name).StartsWith($"{grade}-", StringComparison.Ordinal)).ToList();
        if (selected.Count == 0) return EmptyReport(state, intent);

        List<(string ClassName, double Value, int Count)> values;
        string valueLabel, title, unit;
        switch (metric)
        {
            case "attendance":
            {
                var since = DateTime.UtcNow.Date.AddDays(-29);
                var grouped = await db.AttendanceEntries.AsNoTracking()
                    .Where(x => x.LessonDate >= since && selected.Contains(x.ClassName))
                    .GroupBy(x => new { x.ClassName, x.Status })
                    .Select(group => new { group.Key.ClassName, group.Key.Status, Count = group.Count() })
                    .ToListAsync(ct);
                values = grouped.GroupBy(x => x.ClassName)
                    .Select(group => (group.Key, Round1(100.0 * group.Where(x => AttendanceStatusMatcher.IsAbsent(x.Status)).Sum(x => x.Count) / Math.Max(1, group.Sum(x => x.Count))), group.Sum(x => x.Count)))
                    .OrderByDescending(x => x.Item2).ToList();
                valueLabel = L(state, "Devamsızlık oranı (%)", "Absence rate (%)");
                title = L(state, "Sınıf kıyası: devamsızlık (son 30 gün)", "Class comparison: absences (30 days)");
                unit = "%";
                break;
            }
            case "homework":
            {
                var assignments = await db.HomeworkAssignments.AsNoTracking().Where(x => selected.Contains(x.ClassName)).Select(x => new { x.Id, x.ClassName }).ToListAsync(ct);
                var ids = assignments.Select(x => x.Id).ToList();
                var submissions = await db.HomeworkSubmissions.AsNoTracking().Where(x => ids.Contains(x.AssignmentId)).GroupBy(x => x.AssignmentId).Select(group => new { group.Key, Count = group.Count() }).ToListAsync(ct);
                var classSizes = await db.Students.AsNoTracking().Where(x => selected.Contains(x.ClassName)).GroupBy(x => x.ClassName).Select(group => new { group.Key, Count = group.Count() }).ToListAsync(ct);
                values = assignments.GroupBy(x => x.ClassName).Select(group =>
                {
                    var size = classSizes.FirstOrDefault(x => x.Key == group.Key)?.Count ?? 0;
                    var submitted = group.Sum(item => submissions.FirstOrDefault(x => x.Key == item.Id)?.Count ?? 0);
                    var expected = Math.Max(1, group.Count() * size);
                    return (group.Key, Round1(Math.Min(100, 100.0 * submitted / expected)), group.Count());
                }).OrderByDescending(x => x.Item2).ToList();
                valueLabel = L(state, "Ödev teslim oranı (%)", "Homework submission (%)");
                title = L(state, "Sınıf kıyası: ödev teslimi", "Class comparison: homework");
                unit = "%";
                break;
            }
            default:
            {
                var scores = await db.ExamResults.AsNoTracking().Where(x => selected.Contains(x.ClassName))
                    .GroupBy(x => x.ClassName).Select(group => new { group.Key, Average = group.Average(x => (double)x.Score), Count = group.Count() }).ToListAsync(ct);
                values = scores.Select(x => (x.Key, Round1(x.Average), x.Count)).OrderByDescending(x => x.Item2).ToList();
                valueLabel = L(state, "Sınav ortalaması", "Exam average");
                title = L(state, "Sınıf kıyası: sınav ortalaması", "Class comparison: exam average");
                unit = string.Empty;
                break;
            }
        }
        if (values.Count == 0) return EmptyReport(state, intent);

        var rows = values.Select((item, index) => new Dictionary<string, object?>
        {
            ["rank"] = index + 1,
            ["className"] = item.ClassName,
            ["value"] = item.Value,
            ["count"] = item.Count,
        }).ToList();
        var countLabel = metric switch { "attendance" => L(state, "Yoklama", "Records"), "homework" => L(state, "Ödev", "Assignments"), _ => L(state, "Sonuç", "Results") };
        var best = values[0];
        var worst = values[^1];
        var data = new ReportData("compare_classes", title,
            grade is null ? L(state, $"{values.Count} sınıf", $"{values.Count} classes") : L(state, $"{grade}. sınıflar", $"Grade {grade}"),
            [
                new(L(state, "Sınıf sayısı", "Classes"), values.Count.ToString(TrCulture)),
                new(L(state, "Genel ortalama", "Overall"), $"{(unit == "%" ? "%" : string.Empty)}{Num(state, values.Average(x => x.Value))}"),
            ],
            [new("rank", "#", "right"), new("className", L(state, "Sınıf", "Class")), new("value", valueLabel, "right"), new("count", countLabel, "right")],
            rows,
            new("bar", "className", [new("value", valueLabel)]),
            [],
            []);
        var summary = values.Count == 1
            ? L(state, $"{best.ClassName}: {Num(state, best.Value)}{unit}.", $"{best.ClassName}: {Num(state, best.Value)}{unit}.")
            : metric == "attendance"
                ? L(state, $"Devamsızlık oranı en yüksek {best.ClassName} (%{Num(state, best.Value)}), en düşük {worst.ClassName} (%{Num(state, worst.Value)}).", $"Highest absence rate: {best.ClassName} ({Num(state, best.Value)}%), lowest: {worst.ClassName} ({Num(state, worst.Value)}%).")
                : L(state, $"En yüksek {best.ClassName} ({(unit == "%" ? "%" : string.Empty)}{Num(state, best.Value)}), en düşük {worst.ClassName} ({(unit == "%" ? "%" : string.Empty)}{Num(state, worst.Value)}).", $"Highest: {best.ClassName} ({Num(state, best.Value)}{unit}), lowest: {worst.ClassName} ({Num(state, worst.Value)}{unit}).");
        return Report(state, intent, data, summary, terminal: values.Count == 1);
    }

    // ── Erken uyarı ─────────────────────────────────────────────────────────

    private sealed record RiskRow(StudentCandidate Student, int Score, IReadOnlyList<string> Reasons);

    /// <summary>
    /// Risk puanı: devamsızlık (son 30 gün), düşen sınav puanı, düşen deneme neti, düşük ortalama ve
    /// son 30 günde teslim tarihi geçmiş ödevler. Puanı 2 ve üstü olan öğrenci erken uyarı listesine girer.
    /// Eşikler bilerek tutucudur: liste kısa ve anlamlı kalsın.
    /// </summary>
    private async Task<List<RiskRow>> ComputeRiskAsync(IReadOnlyList<StudentCandidate> students, bool english, CancellationToken ct)
    {
        if (students.Count == 0) return [];
        string T(string tr, string en) => english ? en : tr;
        var culture = english ? EnCulture : TrCulture;
        string F(double value) => Math.Round(value, 1).ToString("0.#", culture);

        var names = students.Select(x => x.FullName).Distinct().ToList();
        var userIds = students.Select(x => x.UserId).Distinct().ToList();
        var attendance = await AttendanceCountsAsync(students, 30, ct);

        // Sınav sonuçları da kimlikle eşlenir; bağlanmamış eski sonuçta ada düşülür.
        var studentIds = students.Select(x => (Guid?)x.Id).Distinct().ToList();
        var classicRows = await db.ExamResults.AsNoTracking()
            .Where(x => studentIds.Contains(x.StudentId) || (x.StudentId == null && names.Contains(x.StudentName)))
            .Select(x => new { x.StudentId, x.StudentName, x.DateLabel, x.Score })
            .ToListAsync(ct);
        List<double> ScoresOf(StudentCandidate candidate) => classicRows
            .Where(x => x.StudentId is { } linked ? linked == candidate.Id : x.StudentName == candidate.FullName)
            .OrderBy(x => AssistantDates.TryParse(x.DateLabel) ?? DateTime.MinValue)
            .Select(x => (double)x.Score)
            .ToList();

        var optical = (await (from row in db.OpticalExamStudentResults.AsNoTracking()
                              join exam in db.OpticalExams.AsNoTracking() on row.OpticalExamId equals exam.Id
                              where userIds.Contains(row.StudentUserId)
                              select new { row.StudentUserId, exam.Id, exam.ExamDateUtc, row.Net }).ToListAsync(ct))
            .GroupBy(x => x.StudentUserId)
            .ToDictionary(group => group.Key, group => group.GroupBy(x => new { x.Id, x.ExamDateUtc }).OrderBy(x => x.Key.ExamDateUtc).Select(x => x.Sum(item => (double)item.Net)).ToList());

        var today = AssistantDates.TodayTr;
        var classes = students.Select(x => x.ClassName).Distinct().ToList();
        var dueAssignments = (await db.HomeworkAssignments.AsNoTracking().Where(x => classes.Contains(x.ClassName))
                .Select(x => new { x.Id, x.ClassName, x.DeadlineLabel }).ToListAsync(ct))
            .Where(x => AssistantDates.TryParse(x.DeadlineLabel) is DateTime due && due < today && due >= today.AddDays(-30))
            .ToList();
        var dueIds = dueAssignments.Select(x => x.Id).ToList();
        var submitted = (await db.HomeworkSubmissions.AsNoTracking().Where(x => dueIds.Contains(x.AssignmentId))
                .Select(x => new { x.AssignmentId, x.StudentName }).ToListAsync(ct))
            .Select(x => (x.AssignmentId, x.StudentName)).ToHashSet();

        var result = new List<RiskRow>();
        foreach (var student in students.GroupBy(x => x.Id).Select(group => group.First()))
        {
            var score = 0;
            var reasons = new List<string>();

            var absent = attendance.GetValueOrDefault(student.Id).Absent;
            if (absent >= 8) { score += 2; reasons.Add(T($"Son 30 günde {absent} ders devamsız", $"{absent} missed lessons in 30 days")); }
            else if (absent >= 4) { score += 1; reasons.Add(T($"Son 30 günde {absent} ders devamsız", $"{absent} missed lessons in 30 days")); }

            var scores = ScoresOf(student);
            if (scores.Count >= 2)
            {
                if (scores.Count >= 4)
                {
                    var recent = scores.TakeLast(2).Average();
                    var previous = scores.SkipLast(2).TakeLast(3).Average();
                    var drop = previous - recent;
                    if (drop >= 15) { score += 2; reasons.Add(T($"Sınav puanı düştü ({F(previous)} → {F(recent)})", $"Exam score fell ({F(previous)} → {F(recent)})")); }
                    else if (drop >= 8) { score += 1; reasons.Add(T($"Sınav puanı düşüşte ({F(previous)} → {F(recent)})", $"Exam score falling ({F(previous)} → {F(recent)})")); }
                }
                var average = scores.Average();
                if (average < 45) { score += 1; reasons.Add(T($"Sınav ortalaması düşük ({F(average)})", $"Low exam average ({F(average)})")); }
            }

            if (optical.TryGetValue(student.UserId, out var nets) && nets.Count >= 2)
            {
                var lastNet = nets[^1];
                var previousNet = nets.SkipLast(1).TakeLast(3).Average();
                if (previousNet > 0)
                {
                    var ratio = (previousNet - lastNet) / previousNet;
                    if (ratio >= 0.25) { score += 2; reasons.Add(T($"Deneme neti düştü ({F(previousNet)} → {F(lastNet)})", $"Mock exam net fell ({F(previousNet)} → {F(lastNet)})")); }
                    else if (ratio >= 0.15) { score += 1; reasons.Add(T($"Deneme neti düşüşte ({F(previousNet)} → {F(lastNet)})", $"Mock exam net falling ({F(previousNet)} → {F(lastNet)})")); }
                }
            }

            var overdue = dueAssignments.Count(x => x.ClassName == student.ClassName && !submitted.Contains((x.Id, student.FullName)));
            if (overdue >= 3) { score += 2; reasons.Add(T($"{overdue} ödev gecikti", $"{overdue} overdue assignments")); }
            else if (overdue >= 1) { score += 1; reasons.Add(T($"{overdue} ödev gecikti", $"{overdue} overdue assignment(s)")); }

            if (score >= 2) result.Add(new(student, score, reasons));
        }
        return result.OrderByDescending(x => x.Score).ThenBy(x => x.Student.FullName).ToList();
    }

    private static string RiskLevel(AgentState state, int score) => score >= 4 ? L(state, "Yüksek", "High") : L(state, "Orta", "Medium");

    private async Task<ToolOutcome> AtRiskAsync(AgentState state, JsonElement args, CancellationToken ct)
    {
        const AssistantIntent intent = AssistantIntent.GetAtRiskStudents;
        var requested = Str(args, "class_name");
        var (classes, stop) = await AgentClassesAsync(state, requested, ct);
        if (stop is not null) return stop;
        var students = await ScopedStudentsAsync(state, requested.Length > 0 ? classes : null, ct);
        var risks = await ComputeRiskAsync(students, state.Voice.English, ct);
        var scope = requested.Length > 0 ? string.Join(", ", classes) : L(state, state.Voice.Portal == "teacher" ? "Sınıflarınız" : "Tüm sınıflar", state.Voice.Portal == "teacher" ? "Your classes" : "All classes");
        if (risks.Count == 0)
            return EmptyReport(state, intent, L(state, $"{scope} için erken uyarı gerektiren öğrenci görünmüyor. Devamsızlık, notlar ve ödevler olağan seyrinde.", $"No students need an early warning in {scope}."));

        var high = risks.Count(x => x.Score >= 4);
        var rows = risks.Take(30).Select(risk => new Dictionary<string, object?>
        {
            ["student"] = risk.Student.FullName,
            ["className"] = risk.Student.ClassName,
            ["level"] = RiskLevel(state, risk.Score),
            ["reasons"] = string.Join("; ", risk.Reasons),
        }).ToList();
        var data = new ReportData("at_risk",
            L(state, "Erken uyarı listesi", "Early-warning list"),
            $"{scope} · {L(state, "son 30 gün", "last 30 days")}",
            [
                new(L(state, "Risk altında", "At risk"), risks.Count.ToString(TrCulture), "warn"),
                new(L(state, "Yüksek risk", "High risk"), high.ToString(TrCulture), high > 0 ? "warn" : "info"),
                new(L(state, "İncelenen öğrenci", "Students reviewed"), students.Count.ToString(TrCulture)),
            ],
            [new("student", L(state, "Öğrenci", "Student")), new("className", L(state, "Sınıf", "Class")), new("level", L(state, "Risk", "Risk")), new("reasons", L(state, "Nedenler", "Reasons"))],
            rows,
            null,
            [],
            [L(state, "Ölçütler: son 30 günde 4+ ders devamsızlık, düşen sınav puanı ya da deneme neti, 45 altı ortalama, teslim tarihi geçmiş ödev.", "Criteria: 4+ missed lessons in 30 days, falling scores or nets, average below 45, overdue homework.")]);
        var first = risks[0];
        return Report(state, intent, data, L(state,
            $"{scope} içinde {risks.Count} öğrenci erken uyarı listesinde ({high} yüksek risk). İlk sırada {first.Student.FullName}: {string.Join(", ", first.Reasons).ToLower(TrCulture)}.",
            $"{risks.Count} students in {scope} are on the early-warning list ({high} high risk). Top: {first.Student.FullName}."));
    }

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<(Guid Tenant, Guid User, string Portal), (int Count, DateTime ExpiresUtc)> RiskCountCache = new();

    /// <summary>
    /// Brifing için: kullanıcının kapsamındaki risk altındaki öğrenci sayısı. Bütün kadroyu taradığı
    /// için panel her açıldığında yeniden hesaplanmaz; kullanıcı başına 10 dakika saklanır.
    /// </summary>
    private async Task<int> AtRiskCountAsync(AssistantRequestContext context, string portal, CancellationToken ct)
    {
        var key = (context.TenantId, context.UserId, portal);
        if (RiskCountCache.TryGetValue(key, out var cached) && cached.ExpiresUtc > DateTime.UtcNow) return cached.Count;
        var roster = (await StaffRosterAsync(context, portal, ct)).Select(entry => entry.Candidate).ToList();
        var count = (await ComputeRiskAsync(roster, false, ct)).Count;
        if (RiskCountCache.Count > 5000) RiskCountCache.Clear();
        RiskCountCache[key] = (count, DateTime.UtcNow.AddMinutes(10));
        return count;
    }

    // ── Sınıf özeti ─────────────────────────────────────────────────────────

    private async Task<ToolOutcome> ClassOverviewAsync(AgentState state, JsonElement args, CancellationToken ct)
    {
        const AssistantIntent intent = AssistantIntent.GetClassOverview;
        var requested = Str(args, "class_name");
        if (requested.Length == 0 && state.Parsed is { GradeLevel: int grade, SectionName: { } section }) requested = $"{grade}-{section}";
        if (requested.Length == 0)
            return EmptyReport(state, intent, L(state, "Hangi sınıfın durumuna bakayım? Örneğin \"10-A sınıfının durumu\" yazabilirsiniz.", "Which class should I look at? For example, \"status of 10-A\"."));
        var (classes, stop) = await AgentClassesAsync(state, requested, ct);
        if (stop is not null) return stop;
        if (classes.Count > 1)
            return EmptyReport(state, intent, L(state, $"Hangi şube? {string.Join(", ", classes)}", $"Which section? {string.Join(", ", classes)}"));

        var className = classes[0];
        var students = await ScopedStudentsAsync(state, classes, ct);
        var attendance = await AttendanceCountsAsync(students, 30, ct);
        var absent = attendance.Values.Sum(x => x.Absent);
        var records = attendance.Values.Sum(x => x.Total);
        var absentToday = await AbsentTodayAsync(classes.ToList(), ct);
        var examAverage = await db.ExamResults.AsNoTracking().Where(x => x.ClassName == className).Select(x => (double?)x.Score).AverageAsync(ct);
        var today = AssistantDates.TodayTr;
        var assignments = (await db.HomeworkAssignments.AsNoTracking().Where(x => x.ClassName == className).Select(x => new { x.Id, x.DeadlineLabel }).ToListAsync(ct));
        var active = assignments.Count(x => AssistantDates.TryParse(x.DeadlineLabel) is not DateTime due || due >= today);
        var ids = assignments.Select(x => x.Id).ToList();
        var submissions = await db.HomeworkSubmissions.AsNoTracking().Where(x => ids.Contains(x.AssignmentId)).CountAsync(ct);
        var submissionRate = assignments.Count == 0 || students.Count == 0 ? (double?)null : Round1(Math.Min(100, 100.0 * submissions / (assignments.Count * students.Count)));
        var risks = await ComputeRiskAsync(students, state.Voice.English, ct);

        var attendanceRate = records == 0 ? (double?)null : Round1(100.0 - 100.0 * absent / records);
        var metrics = new List<ReportMetric> { new(L(state, "Öğrenci", "Students"), students.Count.ToString(TrCulture)) };
        if (attendanceRate is double rate) metrics.Add(new(L(state, "Devam oranı (30 gün)", "Attendance (30 days)"), $"%{Num(state, rate)}", rate < 90 ? "warn" : "good"));
        metrics.Add(new(L(state, "Bugün devamsız", "Absent today"), absentToday.ToString(TrCulture), absentToday > 0 ? "warn" : "info"));
        if (examAverage is double average) metrics.Add(new(L(state, "Sınav ortalaması", "Exam average"), Num(state, average)));
        metrics.Add(new(L(state, "Aktif ödev", "Active homework"), active.ToString(TrCulture)));
        if (submissionRate is double submitted) metrics.Add(new(L(state, "Ödev teslim oranı", "Homework submission"), $"%{Num(state, submitted)}"));
        metrics.Add(new(L(state, "Erken uyarı", "Early warning"), risks.Count.ToString(TrCulture), risks.Count > 0 ? "warn" : "good"));

        var rows = risks.Take(10).Select(risk => new Dictionary<string, object?>
        {
            ["student"] = risk.Student.FullName,
            ["level"] = RiskLevel(state, risk.Score),
            ["reasons"] = string.Join("; ", risk.Reasons),
        }).ToList();
        var data = new ReportData("class_overview",
            L(state, $"{className} sınıf özeti", $"{className} overview"),
            AssistantDates.Short(today),
            metrics,
            rows.Count > 0 ? [new("student", L(state, "Erken uyarıdaki öğrenci", "Student on early warning")), new("level", L(state, "Risk", "Risk")), new("reasons", L(state, "Nedenler", "Reasons"))] : [],
            rows,
            null,
            [],
            []);
        var parts = new List<string> { L(state, $"{className}: {students.Count} öğrenci", $"{className}: {students.Count} students") };
        if (attendanceRate is double r) parts.Add(L(state, $"son 30 günde devam oranı %{Num(state, r)}", $"{Num(state, r)}% attendance in 30 days"));
        if (examAverage is double avg) parts.Add(L(state, $"sınav ortalaması {Num(state, avg)}", $"exam average {Num(state, avg)}"));
        var summary = string.Join(", ", parts) + ". " + (risks.Count > 0
            ? L(state, $"{risks.Count} öğrenci erken uyarı listesinde.", $"{risks.Count} students are on the early-warning list.")
            : L(state, "Erken uyarı gerektiren öğrenci yok.", "No students need an early warning."));
        return Report(state, intent, data, summary);
    }

    // ── Finans raporu ───────────────────────────────────────────────────────

    private static string MethodLabel(AgentState state, string method) => (method ?? string.Empty).Trim().ToLowerInvariant() switch
    {
        "cash" or "nakit" => L(state, "Nakit", "Cash"),
        "card" or "creditcard" or "credit_card" or "pos" or "kredi karti" => L(state, "Kredi kartı", "Card"),
        "banktransfer" or "bank_transfer" or "transfer" or "eft" or "havale" => L(state, "Havale/EFT", "Bank transfer"),
        "online" or "virtualpos" or "iyzico" or "paytr" => L(state, "Online ödeme", "Online"),
        "" => L(state, "Belirtilmemiş", "Unspecified"),
        _ => method!,
    };

    private async Task<ToolOutcome> FinanceReportAsync(AgentState state, JsonElement args, CancellationToken ct)
    {
        const AssistantIntent intent = AssistantIntent.GetFinanceReport;
        var localNow = DateTime.UtcNow.AddHours(3);
        var (year, month) = (localNow.Year, localNow.Month);
        var requested = Regex.Match(Str(args, "month"), @"^(\d{4})-(\d{1,2})");
        if (requested.Success && int.Parse(requested.Groups[2].Value) is >= 1 and <= 12)
            (year, month) = (int.Parse(requested.Groups[1].Value), int.Parse(requested.Groups[2].Value));
        // Türkiye ayının başı UTC'ye çevrilir (Postgres timestamptz Kind=Utc ister).
        var startUtc = DateTime.SpecifyKind(new DateTime(year, month, 1, 0, 0, 0).AddHours(-3), DateTimeKind.Utc);
        var endUtc = startUtc.AddMonths(1);
        var period = new DateTime(year, month, 1).ToString("MMMM yyyy", state.Voice.English ? EnCulture : TrCulture);

        var payments = await db.FinancePayments.AsNoTracking().Where(x => x.PaidAtUtc >= startUtc && x.PaidAtUtc < endUtc)
            .Select(x => new { x.Amount, x.Method }).ToListAsync(ct);
        var amounts = payments.Select(x => x.Amount).ToList();
        var gross = FinanceTotals.Gross(amounts);
        var refunded = FinanceTotals.Refunded(amounts);
        var net = FinanceTotals.NetCollected(amounts);
        var byMethod = payments.Where(x => x.Amount > 0).GroupBy(x => MethodLabel(state, x.Method))
            .Select(group => (Method: group.Key, Total: group.Sum(x => x.Amount), Count: group.Count()))
            .OrderByDescending(x => x.Total).ToList();

        var nowUtc = DateTime.UtcNow;
        var overdue = await db.FinanceInstallments.AsNoTracking().Where(x => x.Amount > x.PaidAmount && x.DueDateUtc < nowUtc)
            .Select(x => new { x.StudentName, x.DueDateUtc, Remaining = x.Amount - x.PaidAmount }).ToListAsync(ct);
        var buckets = new (string Label, int Min, int Max)[] { (L(state, "1–30 gün", "1–30 days"), 0, 30), (L(state, "31–60 gün", "31–60 days"), 31, 60), (L(state, "61–90 gün", "61–90 days"), 61, 90), (L(state, "90 günden eski", "Over 90 days"), 91, int.MaxValue) }
            .Select(bucket =>
            {
                var items = overdue.Where(x => (nowUtc - x.DueDateUtc).Days is var age && age >= bucket.Min && age <= bucket.Max).ToList();
                return (bucket.Label, Total: items.Sum(x => x.Remaining), Count: items.Count);
            }).ToList();
        var debtors = overdue.GroupBy(x => x.StudentName)
            .Select(group => (Student: group.Key, Total: group.Sum(x => x.Remaining), Count: group.Count(), Oldest: group.Min(x => x.DueDateUtc)))
            .OrderByDescending(x => x.Total).Take(10).ToList();
        var overdueTotal = overdue.Sum(x => x.Remaining);
        if (payments.Count == 0 && overdue.Count == 0) return EmptyReport(state, intent, L(state, $"{period} için tahsilat ya da gecikmiş taksit kaydı yok.", $"No collections or overdue installments for {period}."));

        var rows = debtors.Select((item, index) => new Dictionary<string, object?>
        {
            ["rank"] = index + 1,
            ["student"] = item.Student,
            ["amount"] = Math.Round(item.Total, 2),
            ["installments"] = item.Count,
            ["oldest"] = AssistantDates.Short(item.Oldest.AddHours(3)),
        }).ToList();
        var data = new ReportData("finance_report",
            L(state, $"Finans raporu — {period}", $"Finance report — {period}"),
            L(state, "Tahsilat dökümü ve gecikmiş alacaklar", "Collections and overdue receivables"),
            [
                new(L(state, "Brüt tahsilat", "Gross collected"), Money(state, gross), "good"),
                new(L(state, "İade", "Refunds"), Money(state, refunded)),
                new(L(state, "Net tahsilat", "Net collected"), Money(state, net), "good"),
                new(L(state, "Vadesi geçmiş alacak", "Overdue receivables"), Money(state, overdueTotal), overdueTotal > 0 ? "warn" : "info"),
            ],
            rows.Count > 0
                ? [new("rank", "#", "right"), new("student", L(state, "Öğrenci", "Student")), new("amount", L(state, "Gecikmiş tutar (₺)", "Overdue (₺)"), "right"), new("installments", L(state, "Taksit", "Installments"), "right"), new("oldest", L(state, "En eski vade", "Oldest due"))]
                : [],
            rows,
            null,
            [
                new(L(state, "Ödeme yöntemine göre tahsilat", "Collections by method"),
                    byMethod.Count == 0 ? [L(state, "Bu ay tahsilat yok.", "No collections this month.")] : byMethod.Select(x => $"{x.Method}: {Money(state, x.Total)} ({x.Count} {L(state, "işlem", "payments")})").ToList()),
                new(L(state, "Gecikme yaşlandırması", "Overdue ageing"),
                    buckets.Select(x => $"{x.Label}: {Money(state, x.Total)} ({x.Count} {L(state, "taksit", "installments")})").ToList()),
            ],
            [L(state, "Net tahsilat = brüt tahsilat − iade. Yaşlandırma rapor anındaki vadesi geçmiş taksitleri gösterir.", "Net = gross − refunds. Ageing shows installments overdue as of now.")]);
        var oldBucket = buckets[^1];
        var summary = L(state,
            $"{period} döneminde net {Money(state, net)} tahsil edildi{(refunded > 0 ? $" (iade {Money(state, refunded)})" : string.Empty)}. Vadesi geçmiş alacak {Money(state, overdueTotal)}{(oldBucket.Total > 0 ? $"; bunun {Money(state, oldBucket.Total)} tutarı 90 günden eski" : string.Empty)}.",
            $"Net {Money(state, net)} collected in {period}{(refunded > 0 ? $" (refunds {Money(state, refunded)})" : string.Empty)}. Overdue receivables: {Money(state, overdueTotal)}.");
        return Report(state, intent, data, summary);
    }

    // ── Öğrenci raporu ──────────────────────────────────────────────────────

    /// <summary>
    /// Öğrencinin rol kapsamındaki bütün bilgileri tek raporda. Her bölüm kendi niyetinin kapısından
    /// ayrıca geçer: muhasebe sınav bölümünü, öğretmen ödeme bölümünü görmez.
    /// </summary>
    private async Task<ToolOutcome> StudentReportAsync(AgentState state, JsonElement args, CancellationToken ct)
    {
        const AssistantIntent intent = AssistantIntent.GetStudentReport;
        var (student, stop) = await AgentStudentAsync(state, args, intent, ct);
        if (stop is not null) return stop;
        var voice = state.Voice;
        var sections = new List<ReportSection>();
        var metrics = new List<ReportMetric> { new(L(state, "Sınıf", "Class"), student!.ClassName.Length > 0 ? student.ClassName : "-") };

        var parts = new (AssistantIntent Intent, string Title)[]
        {
            (AssistantIntent.GetAttendance, L(state, "Devam durumu", "Attendance")),
            (AssistantIntent.GetExamResults, L(state, "Sınavlar", "Exams")),
            (AssistantIntent.GetTopicInsight, L(state, "Konu analizi", "Topic analysis")),
            (AssistantIntent.GetHomework, L(state, "Ödevler", "Homework")),
            (AssistantIntent.GetPaymentSummary, L(state, "Ödeme", "Payments")),
            (AssistantIntent.GetLibraryLoans, L(state, "Kütüphane", "Library")),
        };
        foreach (var (partIntent, title) in parts)
        {
            if (!await CanAsync(state.Context, partIntent, ct)) continue;
            var card = await ExecuteStudentIntentAsync(state.Context, state.Conversation.Id, partIntent, student, voice, ct);
            var lines = new List<string> { card.Text };
            var data = card.Data is null ? default : JsonSerializer.SerializeToElement(card.Data, JsonOptions);
            JsonElement Prop(JsonElement element, string name) => element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) ? value : default;
            string Text(JsonElement element, string name) => Prop(element, name) is { ValueKind: not JsonValueKind.Undefined and not JsonValueKind.Null } value ? value.ToString() : string.Empty;
            IEnumerable<JsonElement> Items(string name) => Prop(data, name) is { ValueKind: JsonValueKind.Array } array ? array.EnumerateArray().Take(5) : [];

            switch (partIntent)
            {
                case AssistantIntent.GetAttendance when Prop(data, "absent") is { ValueKind: JsonValueKind.Number } absent:
                    metrics.Add(new(L(state, "Devamsız ders", "Missed lessons"), absent.ToString(), absent.GetInt32() > 0 ? "warn" : "good"));
                    break;
                case AssistantIntent.GetExamResults:
                    if (Prop(data, "average") is { ValueKind: JsonValueKind.Number } average && Items("items").Any())
                        metrics.Add(new(L(state, "Sınav ortalaması", "Exam average"), Num(state, average.GetDouble())));
                    lines.AddRange(Items("items").Select(item => $"{Text(item, "examTitle")} · {Text(item, "subject")}: {Text(item, "score")}"));
                    break;
                case AssistantIntent.GetTopicInsight:
                    lines.AddRange(Items("weakTopics").Select(item => $"{Text(item, "subject")} / {Text(item, "topic")}: %{Text(item, "successRate")}"));
                    break;
                case AssistantIntent.GetHomework:
                    var pending = Prop(data, "items") is { ValueKind: JsonValueKind.Array } homework ? homework.GetArrayLength() : 0;
                    metrics.Add(new(L(state, "Bekleyen ödev", "Pending homework"), pending.ToString(TrCulture), pending > 0 ? "warn" : "good"));
                    lines.AddRange(Items("items").Select(item => $"{Text(item, "title")} ({Text(item, "subject")}) · {Text(item, "deadline")}"));
                    break;
                case AssistantIntent.GetPaymentSummary when Prop(data, "remaining") is { ValueKind: JsonValueKind.Number } remaining:
                    metrics.Add(new(L(state, "Kalan borç", "Outstanding"), Money(state, remaining.GetDecimal()), remaining.GetDecimal() > 0 ? "warn" : "good"));
                    break;
                case AssistantIntent.GetLibraryLoans:
                    lines.AddRange(Items("items").Select(item => $"{Text(item, "title")} · {Text(item, "deadline")} ({Text(item, "status")})"));
                    break;
            }
            sections.Add(new(title, lines.Where(line => !string.IsNullOrWhiteSpace(line)).ToList()));
        }

        var report = new ReportData("student_report",
            L(state, $"{student.FullName} — Öğrenci raporu", $"{student.FullName} — Student report"),
            $"{student.ClassName} · {AssistantDates.Short(AssistantDates.TodayTr)}",
            metrics, [], [], null, sections, [], student.Id);
        var summary = string.Join(" ", sections.Select(section => section.Lines.FirstOrDefault()).Where(line => !string.IsNullOrWhiteSpace(line)).Take(3));
        return Report(state, intent, report, summary.Length > 0 ? summary : voice.ReportReady(report.Title));
    }
}
