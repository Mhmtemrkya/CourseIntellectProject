using System.Globalization;
using CourseIntellect.Application.Interfaces;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Kurum onaylandığında üretilen, kuruma elden teslim edilecek kurulum belgesi.
/// </summary>
/// <remarks>
/// Belge PAROLA İÇERİR ve indirildiği anda kalıcı bir dosyaya dönüşür. Bu yüzden
/// yanında üç şey var: parolanın son kullanma tarihi belgenin üstünde yazılı,
/// belge imha uyarısı taşıyor ve üretimi denetim kaydına giriyor.
/// </remarks>
public sealed class TenantSetupDocumentPdfService : ITenantSetupDocumentService
{
    private const string Ink = "#111827";
    private const string Muted = "#6B7280";
    private const string Accent = "#1D4ED8";
    private const string WarnBg = "#FEF3C7";
    private const string WarnInk = "#92400E";

    private static readonly CultureInfo Turkish = CultureInfo.GetCultureInfo("tr-TR");

    static TenantSetupDocumentPdfService() => QuestPDF.Settings.License = LicenseType.Community;

    public byte[] Generate(TenantSetupDocumentModel model) =>
        Document.Create(document => document.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(36);
            page.DefaultTextStyle(x => x.FontSize(10).FontColor(Ink));

            page.Header().Column(header =>
            {
                header.Item().Text("SchoolAsist").FontSize(18).Bold().FontColor(Accent);
                header.Item().Text("Kurum Kurulum Belgesi").FontSize(13).Bold();
                header.Item().PaddingTop(2).Text(
                    $"Düzenlenme: {model.IssuedAtUtc.ToLocalTime().ToString("d MMMM yyyy HH:mm", Turkish)} · {model.IssuedByName}")
                    .FontSize(9).FontColor(Muted);
            });

            page.Content().PaddingVertical(18).Column(column =>
            {
                column.Spacing(14);

                column.Item().Text(text =>
                {
                    text.Span("Sayın ").FontSize(11);
                    text.Span(model.InstitutionName).FontSize(11).Bold();
                    text.Span(" yetkilisi,").FontSize(11);
                });

                column.Item().Text(
                    "Kurum başvurunuz onaylandı. Aşağıdaki bilgilerle giriş yaparak kurumunuzun " +
                    "yönetici hesabını kullanmaya başlayabilirsiniz.")
                    .FontSize(10);

                column.Item().Border(1).BorderColor("#E5E7EB").Padding(14).Column(box =>
                {
                    box.Spacing(9);
                    Field(box, "Kurum", model.InstitutionName);
                    Field(box, "Paket", model.Plan);
                    Field(box, "Kurum türü", model.InstitutionType);
                    Field(box, "Giriş adresi", model.LoginUrl);

                    box.Item().PaddingTop(4).Text("Giriş bilgileri").FontSize(11).Bold();
                    Field(box, "Kullanıcı adı", model.Username, mono: true);
                    Field(box, "Geçici parola", model.TemporaryPassword, mono: true, big: true);

                    if (model.PasswordExpiresAtUtc is { } expires)
                    {
                        box.Item().Text(
                            $"Bu parola {expires.ToLocalTime().ToString("d MMMM yyyy HH:mm", Turkish)} tarihine kadar geçerlidir.")
                            .FontSize(9).FontColor(WarnInk);
                    }
                });

                column.Item().Text("İlk girişte ne olacak?").FontSize(11).Bold();
                column.Item().Text(
                    "Yukarıdaki geçici parolayla giriş yaptığınızda sistem sizi doğrudan parola " +
                    "belirleme ekranına yönlendirir. Kendi parolanızı belirledikten sonra geçici " +
                    "parola geçersiz olur.")
                    .FontSize(10);

                column.Item().Background(WarnBg).Padding(12).Column(warn =>
                {
                    warn.Item().Text("Bu belge parola içerir").FontSize(10).Bold().FontColor(WarnInk);
                    warn.Item().PaddingTop(3).Text(
                        "Belgeyi yalnız kurum yetkilisine teslim edin. Teslimden sonra yazıcı çıktısını " +
                        "imha edin, dijital kopyasını silin. Parola kaybolursa belge yeniden üretilebilir; " +
                        "eski parola o anda geçersiz olur.")
                        .FontSize(9).FontColor(WarnInk);
                });
            });

            page.Footer().AlignCenter().Text(text =>
            {
                text.Span("SchoolAsist · Kurum Kurulum Belgesi · ").FontSize(8).FontColor(Muted);
                text.CurrentPageNumber().FontSize(8).FontColor(Muted);
                text.Span("/").FontSize(8).FontColor(Muted);
                text.TotalPages().FontSize(8).FontColor(Muted);
            });
        })).GeneratePdf();

    private static void Field(ColumnDescriptor column, string label, string value, bool mono = false, bool big = false)
        => column.Item().Row(row =>
        {
            row.ConstantItem(120).Text(label).FontSize(9).FontColor(Muted);
            var cell = row.RelativeItem().Text(value)
                .FontSize(big ? 15 : 10)
                .Bold();
            if (mono) cell.FontFamily(Fonts.Consolas);
        });
}
