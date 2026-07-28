using System.Globalization;
using CourseIntellect.Application.Interfaces;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// İmzalı (veya boş önizleme) onam formunun logolu PDF çıktısı.
///
/// Metin biçimleme, personelin yazdığı düz metinden okunur bir belge üretir:
/// "1. BAŞLIK" satırı başlık, "•"/"-" ile başlayan satır madde imi, kalanı paragraf.
/// QuestPDF'in varsayılan yazı tipi Türkçe karakterleri (ğ ş ı İ) basar; ayrıca
/// font gömmek gerekmez.
/// </summary>
public sealed class ConsentFormPdfService : IConsentFormPdfService
{
    static ConsentFormPdfService() => QuestPDF.Settings.License = LicenseType.Community;

    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");
    private const string Ink = "#1A2433";
    private const string Muted = "#6B7A8D";
    private const string Line = "#D7DEE7";

    public byte[] Generate(ConsentPdfModel model)
    {
        var accent = NormalizeColor(model.AccentColor);

        return Document.Create(document => document.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(32);
            page.DefaultTextStyle(x => x.FontSize(9.5f).FontColor(Ink));

            page.Header().Element(header => ComposeHeader(header, model, accent));
            page.Content().Element(content => ComposeContent(content, model, accent));
            page.Footer().Element(footer => ComposeFooter(footer, model));
        })).GeneratePdf();
    }

    private static void ComposeHeader(IContainer container, ConsentPdfModel model, string accent) =>
        container.Column(header =>
        {
            header.Item().Row(row =>
            {
                if (model.LogoBytes is { Length: > 0 })
                {
                    row.ConstantItem(38).Height(38).AlignMiddle().Image(model.LogoBytes).FitArea();
                    row.ConstantItem(10);
                }

                row.RelativeItem().AlignMiddle().Column(brand =>
                {
                    brand.Item().Text(model.InstitutionName.ToUpper(Tr)).FontSize(12).Bold();
                    brand.Item().Text(model.Title).FontSize(14).Bold().FontColor(accent);
                });
            });

            header.Item().PaddingTop(8).LineHorizontal(1.2f).LineColor(accent);
        });

    private static void ComposeContent(IContainer container, ConsentPdfModel model, string accent) =>
        container.PaddingTop(12).Column(content =>
        {
            ComposeContextBox(content, model, accent);

            content.Item().PaddingTop(12).Column(body =>
            {
                foreach (var line in SplitLines(model.Body))
                {
                    ComposeBodyLine(body, line, accent);
                }
            });

            if (model.CheckItems.Count > 0)
            {
                content.Item().PaddingTop(14).Text("ONAY MADDELERİ").FontSize(10).Bold().FontColor(accent);
                content.Item().PaddingTop(4).Column(items =>
                {
                    for (var index = 0; index < model.CheckItems.Count; index++)
                    {
                        var isChecked = model.CheckedItems.Contains(index);
                        items.Item().PaddingBottom(3).Row(row =>
                        {
                            row.ConstantItem(18).Text(isChecked ? "[X]" : "[ ]")
                                .FontSize(9.5f).Bold().FontColor(isChecked ? accent : Muted);
                            row.RelativeItem().Text(model.CheckItems[index])
                                .FontSize(9.5f).FontColor(isChecked ? Ink : Muted);
                        });
                    }
                });
            }

            if (!string.IsNullOrWhiteSpace(model.StaffNotes))
            {
                content.Item().PaddingTop(14).Text("UYGULAMA NOTLARI").FontSize(10).Bold().FontColor(accent);
                content.Item().PaddingTop(4).Border(0.8f).BorderColor(Line).Padding(8)
                    .Text(model.StaffNotes).FontSize(9);
            }

            content.Item().PaddingTop(20).Element(signature => ComposeSignature(signature, model, accent));
        });

    private static void ComposeContextBox(ColumnDescriptor column, ConsentPdfModel model, string accent) =>
        column.Item().Border(0.8f).BorderColor(Line).Padding(9).Row(row =>
        {
            row.RelativeItem().Column(left =>
            {
                Field(left, "Öğrenci", model.StudentName, accent);
                if (!string.IsNullOrWhiteSpace(model.ContextLabel)) Field(left, "Konu", model.ContextLabel, accent);
            });

            row.ConstantItem(210).Column(right =>
            {
                // Personel adı çözülemediyse satır hiç açılmaz — e-postaya düşülmez.
                if (!string.IsNullOrWhiteSpace(model.StaffName)) Field(right, "Uygulayan", model.StaffName, accent, 70);
                Field(right, "Tarih",
                    (model.SignedAtUtc?.ToLocalTime() ?? DateTime.Now).ToString("dd.MM.yyyy", Tr), accent, 70);
            });
        });

    private static void ComposeBodyLine(ColumnDescriptor column, string line, string accent)
    {
        if (line.Length == 0)
        {
            column.Item().Height(6);
            return;
        }

        if (IsHeading(line))
        {
            column.Item().PaddingTop(8).PaddingBottom(2)
                .Text(line).FontSize(10).Bold().FontColor(accent);
            return;
        }

        if (line.StartsWith('•') || line.StartsWith('-'))
        {
            column.Item().PaddingBottom(2).Row(row =>
            {
                row.ConstantItem(12).Text("•").FontSize(9.5f).FontColor(accent);
                row.RelativeItem().Text(line[1..].Trim()).FontSize(9.5f).LineHeight(1.35f);
            });
            return;
        }

        column.Item().PaddingBottom(4).Text(line).FontSize(9.5f).LineHeight(1.35f).Justify();
    }

    /// <summary>"1. GENEL HÜKÜMLER" gibi numaralı ve büyük harfli satırlar başlıktır.</summary>
    private static bool IsHeading(string line)
    {
        var dot = line.IndexOf('.');
        if (dot is < 1 or > 3) return false;
        if (!int.TryParse(line[..dot], NumberStyles.Integer, CultureInfo.InvariantCulture, out _)) return false;

        var rest = line[(dot + 1)..].Trim();
        return rest.Length > 0 && rest == rest.ToUpper(Tr);
    }

    private static void ComposeSignature(IContainer container, ConsentPdfModel model, string accent) =>
        container.Row(row =>
        {
            row.RelativeItem().Column(left =>
            {
                if (model.SignatureImage is { Length: > 0 })
                {
                    left.Item().Height(58).AlignLeft().Image(model.SignatureImage).FitHeight();
                }
                else
                {
                    // Islak imza için boş alan (şablon önizlemesi / imzasız belge).
                    left.Item().Height(58);
                }

                left.Item().Width(190).LineHorizontal(0.8f).LineColor(Ink);
                left.Item().PaddingTop(3).Text(model.SignerLabel).FontSize(8.5f).FontColor(Muted);

                if (!string.IsNullOrWhiteSpace(model.SignerName))
                {
                    var suffix = string.IsNullOrWhiteSpace(model.SignerRelation) ? string.Empty : $" ({model.SignerRelation})";
                    left.Item().Text($"{model.SignerName}{suffix}").FontSize(9).Bold();
                }
            });

            row.ConstantItem(210).AlignBottom().Column(right =>
            {
                if (model.SignedAtUtc is DateTime signedAt)
                {
                    right.Item().AlignRight().Text(signedAt.ToLocalTime().ToString("dd.MM.yyyy HH:mm", Tr))
                        .FontSize(9).Bold().FontColor(accent);
                    right.Item().AlignRight().Text("Dijital olarak tablet üzerinden imzalanmıştır.")
                        .FontSize(7.5f).FontColor(Muted);
                }
                else
                {
                    right.Item().AlignRight().Text("Tarih: ......../......../20......").FontSize(9).FontColor(Muted);
                }
            });
        });

    private static void ComposeFooter(IContainer container, ConsentPdfModel model) =>
        container.Column(footer =>
        {
            footer.Item().LineHorizontal(0.5f).LineColor(Line);
            footer.Item().PaddingTop(5).Row(row =>
            {
                var note = string.IsNullOrWhiteSpace(model.FooterNote)
                    ? $"{model.InstitutionName} • {model.Title}"
                    : model.FooterNote;
                row.RelativeItem().Text(note).FontSize(7.5f).FontColor(Muted);
                row.RelativeItem().AlignRight().Text(text =>
                {
                    text.DefaultTextStyle(x => x.FontSize(7.5f).FontColor(Muted));
                    text.Span("Sayfa ");
                    text.CurrentPageNumber();
                    text.Span(" / ");
                    text.TotalPages();
                });
            });
        });

    private static void Field(ColumnDescriptor column, string label, string value, string accent, float labelWidth = 78) =>
        column.Item().PaddingBottom(3).Row(row =>
        {
            row.ConstantItem(labelWidth).Text(label).FontSize(8.5f).FontColor(Muted);
            row.ConstantItem(8).Text(":").FontSize(8.5f).FontColor(Muted);
            row.RelativeItem().Text(string.IsNullOrWhiteSpace(value) ? "-" : value).FontSize(8.5f).FontColor(accent);
        });

    private static IEnumerable<string> SplitLines(string body) =>
        (body ?? string.Empty).Replace("\r\n", "\n").Replace('\r', '\n').Split('\n').Select(x => x.Trim());

    private static string NormalizeColor(string? value)
    {
        var color = (value ?? string.Empty).Trim();
        return color.StartsWith('#') && (color.Length == 7 || color.Length == 4) ? color : "#0F4C81";
    }
}
