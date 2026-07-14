using CourseIntellect.Application.Interfaces;
using QRCoder;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CourseIntellect.Infrastructure.Services;

public sealed class DrivingCertificatePdfService : IDrivingCertificatePdfService
{
    static DrivingCertificatePdfService() => QuestPDF.Settings.License = LicenseType.Community;

    public byte[] Generate(DrivingCertificatePdfModel model)
    {
        var accent = NormalizeColor(model.PrimaryColor);
        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(model.VerificationUrl, QRCodeGenerator.ECCLevel.Q);
        var qrBytes = new PngByteQRCode(data).GetGraphic(12);

        return Document.Create(document => document.Page(page =>
        {
            page.Size(PageSizes.A4.Landscape());
            page.Margin(22);
            page.DefaultTextStyle(x => x.FontSize(12).FontColor("#243342"));
            page.Content().Border(3).BorderColor(accent).Padding(8)
                .Border(1).BorderColor("#B8C6D1").Padding(24).Column(column =>
                {
                    column.Spacing(10);
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
                    column.Item().AlignCenter().Text("İşbu belge").FontSize(13);
                    column.Item().AlignCenter().Text(model.StudentName).FontSize(30).Bold().FontColor(accent);
                    column.Item().AlignCenter().Text(text =>
                    {
                        text.Span("isimli kursiyerin ");
                        text.Span($"{model.LicenseClass} sınıfı").SemiBold();
                        text.Span(" sürücü eğitim programının gerekli eğitim ve sınav koşullarını başarıyla tamamladığını belgeler.");
                    });

                    column.Item().PaddingTop(14).Row(row =>
                    {
                        row.RelativeItem().Column(info =>
                        {
                            info.Item().Text($"Belge No: {model.DocumentNumber}").SemiBold();
                            info.Item().PaddingTop(4).Text($"Düzenleme Tarihi: {model.IssuedAtUtc:dd.MM.yyyy}");
                            info.Item().PaddingTop(12).Text("Bu belgenin geçerliliğini QR kodu okutarak doğrulayabilirsiniz.").FontSize(9).FontColor("#5F7080");
                        });
                        row.RelativeItem().AlignCenter().Column(signature =>
                        {
                            signature.Item().Height(42).AlignCenter().Element(box =>
                            {
                                if (model.SignatureBytes is { Length: > 0 }) box.Image(model.SignatureBytes).FitArea();
                            });
                            signature.Item().AlignCenter().Text(model.DirectorName).SemiBold();
                            signature.Item().AlignCenter().Text(model.DirectorTitle).FontSize(10);
                            signature.Item().PaddingTop(3).AlignCenter().Text("İmza / Mühür").FontSize(8).FontColor("#758493");
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

    private static string NormalizeColor(string? value)
    {
        var color = value?.Trim() ?? string.Empty;
        return System.Text.RegularExpressions.Regex.IsMatch(color, "^#[0-9A-Fa-f]{6}$") ? color : "#173B57";
    }
}
