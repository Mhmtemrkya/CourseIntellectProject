using ClosedXML.Excel;
using CourseIntellect.Application.DTOs.DrivingMebbis;
using CourseIntellect.Application.Interfaces;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// MEBBİS dışa aktarım belgesini Excel (.xlsx, fotoğraf gömülü) ve PDF çıktısına
/// çevirir. Fotoğraf sütununda görsel, ilgili hücreye yerleştirilir.
/// </summary>
public sealed class MebbisExportRenderer : IMebbisExportRenderer
{
    static MebbisExportRenderer() => QuestPDF.Settings.License = LicenseType.Community;

    // Fotoğraf hücresi ölçüleri (px) — MEBBİS biyometrik oranına yakın 4:5.
    private const int PhotoWidthPx = 60;
    private const int PhotoHeightPx = 75;

    public byte[] ToXlsx(MebbisExportDocument document)
    {
        using var workbook = new XLWorkbook();
        var sheetName = string.IsNullOrWhiteSpace(document.SheetName) ? "MEBBIS" : document.SheetName;
        // Excel sayfa adı 31 karakterle sınırlı ve bazı karakterleri kabul etmez.
        foreach (var invalid in new[] { '\\', '/', '?', '*', '[', ']', ':' }) sheetName = sheetName.Replace(invalid, ' ');
        if (sheetName.Length > 31) sheetName = sheetName[..31];
        var ws = workbook.Worksheets.Add(sheetName);

        var columnCount = document.Columns.Count;
        var row = 1;

        // Başlık ve alt başlık (birleştirilmiş üst satırlar).
        ws.Cell(row, 1).Value = document.Title;
        ws.Range(row, 1, row, Math.Max(1, columnCount)).Merge();
        ws.Cell(row, 1).Style.Font.Bold = true;
        ws.Cell(row, 1).Style.Font.FontSize = 14;
        row++;
        if (!string.IsNullOrWhiteSpace(document.Subtitle))
        {
            ws.Cell(row, 1).Value = document.Subtitle;
            ws.Range(row, 1, row, Math.Max(1, columnCount)).Merge();
            ws.Cell(row, 1).Style.Font.FontColor = XLColor.FromHtml("#5B6B7B");
            ws.Cell(row, 1).Style.Font.FontSize = 10;
            row++;
        }
        row++; // boş satır

        var headerRow = row;
        for (var c = 0; c < columnCount; c++)
        {
            var col = document.Columns[c];
            var cell = ws.Cell(headerRow, c + 1);
            cell.Value = col.Header;
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#1F6FEB");
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            ws.Column(c + 1).Width = col.IsPhoto ? 11 : Math.Max(8, col.Width);
        }
        ws.SheetView.FreezeRows(headerRow);
        row++;

        foreach (var dataRow in document.Rows)
        {
            var hasPhotoCol = document.Columns.Any(x => x.IsPhoto);
            if (hasPhotoCol) ws.Row(row).Height = PhotoHeightPx * 0.78; // px → pt yaklaşık
            for (var c = 0; c < columnCount; c++)
            {
                var col = document.Columns[c];
                var cell = ws.Cell(row, c + 1);
                cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                cell.Style.Border.OutsideBorderColor = XLColor.FromHtml("#D6DEE6");
                cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                if (col.IsPhoto)
                {
                    cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    if (dataRow.Photo is { Length: > 0 })
                    {
                        try
                        {
                            using var stream = new MemoryStream(dataRow.Photo);
                            ws.AddPicture(stream)
                                .MoveTo(ws.Cell(row, c + 1), 3, 2)
                                .WithSize(PhotoWidthPx, PhotoHeightPx);
                        }
                        catch
                        {
                            // Bozuk/desteklenmeyen görsel: hücreyi boş bırak, dışa aktarımı bozma.
                            cell.Value = "—";
                        }
                    }
                    else
                    {
                        cell.Value = "—";
                    }
                }
                else
                {
                    var text = c < dataRow.Cells.Count ? dataRow.Cells[c] : string.Empty;
                    // Uzun kimlik/sertifika numaralarının bilimsel gösterime düşmemesi için metin.
                    cell.SetValue(text);
                    cell.Style.Alignment.WrapText = false;
                }
            }
            row++;
        }

        using var output = new MemoryStream();
        workbook.SaveAs(output);
        return output.ToArray();
    }

    public byte[] ToPdf(MebbisExportDocument document)
    {
        var accent = "#1F6FEB";
        var hasPhoto = document.Columns.Any(x => x.IsPhoto);
        var generatedAt = DateTime.UtcNow.AddHours(3);

        return Document.Create(container => container.Page(page =>
        {
            page.Size(document.Columns.Count > 6 || hasPhoto ? PageSizes.A4.Landscape() : PageSizes.A4);
            page.Margin(24);
            page.DefaultTextStyle(x => x.FontSize(8).FontColor("#243342"));

            page.Header().Column(header =>
            {
                header.Item().Text(document.Title).FontSize(15).Bold().FontColor(accent);
                if (!string.IsNullOrWhiteSpace(document.Subtitle))
                    header.Item().PaddingTop(2).Text(document.Subtitle).FontSize(9).FontColor("#5B6B7B");
                header.Item().PaddingTop(2).Text($"Döküm: {generatedAt:dd.MM.yyyy HH:mm}").FontSize(7).FontColor("#8496A6");
                header.Item().PaddingTop(6).LineHorizontal(1.2f).LineColor(accent);
            });

            page.Content().PaddingVertical(10).Column(content =>
            {
                if (document.Rows.Count == 0)
                {
                    content.Item().PaddingTop(30).AlignCenter().Text("Kayıt bulunamadı.").FontColor("#8496A6");
                    return;
                }

                content.Item().Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        foreach (var column in document.Columns)
                        {
                            if (column.IsPhoto) columns.ConstantColumn(52);
                            else columns.RelativeColumn();
                        }
                    });

                    table.Header(head =>
                    {
                        foreach (var column in document.Columns)
                            head.Cell().Background(accent).Padding(4)
                                .Text(column.Header).FontColor("#FFFFFF").SemiBold().FontSize(8);
                    });

                    for (var index = 0; index < document.Rows.Count; index++)
                    {
                        var dataRow = document.Rows[index];
                        var background = index % 2 == 0 ? "#FFFFFF" : "#F5F8FA";
                        for (var c = 0; c < document.Columns.Count; c++)
                        {
                            var column = document.Columns[c];
                            var cell = table.Cell().Background(background).BorderBottom(0.5f).BorderColor("#E2E8F0").Padding(4);
                            if (column.IsPhoto)
                            {
                                if (dataRow.Photo is { Length: > 0 })
                                {
                                    try { cell.Height(48).AlignCenter().Image(dataRow.Photo).FitArea(); }
                                    catch { cell.AlignCenter().Text("—").FontColor("#8496A6"); }
                                }
                                else cell.AlignCenter().Text("—").FontColor("#8496A6");
                            }
                            else
                            {
                                var text = c < dataRow.Cells.Count ? dataRow.Cells[c] : string.Empty;
                                cell.AlignMiddle().Text(text).FontSize(8);
                            }
                        }
                    }
                });
            });

            page.Footer().AlignRight().Text(text =>
            {
                text.Span("Sayfa ").FontSize(7).FontColor("#8496A6");
                text.CurrentPageNumber().FontSize(7).FontColor("#8496A6");
                text.Span(" / ").FontSize(7).FontColor("#8496A6");
                text.TotalPages().FontSize(7).FontColor("#8496A6");
            });
        })).GeneratePdf();
    }
}
