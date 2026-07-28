using CourseIntellect.Application.Interfaces;
using QRCoder;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Motorlu Taşıt Sürücü Kursu eğitim tamamlama belgesini resmî EK-6 yerleşimine
/// yakın, baskıya uygun A4 yatay PDF olarak üretir. Belge düzenleme ekranından
/// gelen değerler sunucuda uzunluk ve tarih sınırlarından geçirilir; boş bırakılan
/// alanlar PDF üzerinde de boş gösterilebilir.
/// </summary>
public sealed class DrivingCertificatePdfService : IDrivingCertificatePdfService
{
    private const string Gold = "#9B7A19";
    private const string DarkGold = "#705510";
    private const string Ink = "#111827";
    private const string Grid = "#4B5563";

    static DrivingCertificatePdfService() => QuestPDF.Settings.License = LicenseType.Community;

    public byte[] Generate(DrivingCertificatePdfModel model)
    {
        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(model.VerificationUrl, QRCodeGenerator.ECCLevel.Q);
        var qrBytes = new PngByteQRCode(data).GetGraphic(10);

        // Kullanıcının verdiği EK-6 yalnız eğitim tamamlama belgesidir. Ayrı bir
        // belge türü olan başarı belgesinin resmî EK-6 gibi görünmesini engelleriz.
        if (!model.CertificateTitle.Contains("TAMAMLAMA", StringComparison.OrdinalIgnoreCase))
            return GenerateAchievementCertificate(model, qrBytes);

        return Document.Create(document => document.Page(page =>
        {
            page.Size(PageSizes.A4.Landscape());
            page.MarginHorizontal(24);
            page.MarginVertical(18);
            page.DefaultTextStyle(x => x.FontSize(10).FontColor(Ink));

            page.Header().AlignCenter()
                .Text("ÖZEL MOTORLU TAŞIT SÜRÜCÜ SERTİFİKASI (EK-6)")
                .FontSize(11).Bold();

            page.Content()
                .PaddingTop(5)
                .Border(7).BorderColor(Gold).Padding(10)
                .Border(2).BorderColor("#D1B34B").Padding(7)
                .Border(2).BorderColor(DarkGold).Padding(18)
                .Column(column =>
                {
                    column.Spacing(9);

                    column.Item().Height(92).Row(row =>
                    {
                        row.ConstantItem(112).Padding(4).AlignCenter().AlignMiddle().Element(box =>
                        {
                            if (model.LogoBytes is { Length: > 0 }) box.Image(model.LogoBytes).FitArea();
                            else box.Border(1).BorderColor("#C9B46B").AlignCenter().AlignMiddle()
                                .Text("KURUM\nLOGOSU").FontSize(9).Bold().FontColor(Gold);
                        });

                        row.RelativeItem().AlignCenter().AlignMiddle().Column(header =>
                        {
                            header.Spacing(1);
                            header.Item().AlignCenter().Text("T.C.").FontSize(14).Bold();
                            if (!string.IsNullOrWhiteSpace(model.InstitutionCity))
                                header.Item().AlignCenter().Text($"{model.InstitutionCity.ToUpperInvariant()} İLİ").FontSize(13).Bold();
                            if (!string.IsNullOrWhiteSpace(model.InstitutionDistrict))
                                header.Item().AlignCenter().Text($"{model.InstitutionDistrict.ToUpperInvariant()} İLÇESİ").FontSize(13).Bold();
                            header.Item().AlignCenter().Text(model.InstitutionName.ToUpperInvariant()).FontSize(14).Bold();
                        });

                        row.ConstantItem(112);
                    });

                    column.Item().AlignCenter()
                        .Text("MOTORLU TAŞIT SÜRÜCÜ KURSU SERTİFİKASI")
                        .FontSize(18).Bold();

                    column.Item().PaddingTop(4).Row(row =>
                    {
                        row.RelativeItem().PaddingRight(4).Element(left => IdentityTable(left, model));
                        row.RelativeItem().PaddingLeft(4).Element(right => CertificateTable(right, model));
                    });

                    var courseStart = CertificateDate(model.CourseStartedAtUtc);
                    var examDate = CertificateDate(model.ExamPassedAtUtc);
                    column.Item().PaddingHorizontal(14).PaddingTop(12).Text(text =>
                    {
                        text.DefaultTextStyle(x => x.FontSize(11));
                        text.Span("Yukarıda durumu belirtilen ");
                        text.Span(model.StudentName.ToUpperInvariant()).Bold();
                        text.Span($" {courseStart} - {examDate} tarihleri arasında açılan Özel Motorlu Taşıt Sürücüleri Kursuna katılarak kurs sonunda ");
                        text.Span(examDate).Bold();
                        text.Span(" tarihinde yapılan sınavdan başarılı olmuş ve bu belgeyi almaya hak kazanmıştır.");
                    });

                    column.Item().ExtendVertical().AlignBottom().Row(row =>
                    {
                        row.ConstantItem(92).AlignBottom().Column(qr =>
                        {
                            qr.Item().Width(62).Height(62).Image(qrBytes).FitArea();
                            qr.Item().Width(62).AlignCenter().Text("BELGEYİ DOĞRULA").FontSize(6).Bold();
                            qr.Item().PaddingTop(2).Text(model.DocumentNumber).FontSize(6).FontColor("#6B7280");
                        });

                        row.RelativeItem();

                        row.ConstantItem(235).AlignCenter().AlignBottom().Column(signature =>
                        {
                            signature.Item().AlignCenter().Text("KURUM MÜDÜRÜ").FontSize(12).Bold();
                            signature.Item().Height(38).PaddingTop(2).AlignCenter().Element(box =>
                            {
                                if (model.SignatureBytes is { Length: > 0 }) box.Image(model.SignatureBytes).FitArea();
                            });
                            signature.Item().AlignCenter().Text(model.DirectorName.ToUpperInvariant()).FontSize(11);
                        });
                    });
                });
        })).GeneratePdf();
    }

    private static byte[] GenerateAchievementCertificate(
        DrivingCertificatePdfModel model,
        byte[] qrBytes)
    {
        var accent = NormalizeColor(model.PrimaryColor);
        return Document.Create(document => document.Page(page =>
        {
            page.Size(PageSizes.A4.Landscape());
            page.Margin(24);
            page.DefaultTextStyle(x => x.FontSize(12).FontColor("#243342"));
            page.Content().Border(3).BorderColor(accent).Padding(9)
                .Border(1).BorderColor("#B8C6D1").Padding(24).Column(column =>
                {
                    column.Spacing(11);
                    column.Item().Row(row =>
                    {
                        row.ConstantItem(105).Height(70).AlignMiddle().Element(box =>
                        {
                            if (model.LogoBytes is { Length: > 0 }) box.Image(model.LogoBytes).FitArea();
                            else box.AlignCenter().AlignMiddle().Text("KURUM\nLOGOSU").Bold().FontColor(accent);
                        });
                        row.RelativeItem().AlignCenter().Column(header =>
                        {
                            header.Item().AlignCenter().Text(model.InstitutionName).FontSize(19).SemiBold().FontColor(accent);
                            header.Item().PaddingTop(5).AlignCenter().Text(model.CertificateTitle).FontSize(27).Bold().FontColor(accent);
                        });
                        row.ConstantItem(105);
                    });
                    column.Item().PaddingVertical(9).LineHorizontal(1).LineColor("#D5DEE5");
                    column.Item().AlignCenter().Text(model.StudentName).FontSize(30).Bold().FontColor(accent);
                    column.Item().AlignCenter().Text(
                        $"{model.LicenseClass} sınıfı sürücü eğitim programını ve sınav koşullarını başarıyla tamamlamıştır.");
                    column.Item().PaddingTop(18).Row(row =>
                    {
                        row.RelativeItem().Column(info =>
                        {
                            info.Item().Text($"Belge No: {model.DocumentNumber}").SemiBold();
                            info.Item().PaddingTop(4).Text($"Düzenleme Tarihi: {CertificateDate(model.IssuedAtUtc)}");
                        });
                        row.RelativeItem().AlignCenter().Column(signature =>
                        {
                            signature.Item().Height(42).AlignCenter().Element(box =>
                            {
                                if (model.SignatureBytes is { Length: > 0 }) box.Image(model.SignatureBytes).FitArea();
                            });
                            signature.Item().AlignCenter().Text(model.DirectorName).SemiBold();
                            signature.Item().AlignCenter().Text("Kurum Müdürü").FontSize(10);
                        });
                        row.ConstantItem(112).AlignRight().Column(qr =>
                        {
                            qr.Item().Width(94).Height(94).Image(qrBytes).FitArea();
                            qr.Item().AlignCenter().Text("BELGEYİ DOĞRULA").FontSize(7).SemiBold();
                        });
                    });
                });
        })).GeneratePdf();
    }

    private static void IdentityTable(IContainer container, DrivingCertificatePdfModel model)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(115);
                columns.RelativeColumn();
            });

            LabeledRow(table, "Kurum Kodu", model.InstitutionCode);
            LabeledRow(table, "TC Kimlik No", model.IdentityNumber);
            LabeledRow(table, "Adı Soyadı", model.StudentName.ToUpperInvariant());
            LabeledRow(table, "Baba, Ana Adı", JoinNonEmpty(model.FatherName, model.MotherName, " - "));
            LabeledRow(table, "Doğum Yeri, Yılı", JoinNonEmpty(model.BirthPlace, model.BirthYear, " - "));
        });
    }

    private static void CertificateTable(IContainer container, DrivingCertificatePdfModel model)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.RelativeColumn();
                columns.RelativeColumn();
                columns.RelativeColumn();
                columns.RelativeColumn();
            });

            table.Cell().ColumnSpan(4).Element(HeaderCell)
                .Text("DAHA ÖNCEDEN ALDIĞI BELGE VARSA").FontSize(9).Bold();
            Header(table, "Verildiği İl");
            Header(table, "Tarih");
            Header(table, "Sayı");
            Header(table, "Sınıf");
            Value(table, model.ExistingLicenseCity);
            Value(table, model.ExistingLicenseDate);
            Value(table, model.ExistingLicenseNumber);
            Value(table, model.ExistingLicenseClasses);

            table.Cell().ColumnSpan(2).Element(LabelCell).Text("İstenen Sertifika Sınıfı").FontSize(9).Bold();
            table.Cell().ColumnSpan(2).Element(ValueCell).Text(model.LicenseClass.ToUpperInvariant()).FontSize(10).Bold();

            table.Cell().Element(LabelCell).Text("Tarihi").FontSize(9);
            table.Cell().Element(ValueCell).Text(CertificateDate(model.IssuedAtUtc)).FontSize(9);
            table.Cell().Element(LabelCell).Text("Numarası").FontSize(9);
            table.Cell().Element(ValueCell)
                .Text(string.IsNullOrWhiteSpace(model.MebbisCertificateNumber)
                    ? model.DocumentNumber
                    : model.MebbisCertificateNumber)
                .FontSize(9).Bold();
        });
    }

    private static void LabeledRow(TableDescriptor table, string label, string value)
    {
        table.Cell().Element(LabelCell).Text(label).FontSize(9);
        table.Cell().Element(ValueCell).Text(value).FontSize(9);
    }

    private static void Header(TableDescriptor table, string value) =>
        table.Cell().Element(HeaderCell).Text(value).FontSize(8).Bold();

    private static void Value(TableDescriptor table, string value) =>
        table.Cell().Element(ValueCell).Text(value).FontSize(8);

    private static IContainer LabelCell(IContainer container) =>
        container.MinHeight(23).Border(0.7f).BorderColor(Grid).PaddingHorizontal(7).AlignMiddle();

    private static IContainer ValueCell(IContainer container) =>
        container.MinHeight(23).Border(0.7f).BorderColor(Grid).PaddingHorizontal(7).AlignMiddle();

    private static IContainer HeaderCell(IContainer container) =>
        container.MinHeight(23).Border(0.7f).BorderColor(Grid).Background("#F8F5E9")
            .PaddingHorizontal(5).AlignCenter().AlignMiddle();

    private static string JoinNonEmpty(string first, string second, string separator)
    {
        var values = new[] { first?.Trim(), second?.Trim() }
            .Where(x => !string.IsNullOrWhiteSpace(x));
        return string.Join(separator, values);
    }

    private static string CertificateDate(DateTime? value) =>
        value.HasValue ? value.Value.ToString("dd.MM.yyyy") : string.Empty;

    private static string NormalizeColor(string? value)
    {
        var color = value?.Trim() ?? string.Empty;
        return System.Text.RegularExpressions.Regex.IsMatch(color, "^#[0-9A-Fa-f]{6}$")
            ? color
            : "#173B57";
    }
}
