using CourseIntellect.Application.Interfaces;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Sürücü kursu raporlarının kurum başlıklı PDF dökümü. Sertifika PDF'iyle aynı
/// QuestPDF altyapısını kullanır; imzaya/denetime sunulabilecek düz bir tablo üretir.
/// </summary>
public sealed class DrivingReportPdfService : IDrivingReportPdfService
{
    static DrivingReportPdfService() => QuestPDF.Settings.License = LicenseType.Community;

    public byte[] Generate(DrivingReportDocument model)
    {
        var accent = NormalizeColor(model.PrimaryColor);
        var generatedAt = DateTime.UtcNow.AddHours(3); // Rapor yerel saatle imzalanır (UTC+3).

        return Document.Create(document => document.Page(page =>
        {
            // Sütun sayısı arttıkça dikey A4 taşar; geniş raporu yatıra alıyoruz.
            page.Size(model.Columns.Count > 6 ? PageSizes.A4.Landscape() : PageSizes.A4);
            page.Margin(28);
            page.DefaultTextStyle(x => x.FontSize(9).FontColor("#243342"));

            page.Header().Column(header =>
            {
                header.Item().Row(row =>
                {
                    if (model.LogoBytes is { Length: > 0 })
                    {
                        row.ConstantItem(64).Height(44).AlignMiddle().Image(model.LogoBytes).FitArea();
                        row.ConstantItem(12);
                    }

                    row.RelativeItem().Column(titles =>
                    {
                        titles.Item().Text(model.InstitutionName).FontSize(13).SemiBold().FontColor(accent);
                        titles.Item().PaddingTop(2).Text(model.Title).FontSize(17).Bold();
                        if (!string.IsNullOrWhiteSpace(model.Description))
                            titles.Item().PaddingTop(2).Text(model.Description).FontSize(9).FontColor("#5B6B7B");
                    });

                    row.ConstantItem(150).AlignRight().Column(meta =>
                    {
                        meta.Item().AlignRight().Text($"{Local(model.FromUtc):dd.MM.yyyy} – {Local(model.ToUtc):dd.MM.yyyy}").SemiBold();
                        meta.Item().AlignRight().PaddingTop(2).Text($"Döküm: {generatedAt:dd.MM.yyyy HH:mm}").FontSize(8).FontColor("#8496A6");
                    });
                });

                header.Item().PaddingTop(10).LineHorizontal(1.4f).LineColor(accent);
            });

            page.Content().PaddingVertical(12).Column(content =>
            {
                if (model.Summary.Count > 0)
                {
                    content.Item().PaddingBottom(12).Row(row =>
                    {
                        foreach (var (label, value) in model.Summary)
                        {
                            row.RelativeItem().Border(1).BorderColor("#DCE4EB").Background("#F7F9FB").Padding(8).Column(box =>
                            {
                                box.Item().Text(label).FontSize(8).FontColor("#6B7C8C");
                                box.Item().PaddingTop(2).Text(value).FontSize(13).Bold().FontColor(accent);
                            });
                            row.ConstantItem(6);
                        }
                    });
                }

                if (model.Rows.Count == 0)
                {
                    content.Item().PaddingTop(30).AlignCenter()
                        .Text("Seçilen tarih aralığında kayıt bulunamadı.").FontColor("#8496A6");
                    return;
                }

                content.Item().Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        foreach (var column in model.Columns)
                        {
                            if (column.Numeric) columns.ConstantColumn(62);
                            else columns.RelativeColumn();
                        }
                    });

                    table.Header(head =>
                    {
                        foreach (var column in model.Columns)
                        {
                            var cell = head.Cell().Background(accent).Padding(5);
                            var text = cell.Text(column.Header).FontColor("#FFFFFF").SemiBold().FontSize(9);
                            if (column.Numeric) text.AlignRight();
                        }
                    });

                    for (var index = 0; index < model.Rows.Count; index++)
                    {
                        var row = model.Rows[index];
                        var background = index % 2 == 0 ? "#FFFFFF" : "#F5F8FA";

                        for (var c = 0; c < model.Columns.Count; c++)
                        {
                            var value = c < row.Count ? row[c] : string.Empty;
                            var cell = table.Cell().Background(background)
                                .BorderBottom(0.5f).BorderColor("#E3E9EE").Padding(5);
                            var text = cell.Text(value).FontSize(9);
                            if (model.Columns[c].Numeric) text.AlignRight();
                        }
                    }
                });
            });

            page.Footer().Column(footer =>
            {
                footer.Item().LineHorizontal(0.5f).LineColor("#DCE4EB");
                footer.Item().PaddingTop(5).Row(row =>
                {
                    row.RelativeItem().Text($"{model.InstitutionName} • {model.Title}").FontSize(8).FontColor("#8496A6");
                    row.RelativeItem().AlignRight().Text(text =>
                    {
                        text.DefaultTextStyle(x => x.FontSize(8).FontColor("#8496A6"));
                        text.Span("Sayfa ");
                        text.CurrentPageNumber();
                        text.Span(" / ");
                        text.TotalPages();
                    });
                });
            });
        })).GeneratePdf();
    }

    private static DateTime Local(DateTime utc) => utc.AddHours(3);

    private static string NormalizeColor(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "#173B57";
        var trimmed = value.Trim();
        if (!trimmed.StartsWith('#')) trimmed = "#" + trimmed;
        return trimmed.Length is 4 or 7 ? trimmed : "#173B57";
    }
}
