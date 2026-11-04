using System.Globalization;
using System.Text.Json;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Asistanın rapor kartının PDF dökümü. Girdi, mesajla birlikte saklanan rapor verisidir; burada
/// hiçbir değer yeniden hesaplanmaz, yalnız yerleşim yapılır (kartta ne görüldüyse PDF'te o var).
/// </summary>
public static class AssistantReportPdf
{
    private const string Ink = "#1F2937";
    private const string Muted = "#6B7280";
    private const string Line = "#D6DEE7";
    private const string HeadBg = "#EEF1F6";
    private const string ZebraBg = "#F8FAFC";
    private const string Accent = "#2563EB";
    private const string Warn = "#B42318";

    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    static AssistantReportPdf() => QuestPDF.Settings.License = LicenseType.Community;

    public static byte[] Render(JsonElement report, string institutionName, string summary, DateTime generatedAtUtc)
    {
        string Text(JsonElement element, string name) =>
            element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() ?? string.Empty : string.Empty;
        IReadOnlyList<JsonElement> Array(JsonElement element, string name) =>
            element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Array ? value.EnumerateArray().ToList() : [];

        var title = Text(report, "title");
        var subtitle = Text(report, "subtitle");
        var metrics = Array(report, "metrics");
        var columns = Array(report, "columns");
        var rows = Array(report, "rows");
        var sections = Array(report, "sections");
        var notes = Array(report, "notes");

        return Document.Create(document => document.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(30);
            page.DefaultTextStyle(x => x.FontSize(9).FontColor(Ink));

            page.Header().Column(header =>
            {
                header.Item().Row(row =>
                {
                    row.RelativeItem().Text("SchoolAsist").FontSize(15).Bold();
                    row.ConstantItem(260).AlignRight().Text(institutionName.ToUpper(Tr)).FontSize(10).Bold();
                });
                header.Item().PaddingTop(6).LineHorizontal(1.2f).LineColor(Accent);
            });

            page.Content().PaddingTop(14).Column(content =>
            {
                content.Item().Text(title).FontSize(14).Bold();
                if (subtitle.Length > 0) content.Item().PaddingTop(2).Text(subtitle).FontColor(Muted);
                if (summary.Length > 0) content.Item().PaddingTop(10).Text(summary).FontSize(10);

                if (metrics.Count > 0)
                {
                    content.Item().PaddingTop(12).Table(table =>
                    {
                        var perRow = Math.Min(4, metrics.Count);
                        table.ColumnsDefinition(definition => { for (var i = 0; i < perRow; i++) definition.RelativeColumn(); });
                        foreach (var metric in metrics)
                        {
                            table.Cell().Padding(3).Border(0.5f).BorderColor(Line).Background(HeadBg).Padding(6).Column(cell =>
                            {
                                cell.Item().Text(Text(metric, "label")).FontSize(8).FontColor(Muted);
                                cell.Item().Text(Text(metric, "value")).FontSize(12).Bold().FontColor(Text(metric, "tone") == "warn" ? Warn : Ink);
                            });
                        }
                    });
                }

                if (columns.Count > 0 && rows.Count > 0)
                {
                    content.Item().PaddingTop(14).Table(table =>
                    {
                        table.ColumnsDefinition(definition =>
                        {
                            foreach (var column in columns)
                            {
                                if (Text(column, "key") == "rank") definition.ConstantColumn(24);
                                else if (Text(column, "align") == "right") definition.ConstantColumn(70);
                                else definition.RelativeColumn();
                            }
                        });
                        table.Header(head =>
                        {
                            foreach (var column in columns)
                            {
                                var cell = head.Cell().Background(HeadBg).Border(0.5f).BorderColor(Line).Padding(5);
                                (Text(column, "align") == "right" ? cell.AlignRight() : cell).Text(Text(column, "label")).SemiBold().FontSize(8);
                            }
                        });
                        for (var index = 0; index < rows.Count; index++)
                        {
                            var background = index % 2 == 1 ? ZebraBg : "#FFFFFF";
                            foreach (var column in columns)
                            {
                                var key = Text(column, "key");
                                var value = rows[index].TryGetProperty(key, out var raw) ? Format(raw) : string.Empty;
                                var cell = table.Cell().Background(background).Border(0.5f).BorderColor(Line).Padding(5);
                                (Text(column, "align") == "right" ? cell.AlignRight() : cell).Text(value).FontSize(8.5f);
                            }
                        }
                    });
                }

                foreach (var section in sections)
                {
                    content.Item().PaddingTop(14).Text(Text(section, "title")).FontSize(11).Bold().FontColor(Accent);
                    foreach (var line in Array(section, "lines"))
                        content.Item().PaddingTop(3).PaddingLeft(8).Text($"• {line.GetString()}");
                }

                foreach (var note in notes)
                    content.Item().PaddingTop(10).Text(note.GetString() ?? string.Empty).FontSize(8).FontColor(Muted);
            });

            page.Footer().Row(row =>
            {
                row.RelativeItem().Text($"{AssistantSmallTalk.Name} (SchoolAsist asistanı) tarafından {generatedAtUtc.AddHours(3):dd.MM.yyyy HH:mm} tarihinde hazırlandı. Değerler kayıtlardan hesaplanmıştır.").FontSize(7).FontColor(Muted);
                row.ConstantItem(60).AlignRight().Text(text =>
                {
                    text.CurrentPageNumber().FontSize(7).FontColor(Muted);
                    text.Span(" / ").FontSize(7).FontColor(Muted);
                    text.TotalPages().FontSize(7).FontColor(Muted);
                });
            });
        })).GeneratePdf();
    }

    private static string Format(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.Number when value.TryGetInt64(out var whole) => whole.ToString("N0", Tr),
        JsonValueKind.Number => value.GetDouble().ToString("N1", Tr),
        JsonValueKind.String => value.GetString() ?? string.Empty,
        JsonValueKind.Null or JsonValueKind.Undefined => "-",
        _ => value.ToString(),
    };
}
