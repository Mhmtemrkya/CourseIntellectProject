using System.Globalization;
using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Cari hesap ekstresinin baskıya/veliye verilebilir PDF dökümü: solda kurumsal
/// logo, sağda kurum künyesi, ortada tarih sıralı borç/alacak tablosu ve yürüyen
/// bakiye. Tüm değerler sunucuda hesaplanmış olarak gelir (bkz.
/// <see cref="StudentStatementDto"/>); burada yalnızca yerleşim yapılır.
/// </summary>
public sealed class StudentStatementPdfService : IStudentStatementPdfService
{
    private const string Ink = "#1F2937";
    private const string Muted = "#6B7280";
    private const string Line = "#D6DEE7";
    private const string HeadBg = "#EEF1F6";
    private const string ZebraBg = "#F8FAFC";

    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    static StudentStatementPdfService() => QuestPDF.Settings.License = LicenseType.Community;

    public byte[] Generate(StudentStatementPdfModel model)
    {
        var statement = model.Statement;
        var accent = NormalizeColor(model.AccentColor);

        return Document.Create(document => document.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(30);
            page.DefaultTextStyle(x => x.FontSize(9).FontColor(Ink));

            page.Header().Element(header => ComposeHeader(header, model, accent));
            page.Content().Element(content => ComposeContent(content, statement, accent));
            page.Footer().Element(footer => ComposeFooter(footer, statement));
        })).GeneratePdf();
    }

    private static void ComposeHeader(IContainer container, StudentStatementPdfModel model, string accent)
    {
        var statement = model.Statement;

        container.Column(header =>
        {
            header.Item().Row(row =>
            {
                row.RelativeItem().Row(brand =>
                {
                    if (model.LogoBytes is { Length: > 0 })
                    {
                        brand.ConstantItem(34).Height(34).AlignMiddle().Image(model.LogoBytes).FitArea();
                        brand.ConstantItem(8);
                    }

                    brand.AutoItem().AlignMiddle().Text(model.BrandName).FontSize(17).Bold().FontColor(Ink);
                });

                row.ConstantItem(250).Column(info =>
                {
                    info.Item().AlignRight().Text(statement.InstitutionName.ToUpper(Tr)).FontSize(11).Bold();
                    if (!string.IsNullOrWhiteSpace(statement.InstitutionAddress))
                        info.Item().AlignRight().Text(statement.InstitutionAddress).FontSize(8).FontColor(Muted);
                    if (!string.IsNullOrWhiteSpace(statement.InstitutionLocation))
                        info.Item().AlignRight().Text(statement.InstitutionLocation).FontSize(8).FontColor(Muted);
                    if (!string.IsNullOrWhiteSpace(statement.InstitutionTaxInfo))
                        info.Item().AlignRight().Text(statement.InstitutionTaxInfo).FontSize(8).FontColor(Muted);
                    if (!string.IsNullOrWhiteSpace(statement.InstitutionPhone))
                        info.Item().AlignRight().Text($"Tel: {statement.InstitutionPhone}").FontSize(8).FontColor(Muted);
                    if (!string.IsNullOrWhiteSpace(statement.InstitutionEmail))
                        info.Item().AlignRight().Text(statement.InstitutionEmail).FontSize(8).FontColor(accent);
                    if (!string.IsNullOrWhiteSpace(statement.InstitutionWebsite))
                        info.Item().AlignRight().Text(statement.InstitutionWebsite).FontSize(8).FontColor(accent);
                });
            });

            header.Item().PaddingTop(8).LineHorizontal(1.2f).LineColor(accent);
        });
    }

    private static void ComposeContent(IContainer container, StudentStatementDto statement, string accent)
    {
        container.PaddingTop(14).Column(content =>
        {
            content.Item().AlignCenter().Text("CARİ HESAP EKSTRESİ").FontSize(14).Bold();

            content.Item().PaddingTop(14).Row(row =>
            {
                row.RelativeItem().Column(left =>
                {
                    Field(left, "Cari Kodu", statement.AccountCode, accent);
                    Field(left, "Adı Soyadı", statement.StudentName, accent);
                    // Boş kalan iletişim alanları belgeye "-" olarak basılmaz, satır hiç açılmaz.
                    if (!string.IsNullOrWhiteSpace(statement.StudentPhone))
                        Field(left, "Telefon", statement.StudentPhone, accent);
                    if (!string.IsNullOrWhiteSpace(statement.StudentAddress))
                        Field(left, "Adres", statement.StudentAddress, accent);
                    if (!string.IsNullOrWhiteSpace(statement.ParentName))
                        Field(left, "Veli", statement.ParentName, accent);
                    if (!string.IsNullOrWhiteSpace(statement.ClassName))
                        Field(left, "Sınıf", statement.ClassName, accent);
                });

                row.ConstantItem(230).Column(right =>
                {
                    Field(right, "Tarih Aralığı", $"{Local(statement.FromUtc):dd.MM.yyyy} - {Local(statement.ToUtc):dd.MM.yyyy}", accent, 100);
                    Field(right, "Düzenleme Tarihi", $"{Local(statement.GeneratedAtUtc):dd.MM.yyyy HH:mm}", accent, 100);
                    Field(right, "Para Birimi", statement.Currency, accent, 100);
                });
            });

            content.Item().PaddingTop(16).Element(table => ComposeTable(table, statement, accent));

            content.Item().PaddingTop(14).Text(text =>
            {
                text.Span("Yalnız ").FontSize(9).FontColor(Muted);
                text.Span(statement.ClosingBalanceInWords).FontSize(9).Bold();
            });

            content.Item().PaddingTop(6).Text($"Not: {statement.Note}").FontSize(8).FontColor(Muted);
        });
    }

    private static void ComposeTable(IContainer container, StudentStatementDto statement, string accent)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(62);  // Tarih
                columns.ConstantColumn(78);  // İşlem Türü
                columns.RelativeColumn();    // Açıklama
                columns.ConstantColumn(72);  // Borç
                columns.ConstantColumn(72);  // Alacak
                columns.ConstantColumn(76);  // Bakiye
            });

            table.Header(head =>
            {
                HeadCell(head, "Tarih");
                HeadCell(head, "İşlem Türü");
                HeadCell(head, "Açıklama");
                HeadCell(head, $"Borç ({statement.Currency})", true);
                HeadCell(head, $"Alacak ({statement.Currency})", true);
                HeadCell(head, $"Bakiye ({statement.Currency})", true);
            });

            // Devir satırı: dönem başındaki bakiye sıfır değilse ekstre onunla açılır.
            if (statement.OpeningBalance != 0)
            {
                BodyCell(table, $"{Local(statement.FromUtc):dd.MM.yyyy}", ZebraBg);
                BodyCell(table, "Devir", ZebraBg);
                BodyCell(table, "Önceki dönemden devreden bakiye", ZebraBg);
                BodyCell(table, "-", ZebraBg, true);
                BodyCell(table, "-", ZebraBg, true);
                BodyCell(table, Money(statement.OpeningBalance), ZebraBg, true, true);
            }

            if (statement.Lines.Count == 0)
            {
                table.Cell().ColumnSpan(6).Border(0.5f).BorderColor(Line).Padding(14).AlignCenter()
                    .Text("Seçilen tarih aralığında hesap hareketi bulunmuyor.").FontColor(Muted);
            }

            for (var index = 0; index < statement.Lines.Count; index++)
            {
                var line = statement.Lines[index];
                var background = index % 2 == 1 ? ZebraBg : "#FFFFFF";
                BodyCell(table, $"{Local(line.DateUtc):dd.MM.yyyy}", background);
                BodyCell(table, line.EntryType, background);
                BodyCell(table, Description(line), background);
                BodyCell(table, line.Debit > 0 ? Money(line.Debit) : Money(0), background, true);
                BodyCell(table, line.Credit > 0 ? Money(line.Credit) : Money(0), background, true);
                BodyCell(table, Money(line.Balance), background, true, true);
            }

            // Toplam ve bakiye satırları tablonun altında sağa yaslı durur.
            table.Cell().ColumnSpan(3).Background(HeadBg).Padding(6).AlignRight()
                .Text("Toplam").SemiBold();
            TotalCell(table, Money(statement.DebitTotal));
            TotalCell(table, Money(statement.CreditTotal));
            table.Cell().Background(HeadBg).Padding(6);

            table.Cell().ColumnSpan(5).Background(HeadBg).Padding(6).AlignRight()
                .Text("Bakiye").SemiBold();
            table.Cell().Background(HeadBg).Padding(6).AlignRight()
                .Text($"{Money(statement.ClosingBalance)} {statement.Currency}")
                .Bold().FontColor(statement.ClosingBalance > 0 ? "#B42318" : accent);
        });
    }

    private static void ComposeFooter(IContainer container, StudentStatementDto statement)
    {
        container.Column(footer =>
        {
            footer.Item().LineHorizontal(0.5f).LineColor(Line);
            footer.Item().PaddingTop(5).Row(row =>
            {
                row.RelativeItem().Text($"{statement.InstitutionName} • Cari Hesap Ekstresi • {statement.AccountCode}")
                    .FontSize(7.5f).FontColor(Muted);
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
    }

    private static void Field(ColumnDescriptor column, string label, string value, string accent, float labelWidth = 88)
    {
        column.Item().PaddingBottom(3).Row(row =>
        {
            row.ConstantItem(labelWidth).Text(label).FontSize(8.5f).FontColor(Muted);
            row.ConstantItem(8).Text(":").FontSize(8.5f).FontColor(Muted);
            row.RelativeItem().Text(string.IsNullOrWhiteSpace(value) ? "-" : value).FontSize(8.5f).FontColor(accent);
        });
    }

    private static void HeadCell(TableCellDescriptor head, string text, bool numeric = false)
    {
        var cell = head.Cell().Background(HeadBg).Border(0.5f).BorderColor(Line).Padding(6);
        var content = cell.Text(text).FontSize(8.5f).SemiBold();
        if (numeric) content.AlignRight();
    }

    private static void BodyCell(TableDescriptor table, string text, string background, bool numeric = false, bool bold = false)
    {
        var cell = table.Cell().Background(background).Border(0.5f).BorderColor(Line).Padding(5);
        var content = cell.Text(text).FontSize(8.5f);
        if (numeric) content.AlignRight();
        if (bold) content.SemiBold();
    }

    private static void TotalCell(TableDescriptor table, string text) =>
        table.Cell().Background(HeadBg).Padding(6).AlignRight().Text(text).SemiBold();

    private static string Description(StudentStatementLineDto line) =>
        string.IsNullOrWhiteSpace(line.DocumentNo)
            ? line.Description
            : $"{line.Description} • Belge: {line.DocumentNo}";

    private static string Money(decimal value) => value.ToString("N2", Tr);

    // Belgeler yerel saatle (UTC+3) düzenlenir; sertifika/rapor PDF'leriyle aynı kural.
    private static DateTime Local(DateTime utc) => utc.AddHours(3);

    private static string NormalizeColor(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "#0F4C81";
        var trimmed = value.Trim();
        if (!trimmed.StartsWith('#')) trimmed = "#" + trimmed;
        return trimmed.Length is 4 or 7 ? trimmed : "#0F4C81";
    }
}
