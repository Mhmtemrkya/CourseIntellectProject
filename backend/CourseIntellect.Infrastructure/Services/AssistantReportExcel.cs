using System.Text.Json;
using ClosedXML.Excel;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Asistanın rapor kartının Excel dökümü (PDF ile aynı kayıtlı veriden; değer yeniden hesaplanmaz).
/// "Rapor" sayfasında tablo sayısal hücrelerle (filtre ve sıralama açık), "Özet" sayfasında metrikler,
/// bölümler ve notlar yer alır.
/// </summary>
public static class AssistantReportExcel
{
    public static byte[] Render(JsonElement report, string institutionName, string summary, DateTime generatedAtUtc)
    {
        static string Text(JsonElement element, string name) =>
            element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() ?? string.Empty : string.Empty;
        static IReadOnlyList<JsonElement> Array(JsonElement element, string name) =>
            element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Array ? value.EnumerateArray().ToList() : [];

        var title = Text(report, "title");
        var columns = Array(report, "columns");
        var rows = Array(report, "rows");

        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("Rapor");
        sheet.Cell(1, 1).Value = title;
        sheet.Cell(1, 1).Style.Font.SetBold().Font.SetFontSize(14);
        sheet.Cell(2, 1).Value = $"{institutionName} · {generatedAtUtc.AddHours(3):dd.MM.yyyy HH:mm}";
        sheet.Cell(2, 1).Style.Font.SetFontColor(XLColor.Gray);

        const int headerRow = 4;
        if (columns.Count > 0)
        {
            for (var c = 0; c < columns.Count; c++)
            {
                var cell = sheet.Cell(headerRow, c + 1);
                cell.Value = Text(columns[c], "label");
                cell.Style.Font.SetBold().Fill.SetBackgroundColor(XLColor.FromHtml("#EEF1F6"));
            }
            for (var r = 0; r < rows.Count; r++)
            {
                for (var c = 0; c < columns.Count; c++)
                {
                    var key = Text(columns[c], "key");
                    if (!rows[r].TryGetProperty(key, out var raw)) continue;
                    var cell = sheet.Cell(headerRow + 1 + r, c + 1);
                    switch (raw.ValueKind)
                    {
                        // Sayılar sayı olarak yazılır: Excel'de toplanabilir ve sıralanabilir.
                        case JsonValueKind.Number: cell.Value = raw.GetDouble(); break;
                        case JsonValueKind.String: cell.Value = raw.GetString() ?? string.Empty; break;
                        case JsonValueKind.True or JsonValueKind.False: cell.Value = raw.GetBoolean() ? "Evet" : "Hayır"; break;
                        case JsonValueKind.Null or JsonValueKind.Undefined: break;
                        default: cell.Value = raw.ToString(); break;
                    }
                }
            }
            var range = sheet.Range(headerRow, 1, headerRow + Math.Max(rows.Count, 1), columns.Count);
            range.SetAutoFilter();
            sheet.SheetView.FreezeRows(headerRow);
            sheet.Columns(1, columns.Count).AdjustToContents(headerRow, headerRow + Math.Min(rows.Count, 500));
        }
        else
        {
            sheet.Cell(headerRow, 1).Value = "Bu raporda tablo yok; özet sayfasına bakın.";
        }

        var overview = workbook.Worksheets.Add("Özet");
        var line = 1;
        overview.Cell(line++, 1).Value = title;
        overview.Cell(1, 1).Style.Font.SetBold().Font.SetFontSize(13);
        if (!string.IsNullOrWhiteSpace(summary)) overview.Cell(line++, 1).Value = summary;
        line++;
        foreach (var metric in Array(report, "metrics"))
        {
            overview.Cell(line, 1).Value = Text(metric, "label");
            if (metric.TryGetProperty("value", out var value))
                overview.Cell(line, 2).Value = value.ValueKind == JsonValueKind.Number ? value.GetDouble() : value.ToString();
            line++;
        }
        foreach (var section in Array(report, "sections"))
        {
            line++;
            overview.Cell(line, 1).Value = Text(section, "title");
            overview.Cell(line++, 1).Style.Font.SetBold();
            foreach (var item in Array(section, "lines")) overview.Cell(line++, 1).Value = $"• {item.GetString()}";
        }
        foreach (var note in Array(report, "notes"))
        {
            line++;
            overview.Cell(line, 1).Value = note.GetString() ?? string.Empty;
            overview.Cell(line, 1).Style.Font.SetFontColor(XLColor.Gray);
        }
        overview.Column(1).Width = 60;
        overview.Column(2).Width = 18;

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }
}
