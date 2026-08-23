using CourseIntellect.Infrastructure.Services;
using Xunit;

namespace CourseIntellect.Tests;

/// <summary>
/// Yükleme yolu ve uzantı kapısı. Bu testler iki açığı kilitler:
/// klasör adı üzerinden yükleme kökünün dışına yazma ve istemcinin verdiği
/// uzantıyla aynı origin altında aktif içerik (HTML/SVG) yayınlama.
/// </summary>
public sealed class UploadPathSafetyTests
{
    // ── Klasör: kabul edilenler ──────────────────────────────────────────────

    [Theory]
    [InlineData(null, "general")]
    [InlineData("", "general")]
    [InlineData("   ", "general")]
    [InlineData("student-photos", "student-photos")]
    [InlineData("Student-Photos", "student-photos")]          // küçültülür
    [InlineData("  staff-photos  ", "staff-photos")]          // kırpılır
    [InlineData("question-studio/options", "question-studio/options")]
    [InlineData("driving-imports/9f1c2d3e4a5b6c7d8e9f0a1b2c3d4e5f", "driving-imports/9f1c2d3e4a5b6c7d8e9f0a1b2c3d4e5f")]
    public void TrySanitizeFolder_AcceptsLegitimateFolders(string? input, string expected)
    {
        Assert.True(UploadPathSafety.TrySanitizeFolder(input, out var safeFolder));
        Assert.Equal(expected, safeFolder);
    }

    /// <summary>
    /// Masaüstü ve mobil istemcilerin GERÇEKTEN gönderdiği klasör adlarının tamamı
    /// (kod tabanı taranarak çıkarıldı). Doğrulayıcı ileride sıkılaştırılırsa bu
    /// test, hangi ekranların kırılacağını derleme zamanında değil test zamanında
    /// söyler — sessiz bir yükleme arızası yerine kırmızı bir test.
    /// </summary>
    [Theory]
    [InlineData("general")]
    [InlineData("documents")]
    [InlineData("student-photos")]
    [InlineData("staff-photos")]
    [InlineData("homework-materials")]
    [InlineData("excuse-documents")]
    [InlineData("live-lesson-materials")]
    [InlineData("live-room-materials")]
    [InlineData("question-images")]
    [InlineData("question-solutions")]
    [InlineData("question-threads")]
    [InlineData("question-studio/options")]
    [InlineData("question-studio/solutions")]
    [InlineData("teacher-content")]
    [InlineData("teacher-content-covers")]
    [InlineData("teacher-weekly-reports")]
    [InlineData("driving-student-photos")]
    [InlineData("driving-student-documents")]
    [InlineData("driving-vehicle-documents")]
    [InlineData("driving-certificate-assets")]
    // Sunucu tarafı akışları (MEBBİS içe/dışa aktarma) kiracı kimliğini ek parça yapar.
    [InlineData("driving-imports/0f8fad5bd9cb469fa16570867728950e")]
    [InlineData("driving-transfers/0f8fad5bd9cb469fa16570867728950e")]
    [InlineData("question-imports")]
    [InlineData("driving-mebbis-photos")]
    [InlineData("driving-certificates")]
    [InlineData("solution-canvas")]
    public void TrySanitizeFolder_AcceptsEveryFolderTheProductActuallyUses(string folder)
    {
        Assert.True(UploadPathSafety.TrySanitizeFolder(folder, out var safeFolder));
        Assert.Equal(folder, safeFolder);
    }

    // ── Klasör: reddedilenler (path traversal) ───────────────────────────────

    [Theory]
    [InlineData("..")]
    [InlineData("../etc")]
    [InlineData("../../../../etc/cron.d")]
    [InlineData("photos/../../..")]
    [InlineData("..\\..\\windows")]
    [InlineData("/etc/cron.d")]                 // mutlak yol
    [InlineData("\\\\sunucu\\paylasim")]        // UNC
    [InlineData("C:/windows/temp")]             // sürücü harfi
    [InlineData("photos/./..")]
    [InlineData("...")]                         // yalnız noktalar
    [InlineData("a/b/c/d/e")]                   // derinlik sınırı
    [InlineData("foto graflar")]                // boşluk
    [InlineData("photos%2f..%2f..")]            // yüzde kodlaması
    [InlineData("photos\0evil")]                // NUL enjeksiyonu
    public void TrySanitizeFolder_RejectsTraversalAndInjection(string input)
    {
        Assert.False(UploadPathSafety.TrySanitizeFolder(input, out _));
    }

    [Fact]
    public void TrySanitizeFolder_RejectsOverlongSegment()
    {
        Assert.False(UploadPathSafety.TrySanitizeFolder(new string('a', 65), out _));
    }

    // ── Uzantı: aktif içerik diske yazılamaz ─────────────────────────────────

    [Theory]
    [InlineData("payload.html")]
    [InlineData("payload.htm")]
    [InlineData("payload.xhtml")]
    [InlineData("data.xml")]
    [InlineData("script.js")]
    [InlineData("style.css")]
    [InlineData("shell.php")]
    [InlineData("page.aspx")]
    [InlineData("view.cshtml")]
    [InlineData("rapor.pdf.html")]              // çift uzantı: son uzantı sayılır
    [InlineData("dosya")]                       // uzantısız
    public void ResolveSafeExtension_NeutralisesActiveContent(string fileName)
    {
        Assert.Equal(UploadPathSafety.FallbackExtension, UploadPathSafety.ResolveSafeExtension(fileName));
    }

    [Theory]
    [InlineData("foto.jpg", ".jpg")]
    [InlineData("FOTO.JPG", ".jpg")]
    [InlineData("sozlesme.pdf", ".pdf")]
    [InlineData("liste.xlsx", ".xlsx")]
    [InlineData("ders.mp4", ".mp4")]
    [InlineData("kayit.csv", ".csv")]
    [InlineData("aktarim.tsv", ".tsv")]     // soru içe aktarma bu türü kullanıyor
    public void ResolveSafeExtension_KeepsLegitimateExtensions(string fileName, string expected)
    {
        Assert.Equal(expected, UploadPathSafety.ResolveSafeExtension(fileName));
    }

    /// <summary>
    /// SVG ÜRÜNDE KULLANILIYOR (kurum logosu, favicon, soru görseli) — bu yüzden
    /// saklanır ve gömülü gösterilir. Güvenliği uzantı reddi değil, yükleme
    /// kökündeki CSP sandbox başlığı sağlar. Bu test, birinin "güvenlik" gerekçesiyle
    /// SVG'yi listeden çıkarıp o ekranları sessizce bozmasını engeller.
    /// </summary>
    [Fact]
    public void Svg_IsStoredAndRenderable_ProtectedByCspInstead()
    {
        Assert.Equal(".svg", UploadPathSafety.ResolveSafeExtension("kurum-logo.svg"));
        Assert.True(UploadPathSafety.IsInlineSafeExtension(".svg"));
    }

    // ── Gömülü gösterim: HTML/belge indirilir, görsel/video gömülü kalır ─────

    [Theory]
    [InlineData(".jpg")]
    [InlineData(".png")]
    [InlineData(".pdf")]
    [InlineData(".mp4")]
    public void IsInlineSafeExtension_AllowsMedia(string extension)
    {
        Assert.True(UploadPathSafety.IsInlineSafeExtension(extension));
    }

    [Theory]
    [InlineData(".bin")]
    [InlineData(".html")]
    [InlineData(".xlsx")]
    [InlineData(".zip")]
    [InlineData(null)]
    public void IsInlineSafeExtension_ForcesDownloadForEverythingElse(string? extension)
    {
        Assert.False(UploadPathSafety.IsInlineSafeExtension(extension));
    }

    // ── Dosya adı gövdesi ────────────────────────────────────────────────────

    [Theory]
    [InlineData("../../etc/passwd", "passwd")]      // yol kısmı tamamen düşer
    [InlineData("normal-dosya.pdf", "normal-dosya")]
    [InlineData("...", "asset")]
    [InlineData("", "asset")]
    public void SanitizeBaseName_StripsSeparators(string input, string expected)
    {
        Assert.Equal(expected, UploadPathSafety.SanitizeBaseName(input));
    }

    // ── Kök içinde kalma kontrolü ────────────────────────────────────────────

    [Fact]
    public void IsWithinRoot_RejectsEscapes()
    {
        var root = Path.Combine(Path.GetTempPath(), "ci-uploads-root");
        Assert.True(UploadPathSafety.IsWithinRoot(root, Path.Combine(root, "student-photos", "a.jpg")));
        Assert.False(UploadPathSafety.IsWithinRoot(root, Path.Combine(root, "..", "escaped.jpg")));
        Assert.False(UploadPathSafety.IsWithinRoot(root, root));   // kökün kendisi bir dosya değildir
    }
}
