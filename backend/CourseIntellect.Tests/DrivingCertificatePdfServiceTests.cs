using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

public sealed class DrivingCertificatePdfServiceTests
{
    [Fact]
    public void Generate_CreatesPdfWithCertificateContentAndQr()
    {
        var service = new DrivingCertificatePdfService();
        var bytes = service.Generate(new DrivingCertificatePdfModel(
            "Özel Örnek Motorlu Taşıt Sürücüleri Kursu Müdürlüğü",
            "40052",
            "Erzurum",
            "Yakutiye",
            "Ayşe Yılmaz",
            "11111111110",
            "Mehmet",
            "Fatma",
            "Yakutiye",
            "1998",
            "B",
            string.Empty,
            string.Empty,
            string.Empty,
            string.Empty,
            "SRK-2026-ABC123",
            "28146",
            "EĞİTİM TAMAMLAMA BELGESİ",
            new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 7, 14, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 7, 14, 0, 0, 0, DateTimeKind.Utc),
            "Mehmet Demir",
            "Kurum Müdürü",
            "#173B57",
            "https://courseintellect.com/api/public/driving-certificates/SRK-2026-ABC123/verify?token=test-token",
            LoadPreviewLogo(),
            null));

        Assert.True(bytes.Length > 10_000);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
        var previewPath = Environment.GetEnvironmentVariable("CERTIFICATE_PREVIEW_PATH");
        if (!string.IsNullOrWhiteSpace(previewPath)) File.WriteAllBytes(previewPath, bytes);
    }

    [Fact]
    public void Generate_AllowsOptionalCertificateFieldsToRemainEmpty()
    {
        var service = new DrivingCertificatePdfService();
        var bytes = service.Generate(new DrivingCertificatePdfModel(
            string.Empty,
            string.Empty,
            string.Empty,
            string.Empty,
            string.Empty,
            string.Empty,
            string.Empty,
            string.Empty,
            string.Empty,
            string.Empty,
            string.Empty,
            string.Empty,
            string.Empty,
            string.Empty,
            string.Empty,
            "SRK-2026-EMPTY",
            string.Empty,
            "EĞİTİM TAMAMLAMA BELGESİ",
            null,
            null,
            null,
            string.Empty,
            string.Empty,
            "#173B57",
            "https://courseintellect.com/api/public/driving-certificates/SRK-2026-EMPTY/verify?token=test-token",
            null,
            null));

        Assert.True(bytes.Length > 8_000);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
    }

    private static byte[]? LoadPreviewLogo()
    {
        var explicitPath = Environment.GetEnvironmentVariable("CERTIFICATE_LOGO_PATH");
        if (!string.IsNullOrWhiteSpace(explicitPath) && File.Exists(explicitPath))
            return File.ReadAllBytes(explicitPath);
        var repositoryPath = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..", "..", "..", "..",
            "CourseIntellect.Api", "Assets", "meb-logo.png"));
        return File.Exists(repositoryPath) ? File.ReadAllBytes(repositoryPath) : null;
    }
}
