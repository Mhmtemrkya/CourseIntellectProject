using System.Globalization;
using System.Text;
using QRCoder;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CourseIntellect.Infrastructure.Services;

public sealed record SuccessSubjectRow(string Subject, double? Student, double? ClassAverage, int Count, string Unit);
public sealed record SuccessTopicRow(string Subject, string Topic, double SuccessRate, double? ClassRate, string? Diagnosis, string Trend, int Solved);
public sealed record SuccessExamRow(string Date, string Title, string Subject, double? Score, double? Net);
public sealed record SuccessOpticalRow(string Date, string Title, string Subject, int Correct, int Wrong, int Blank, double Net);
public sealed record SuccessTrendPoint(string Label, double Value);

/// <summary>Öğrenci başarı raporunun bütün değerleri (sunucuda hesaplanır; PDF yalnız yerleşim yapar).</summary>
public sealed record StudentSuccessReport(
    string Institution,
    string StudentName,
    string ClassName,
    string StudentNo,
    string ReportNo,
    DateTime GeneratedAtUtc,
    double? Average,
    double? ClassAverage,
    double? AttendanceRate,
    int AbsentLessons,
    int AttendanceRecords,
    double? HomeworkRate,
    int PendingHomework,
    int ExamCount,
    int? Rank,
    int ClassSize,
    double? TopicSuccess,
    int SolvedQuestions,
    IReadOnlyList<SuccessSubjectRow> Subjects,
    IReadOnlyList<SuccessTopicRow> WeakTopics,
    IReadOnlyList<SuccessTopicRow> StrongTopics,
    IReadOnlyList<SuccessExamRow> Exams,
    IReadOnlyList<SuccessOpticalRow> Optical,
    IReadOnlyList<SuccessTrendPoint> ScoreTrend,
    IReadOnlyList<SuccessTrendPoint> NetTrend);

/// <summary>
/// "Öğrenci Başarı Raporu" — masaüstü Rapor Merkezi'ndeki 6 sayfalık koyu tasarımın sunucu sürümü:
/// kapak, genel sonuçlar, ders bazlı analiz, konu analizi, sınav detayları, gelişim. Sayfalar resim
/// değil gerçek metindir (seçilebilir, küçük dosya); grafikler SVG olarak çizilir. Masaüstü,
/// mobil ve asistan aynı PDF'i alır.
/// </summary>
public static class StudentSuccessReportPdf
{
    private const string Bg = "#08111F";
    private const string Card = "#0F1B2E";
    private const string CardLine = "#1E2B42";
    private const string Ink = "#FFFFFF";
    private const string Muted = "#94A3B8";
    private const string Orange = "#FF9D2E";
    private const string Green = "#30D158";
    private const string Blue = "#4DA3FF";
    private const string Purple = "#7B61FF";
    private const string Red = "#FF5A5F";

    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    static StudentSuccessReportPdf() => QuestPDF.Settings.License = LicenseType.Community;

    private static string F(double? value, string suffix = "") => value is double number ? number.ToString("0.#", Tr) + suffix : "-";
    private static string Pct(double? value) => value is double number ? $"%{number.ToString("0.#", Tr)}" : "-";

    public static byte[] Render(StudentSuccessReport report) => Document.Create(document =>
    {
        void Sheet(Action<ColumnDescriptor> body, bool cover = false) => document.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(0);
            page.PageColor(Bg);
            page.DefaultTextStyle(text => text.FontSize(9.5f).FontColor(Ink));
            page.Content().Padding(cover ? 34 : 30).Column(body);
            if (!cover)
            {
                page.Footer().PaddingHorizontal(30).PaddingBottom(16).Row(row =>
                {
                    row.RelativeItem().Text($"{report.StudentName} · {report.ClassName} · SchoolAsist Öğrenci Başarı Raporu").FontSize(7).FontColor(Muted);
                    row.ConstantItem(60).AlignRight().Text(text =>
                    {
                        text.CurrentPageNumber().FontSize(7).FontColor(Muted);
                        text.Span(" / ").FontSize(7).FontColor(Muted);
                        text.TotalPages().FontSize(7).FontColor(Muted);
                    });
                });
            }
        });

        Sheet(column => Cover(column, report), cover: true);
        Sheet(column => Results(column, report));
        Sheet(column => Subjects(column, report));
        Sheet(column => Topics(column, report));
        Sheet(column => ExamDetails(column, report));
        Sheet(column => Growth(column, report));
    }).GeneratePdf();

    // ── 1. Kapak ────────────────────────────────────────────────────────────

    private static void Cover(ColumnDescriptor column, StudentSuccessReport report)
    {
        column.Item().Row(row =>
        {
            row.ConstantItem(36).Height(36).Svg($"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" rx="9" fill="{Orange}"/><path d="M18 7l2.6 6.9 7.4.3-5.8 4.6 2 7.2L18 21.9 11.8 26l2-7.2-5.8-4.6 7.4-.3z" fill="#fff"/></svg>""");
            row.ConstantItem(10);
            row.RelativeItem().AlignMiddle().Column(brand =>
            {
                brand.Item().Text("SCHOOL").FontSize(10).Bold().LetterSpacing(0.25f);
                brand.Item().Text("ASIST").FontSize(15).Bold().FontColor(Orange);
            });
        });

        column.Item().PaddingTop(70).Row(row =>
        {
            row.ConstantItem(210).Height(210).Svg(Avatar(Initial(report.StudentName)));
            row.ConstantItem(36);
            row.RelativeItem().AlignMiddle().Column(title =>
            {
                title.Item().AlignRight().Text("ÖĞRENCİ").FontSize(30).Bold();
                title.Item().AlignRight().Text("BAŞARI RAPORU").FontSize(34).Bold().FontColor(Orange);
                title.Item().AlignRight().PaddingTop(8).Text("Akademik Performans Analizi").FontSize(12).FontColor(Muted);
                title.Item().AlignRight().PaddingTop(10).Width(50).LineHorizontal(2).LineColor(Orange);
            });
        });

        column.Item().PaddingTop(56).Text(report.StudentName).FontSize(30).Bold();
        column.Item().PaddingTop(14).Column(info =>
        {
            info.Spacing(8);
            info.Item().Text(report.ClassName.Length > 0 ? $"{report.ClassName} sınıfı" : "Sınıf bilgisi yok").FontSize(12).FontColor(Muted);
            info.Item().Text($"Öğrenci No: {(report.StudentNo.Length > 0 ? report.StudentNo : "-")}").FontSize(12).FontColor(Muted);
            info.Item().Text($"{report.GeneratedAtUtc.AddHours(3):dd.MM.yyyy} · Rapor Tarihi").FontSize(12).FontColor(Muted);
        });

        column.Item().ExtendVertical().AlignBottom().Background(Card).Border(1).BorderColor(CardLine).Padding(18).Row(row =>
        {
            row.RelativeItem().AlignMiddle().Column(left =>
            {
                left.Item().AlignCenter().Text("KURUM").FontSize(8).FontColor(Orange).Bold();
                left.Item().PaddingTop(4).AlignCenter().Text(report.Institution.Length > 0 ? report.Institution : "Kurum").FontSize(11).Bold();
            });
            row.ConstantItem(1).Background(CardLine);
            row.RelativeItem().AlignCenter().AlignMiddle().Column(middle =>
            {
                middle.Item().AlignCenter().Width(70).Height(70).Image(Qr($"SchoolAsist | {report.ReportNo} | {report.StudentName} | {report.ClassName} | {report.GeneratedAtUtc.AddHours(3):dd.MM.yyyy}"));
                middle.Item().PaddingTop(4).AlignCenter().Text("Rapor kimliği").FontSize(7).FontColor(Muted);
            });
            row.ConstantItem(1).Background(CardLine);
            row.RelativeItem().PaddingLeft(14).AlignMiddle().Column(right =>
            {
                right.Item().Text("Rapor No").FontSize(8).FontColor(Muted);
                right.Item().PaddingTop(3).Text(report.ReportNo).FontSize(10).Bold();
                right.Item().PaddingTop(8).Text("Bu rapor SchoolAsist tarafından kurum kayıtlarından hesaplanarak hazırlanmıştır.").FontSize(7).FontColor(Muted);
            });
        });
    }

    // ── 2. Genel sonuçlar ───────────────────────────────────────────────────

    private static void Results(ColumnDescriptor column, StudentSuccessReport report)
    {
        Title(column, "Genel Sonuçlar", "Sınav, devam ve ödev göstergelerinin özeti");
        var kpis = new (string Label, string Value, string Accent)[]
        {
            ("Sınav ortalaması", F(report.Average), Orange),
            ("Sınıf ortalaması", F(report.ClassAverage), Purple),
            ("Sınıf sıralaması", report.Rank is int rank ? $"{rank} / {report.ClassSize}" : "-", Orange),
            ("Sınav sayısı", report.ExamCount.ToString(Tr), Blue),
            ("Devam oranı", Pct(report.AttendanceRate), Green),
            ("Devamsız ders", report.AttendanceRecords > 0 ? report.AbsentLessons.ToString(Tr) : "-", Red),
            ("Ödev teslim oranı", Pct(report.HomeworkRate), Blue),
            ("Konu başarısı", Pct(report.TopicSuccess), Green),
        };
        column.Item().PaddingTop(16).Table(table =>
        {
            table.ColumnsDefinition(columns => { for (var i = 0; i < 4; i++) columns.RelativeColumn(); });
            foreach (var (label, value, accent) in kpis)
            {
                table.Cell().Padding(4).Background(Card).Border(1).BorderColor(CardLine).Padding(12).Column(card =>
                {
                    card.Item().Width(18).Height(3).Background(accent);
                    card.Item().PaddingTop(10).Text(value).FontSize(18).Bold();
                    card.Item().PaddingTop(2).Text(label).FontSize(8).FontColor(Muted);
                });
            }
        });

        column.Item().PaddingTop(18).Row(row =>
        {
            row.ConstantItem(200).Background(Card).Border(1).BorderColor(CardLine).Padding(16).Column(donut =>
            {
                donut.Item().AlignCenter().Width(140).Height(140).Svg(Donut(report.Average, Orange));
                donut.Item().PaddingTop(10).AlignCenter().Text("Sınav başarısı").FontSize(9).FontColor(Muted);
            });
            row.ConstantItem(14);
            row.RelativeItem().Background(Card).Border(1).BorderColor(CardLine).Padding(18).Column(bars =>
            {
                bars.Item().Text("Öğrenci ve sınıf karşılaştırması").FontSize(11).Bold();
                Bar(bars, "Öğrenci ortalaması", report.Average, Orange);
                Bar(bars, "Sınıf ortalaması", report.ClassAverage, Purple);
                Bar(bars, "Devam oranı", report.AttendanceRate, Green);
                Bar(bars, "Ödev teslim oranı", report.HomeworkRate, Blue);
            });
        });

        var comments = new List<string>();
        if (report.Average is double average && report.ClassAverage is double classAverage)
            comments.Add(average >= classAverage
                ? $"Sınav ortalaması sınıf ortalamasının {F(average - classAverage)} puan üzerinde."
                : $"Sınav ortalaması sınıf ortalamasının {F(classAverage - average)} puan altında.");
        if (report.AttendanceRate is double attendance) comments.Add(attendance >= 95 ? "Devam durumu çok iyi." : attendance >= 85 ? "Devam durumu yeterli; devamsızlıklar takip edilmeli." : "Devamsızlık yüksek; veliyle görüşülmesi önerilir.");
        if (report.PendingHomework > 0) comments.Add($"Teslim edilmemiş {report.PendingHomework} ödev var.");
        if (comments.Count > 0)
        {
            column.Item().PaddingTop(18).Background(Card).Border(1).BorderColor(CardLine).Padding(16).Column(note =>
            {
                note.Item().Text("Değerlendirme").FontSize(11).Bold().FontColor(Orange);
                foreach (var comment in comments) note.Item().PaddingTop(5).Text($"• {comment}");
            });
        }
    }

    // ── 3. Ders bazlı analiz ────────────────────────────────────────────────

    private static void Subjects(ColumnDescriptor column, StudentSuccessReport report)
    {
        Title(column, "Ders Bazlı Analiz", "Her derste öğrencinin ortalaması ve sınıf ortalaması");
        if (report.Subjects.Count == 0)
        {
            Empty(column, "Ders bazlı sınav sonucu bulunmuyor.");
            return;
        }
        column.Item().PaddingTop(16).Table(table =>
        {
            table.ColumnsDefinition(columns => { columns.RelativeColumn(); columns.RelativeColumn(); });
            for (var index = 0; index < report.Subjects.Count && index < 10; index++)
            {
                var subject = report.Subjects[index];
                // Renk başarıyı anlatır: puanda 50 altı kırmızı, 70 altı turuncu, üstü yeşil; netlerde mavi.
                var accent = subject.Unit != "puan" ? Blue : subject.Student is < 50 ? Red : subject.Student is < 70 ? Orange : Green;
                var max = subject.Unit == "net" ? Math.Max(1, Math.Max(subject.Student ?? 0, subject.ClassAverage ?? 0) * 1.2) : 100;
                table.Cell().Padding(5).Background(Card).Border(1).BorderColor(CardLine).Padding(14).Column(card =>
                {
                    card.Item().Row(head =>
                    {
                        head.RelativeItem().Text(subject.Subject).FontSize(12).Bold();
                        head.AutoItem().Text($"{F(subject.Student)} {subject.Unit}").FontSize(12).Bold().FontColor(accent);
                    });
                    card.Item().PaddingTop(2).Text($"{subject.Count} sonuç").FontSize(8).FontColor(Muted);
                    Bar(card, "Öğrenci", subject.Student, accent, max, subject.Unit);
                    Bar(card, "Sınıf ortalaması", subject.ClassAverage, "#475569", max, subject.Unit);
                    if (subject.Student is double s && subject.ClassAverage is double c)
                        card.Item().PaddingTop(6).Text(s >= c ? $"Sınıfın {F(s - c)} {subject.Unit} üzerinde" : $"Sınıfın {F(c - s)} {subject.Unit} altında")
                            .FontSize(8).FontColor(s >= c ? Green : Red);
                });
            }
        });
        var best = report.Subjects.Where(x => x.Student is not null).OrderByDescending(x => x.Student).FirstOrDefault();
        var worst = report.Subjects.Where(x => x.Student is not null).OrderBy(x => x.Student).FirstOrDefault();
        if (best is not null && worst is not null && best != worst)
        {
            column.Item().PaddingTop(12).Background(Card).Border(1).BorderColor(CardLine).Padding(14).Text(text =>
            {
                text.Span("En güçlü ders: ").FontColor(Muted);
                text.Span(best.Subject).Bold().FontColor(Green);
                text.Span("   ·   Geliştirilmesi gereken: ").FontColor(Muted);
                text.Span(worst.Subject).Bold().FontColor(Orange);
            });
        }
    }

    // ── 4. Konu analizi ─────────────────────────────────────────────────────

    private static void Topics(ColumnDescriptor column, StudentSuccessReport report)
    {
        Title(column, "Konu Analizi", report.SolvedQuestions > 0 ? $"{report.SolvedQuestions} çözülen soru üzerinden konu bazlı başarı" : "Konu bazlı başarı");
        if (report.WeakTopics.Count == 0 && report.StrongTopics.Count == 0)
        {
            Empty(column, "Konu analizi için yeterli soru verisi yok. Konu etiketli sınavlar ve optik denemeler yüklendikçe bu bölüm dolar.");
            return;
        }
        if (report.WeakTopics.Count > 0)
        {
            column.Item().PaddingTop(14).Text("Desteğe ihtiyaç duyulan konular").FontSize(12).Bold().FontColor(Orange);
            foreach (var topic in report.WeakTopics.Take(6))
            {
                column.Item().PaddingTop(8).Background(Card).Border(1).BorderColor(CardLine).Padding(12).Column(card =>
                {
                    card.Item().Row(head =>
                    {
                        head.RelativeItem().Text(text =>
                        {
                            text.Span(topic.Topic).FontSize(11).Bold();
                            text.Span($"  {topic.Subject}").FontSize(8).FontColor(Muted);
                        });
                        head.AutoItem().Text(Pct(topic.SuccessRate)).FontSize(11).Bold().FontColor(topic.SuccessRate < 40 ? Red : Orange);
                    });
                    Bar(card, null, topic.SuccessRate, topic.SuccessRate < 40 ? Red : Orange);
                    card.Item().PaddingTop(5).Text(text =>
                    {
                        text.Span($"{DiagnosisLabel(topic.Diagnosis)} · ").FontSize(8).FontColor(Orange).SemiBold();
                        text.Span(Advice(topic.Diagnosis)).FontSize(8).FontColor(Muted);
                        if (topic.ClassRate is double classRate) text.Span($" Sınıf başarısı {Pct(classRate)}.").FontSize(8).FontColor(Muted);
                    });
                });
            }
        }
        if (report.StrongTopics.Count > 0)
        {
            column.Item().PaddingTop(16).Text("Güçlü konular").FontSize(12).Bold().FontColor(Green);
            column.Item().PaddingTop(6).Table(table =>
            {
                table.ColumnsDefinition(columns => { columns.RelativeColumn(2); columns.RelativeColumn(2); columns.ConstantColumn(70); });
                foreach (var topic in report.StrongTopics.Take(8))
                {
                    table.Cell().BorderBottom(1).BorderColor(CardLine).PaddingVertical(5).Text(topic.Topic).SemiBold();
                    table.Cell().BorderBottom(1).BorderColor(CardLine).PaddingVertical(5).Text(topic.Subject).FontColor(Muted);
                    table.Cell().BorderBottom(1).BorderColor(CardLine).PaddingVertical(5).AlignRight().Text(Pct(topic.SuccessRate)).FontColor(Green).Bold();
                }
            });
        }
    }

    // ── 5. Sınav detayları ──────────────────────────────────────────────────

    private static void ExamDetails(ColumnDescriptor column, StudentSuccessReport report)
    {
        Title(column, "Sınav Detayları", "Son sınav sonuçları ve deneme doğru / yanlış / boş dağılımı");
        if (report.Exams.Count == 0 && report.Optical.Count == 0)
        {
            Empty(column, "Kayıtlı sınav sonucu bulunmuyor.");
            return;
        }
        if (report.Exams.Count > 0)
        {
            column.Item().PaddingTop(14).Text("Sınav sonuçları").FontSize(12).Bold().FontColor(Orange);
            column.Item().PaddingTop(6).Table(table =>
            {
                table.ColumnsDefinition(columns => { columns.ConstantColumn(64); columns.RelativeColumn(3); columns.RelativeColumn(2); columns.ConstantColumn(50); columns.ConstantColumn(50); });
                foreach (var (head, index) in new[] { "Tarih", "Sınav", "Ders", "Puan", "Net" }.Select((head, index) => (head, index)))
                {
                    var cell = table.Cell().Background(Card).Padding(6);
                    (index >= 3 ? cell.AlignRight() : cell).Text(head).FontSize(8).Bold().FontColor(Muted);
                }
                foreach (var exam in report.Exams.Take(18))
                {
                    table.Cell().BorderBottom(1).BorderColor(CardLine).Padding(5).Text(exam.Date).FontSize(8.5f);
                    table.Cell().BorderBottom(1).BorderColor(CardLine).Padding(5).Text(exam.Title).FontSize(8.5f);
                    table.Cell().BorderBottom(1).BorderColor(CardLine).Padding(5).Text(exam.Subject).FontSize(8.5f).FontColor(Muted);
                    table.Cell().BorderBottom(1).BorderColor(CardLine).Padding(5).AlignRight().Text(F(exam.Score)).FontSize(8.5f).Bold()
                        .FontColor(exam.Score is < 50 ? Red : exam.Score is >= 85 ? Green : Ink);
                    table.Cell().BorderBottom(1).BorderColor(CardLine).Padding(5).AlignRight().Text(exam.Net is > 0 ? F(exam.Net) : "-").FontSize(8.5f);
                }
            });
        }
        if (report.Optical.Count > 0)
        {
            column.Item().PaddingTop(16).Text("Deneme sınavları (optik)").FontSize(12).Bold().FontColor(Orange);
            column.Item().PaddingTop(6).Table(table =>
            {
                table.ColumnsDefinition(columns => { columns.ConstantColumn(64); columns.RelativeColumn(3); columns.RelativeColumn(2); columns.ConstantColumn(40); columns.ConstantColumn(40); columns.ConstantColumn(40); columns.ConstantColumn(46); });
                foreach (var (head, index) in new[] { "Tarih", "Deneme", "Ders", "D", "Y", "B", "Net" }.Select((head, index) => (head, index)))
                {
                    var cell = table.Cell().Background(Card).Padding(6);
                    (index >= 3 ? cell.AlignRight() : cell).Text(head).FontSize(8).Bold().FontColor(Muted);
                }
                foreach (var row in report.Optical.Take(24))
                {
                    table.Cell().BorderBottom(1).BorderColor(CardLine).Padding(5).Text(row.Date).FontSize(8.5f);
                    table.Cell().BorderBottom(1).BorderColor(CardLine).Padding(5).Text(row.Title).FontSize(8.5f);
                    table.Cell().BorderBottom(1).BorderColor(CardLine).Padding(5).Text(row.Subject).FontSize(8.5f).FontColor(Muted);
                    table.Cell().BorderBottom(1).BorderColor(CardLine).Padding(5).AlignRight().Text(row.Correct.ToString(Tr)).FontSize(8.5f).FontColor(Green);
                    table.Cell().BorderBottom(1).BorderColor(CardLine).Padding(5).AlignRight().Text(row.Wrong.ToString(Tr)).FontSize(8.5f).FontColor(Red);
                    table.Cell().BorderBottom(1).BorderColor(CardLine).Padding(5).AlignRight().Text(row.Blank.ToString(Tr)).FontSize(8.5f).FontColor(Muted);
                    table.Cell().BorderBottom(1).BorderColor(CardLine).Padding(5).AlignRight().Text(F(row.Net)).FontSize(8.5f).Bold();
                }
            });
        }
    }

    // ── 6. Gelişim ──────────────────────────────────────────────────────────

    private static void Growth(ColumnDescriptor column, StudentSuccessReport report)
    {
        Title(column, "Gelişim", "Zaman içindeki sınav puanı ve deneme neti");
        if (report.ScoreTrend.Count < 2 && report.NetTrend.Count < 2)
        {
            Empty(column, "Gelişim grafiği için en az iki sınav sonucu gerekiyor.");
        }
        if (report.ScoreTrend.Count >= 2)
        {
            column.Item().PaddingTop(14).Background(Card).Border(1).BorderColor(CardLine).Padding(14).Column(chart =>
            {
                chart.Item().Text("Sınav puanı").FontSize(11).Bold();
                chart.Item().PaddingTop(8).Height(190).Svg(LineChart(report.ScoreTrend, Orange, 100));
                chart.Item().PaddingTop(6).Text(TrendSentence(report.ScoreTrend, "puan")).FontSize(9).FontColor(Muted);
            });
        }
        if (report.NetTrend.Count >= 2)
        {
            column.Item().PaddingTop(14).Background(Card).Border(1).BorderColor(CardLine).Padding(14).Column(chart =>
            {
                chart.Item().Text("Deneme toplam neti").FontSize(11).Bold();
                chart.Item().PaddingTop(8).Height(170).Svg(LineChart(report.NetTrend, Blue, null));
                chart.Item().PaddingTop(6).Text(TrendSentence(report.NetTrend, "net")).FontSize(9).FontColor(Muted);
            });
        }

        var weak = report.WeakTopics.Take(3).Select(topic => topic.Topic).ToList();
        column.Item().PaddingTop(16).Background(Card).Border(1).BorderColor(CardLine).Padding(16).Column(plan =>
        {
            plan.Item().Text("Önerilen çalışma planı").FontSize(11).Bold().FontColor(Orange);
            plan.Item().PaddingTop(6).Text(weak.Count > 0
                ? $"• Önümüzdeki iki hafta öncelik: {string.Join(", ", weak)}. Her konu için kısa tekrar + 15-20 soruluk test."
                : "• Mevcut tempoyu koruyarak düzenli deneme çözmeye devam edilmesi önerilir.");
            if (report.PendingHomework > 0) plan.Item().PaddingTop(4).Text($"• Bekleyen {report.PendingHomework} ödevin teslim tarihlerine göre tamamlanması.");
            if (report.AttendanceRate is < 90) plan.Item().PaddingTop(4).Text("• Devamsızlığın azaltılması için veliyle iletişim.");
            plan.Item().PaddingTop(4).Text("• Bir sonraki denemeden sonra bu rapor yeniden alınarak ilerleme karşılaştırılabilir.");
        });
    }

    // ── Yardımcılar ─────────────────────────────────────────────────────────

    private static void Title(ColumnDescriptor column, string title, string subtitle)
    {
        column.Item().Row(row =>
        {
            row.ConstantItem(5).Height(26).Background(Orange);
            row.ConstantItem(10);
            row.RelativeItem().Column(text =>
            {
                text.Item().Text(title).FontSize(20).Bold();
                text.Item().Text(subtitle).FontSize(9).FontColor(Muted);
            });
        });
    }

    private static void Empty(ColumnDescriptor column, string message) =>
        column.Item().PaddingTop(16).Background(Card).Border(1).BorderColor(CardLine).Padding(20).AlignCenter().Text(message).FontColor(Muted);

    private static void Bar(ColumnDescriptor column, string? label, double? value, string color, double max = 100, string unit = "%")
    {
        column.Item().PaddingTop(label is null ? 6 : 10).Column(bar =>
        {
            if (label is not null)
            {
                bar.Item().Row(row =>
                {
                    row.RelativeItem().Text(label).FontSize(8).FontColor(Muted);
                    row.AutoItem().Text(value is double number ? (unit == "%" ? Pct(number) : $"{F(number)} {unit}") : "-").FontSize(8).FontColor(Muted);
                });
            }
            var filled = (int)Math.Round((value is double v ? Math.Clamp(v / max, 0, 1) : 0) * 1000);
            bar.Item().PaddingTop(3).Height(6).Row(track =>
            {
                if (filled > 0) track.RelativeItem(filled).Background(color);
                if (filled < 1000) track.RelativeItem(1000 - filled).Background("#1E2B42");
            });
        });
    }

    private static string Initial(string name) => (name ?? string.Empty).Trim().Length > 0 ? name.Trim()[..1].ToUpper(Tr) : "?";

    private static string Avatar(string initial) =>
        $"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 210"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E2E8F0"/><stop offset="1" stop-color="#94A3B8"/></linearGradient></defs><circle cx="105" cy="105" r="102" fill="none" stroke="{Orange}" stroke-width="4"/><circle cx="105" cy="105" r="90" fill="url(#g)"/><text x="105" y="140" font-size="96" font-family="Lato, Arial, sans-serif" font-weight="700" fill="#334155" text-anchor="middle">{System.Security.SecurityElement.Escape(initial)}</text></svg>""";

    private static string Donut(double? value, string color)
    {
        var ratio = Math.Clamp((value ?? 0) / 100, 0, 1);
        const double radius = 54;
        var circumference = 2 * Math.PI * radius;
        var dash = (circumference * ratio).ToString("0.##", CultureInfo.InvariantCulture);
        var gap = circumference.ToString("0.##", CultureInfo.InvariantCulture);
        var label = value is double number ? $"%{Math.Round(number).ToString(Tr)}" : "-";
        return $"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140"><circle cx="70" cy="70" r="{radius}" fill="none" stroke="#1E2B42" stroke-width="16"/><circle cx="70" cy="70" r="{radius}" fill="none" stroke="{color}" stroke-width="16" stroke-linecap="round" stroke-dasharray="{dash} {gap}" transform="rotate(-90 70 70)"/><text x="70" y="79" font-size="26" font-family="Lato, Arial, sans-serif" font-weight="700" fill="#FFFFFF" text-anchor="middle">{label}</text></svg>""";
    }

    private static string LineChart(IReadOnlyList<SuccessTrendPoint> points, string color, double? fixedMax)
    {
        const double width = 500, height = 190, left = 34, right = 12, top = 12, bottom = 30;
        var max = fixedMax ?? Math.Max(1, points.Max(point => point.Value) * 1.15);
        var min = fixedMax is null ? Math.Max(0, points.Min(point => point.Value) * 0.8) : 0;
        var inv = CultureInfo.InvariantCulture;
        double X(int index) => left + (points.Count == 1 ? 0 : index * (width - left - right) / (points.Count - 1));
        double Y(double value) => top + (1 - (value - min) / Math.Max(0.0001, max - min)) * (height - top - bottom);
        var svg = new StringBuilder($"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">""");
        for (var i = 0; i <= 4; i++)
        {
            var value = min + (max - min) * i / 4;
            var y = Y(value).ToString("0.#", inv);
            svg.Append($"""<line x1="{left}" y1="{y}" x2="{width - right}" y2="{y}" stroke="#1E2B42" stroke-width="1"/><text x="{left - 6}" y="{y}" dy="3" font-size="9" fill="{Muted}" text-anchor="end" font-family="Lato, Arial, sans-serif">{Math.Round(value).ToString(inv)}</text>""");
        }
        var path = string.Join(" ", points.Select((point, index) => $"{(index == 0 ? "M" : "L")}{X(index).ToString("0.#", inv)},{Y(point.Value).ToString("0.#", inv)}"));
        svg.Append($"""<path d="{path}" fill="none" stroke="{color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>""");
        var labelEvery = Math.Max(1, (int)Math.Ceiling(points.Count / 8.0));
        for (var index = 0; index < points.Count; index++)
        {
            var x = X(index).ToString("0.#", inv);
            var y = Y(points[index].Value).ToString("0.#", inv);
            svg.Append($"""<circle cx="{x}" cy="{y}" r="4" fill="{Bg}" stroke="{color}" stroke-width="2"/>""");
            if (index % labelEvery == 0 || index == points.Count - 1)
            {
                svg.Append($"""<text x="{x}" y="{height - 10}" font-size="9" fill="{Muted}" text-anchor="middle" font-family="Lato, Arial, sans-serif">{System.Security.SecurityElement.Escape(points[index].Label)}</text>""");
                svg.Append($"""<text x="{x}" y="{y}" dy="-9" font-size="9" fill="#FFFFFF" text-anchor="middle" font-family="Lato, Arial, sans-serif">{points[index].Value.ToString("0.#", Tr)}</text>""");
            }
        }
        return svg.Append("</svg>").ToString();
    }

    private static string TrendSentence(IReadOnlyList<SuccessTrendPoint> points, string unit)
    {
        var first = points[0].Value;
        var last = points[^1].Value;
        var delta = last - first;
        return Math.Abs(delta) < 0.5
            ? $"İlk ve son sınav arasında belirgin bir değişim yok ({F(first)} → {F(last)} {unit})."
            : delta > 0
                ? $"İlk sınavdan son sınava {F(delta)} {unit} artış var ({F(first)} → {F(last)})."
                : $"İlk sınavdan son sınava {F(-delta)} {unit} düşüş var ({F(first)} → {F(last)}); destek planı önerilir.";
    }

    private static string DiagnosisLabel(string? diagnosis) => diagnosis switch
    {
        "skipping" => "Boş bırakma",
        "declining" => "Düşüşte",
        _ => "Kavram yanılgısı",
    };

    private static string Advice(string? diagnosis) => diagnosis switch
    {
        "skipping" => "Sorular sık boş bırakılıyor; kolaydan zora kısa testlerle soruya başlama alışkanlığı kazandırılmalı.",
        "declining" => "Son çalışmalarda düşüş var; kısa bir konu tekrarı ve son yanlışların yeniden çözülmesi önerilir.",
        _ => "Yanlışlar ağırlıkta; temel kurallar tekrar edilip çözümlü örneklerle hata nedenleri incelenmeli.",
    };

    private static byte[] Qr(string content)
    {
        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(content, QRCodeGenerator.ECCLevel.M);
        return new PngByteQRCode(data).GetGraphic(8, [255, 255, 255], [8, 17, 31]);
    }
}
