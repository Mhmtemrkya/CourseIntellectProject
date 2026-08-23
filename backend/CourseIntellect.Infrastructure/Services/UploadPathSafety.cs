namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Yükleme yollarının ve dosya adlarının güvenli hâle getirilmesi. Klasör adı ve
/// dosya adı istemciden geldiği için burada iki şey garanti edilir:
/// <list type="number">
/// <item>Yazma her zaman yükleme kökünün ALTINDA kalır (<c>..</c>, mutlak yol,
/// sürücü harfi, UNC yolu ve ayraç oyunları kabul edilmez).</item>
/// <item>Diskteki uzantı sunucu tarafındaki beyaz listeden gelir; istemcinin
/// verdiği <c>.html</c>/<c>.svg</c> gibi aktif içerik uzantıları aynı origin
/// altında yayınlanamaz.</item>
/// </list>
/// Sunucu tarafı çağrıları <c>driving-imports/&lt;tenant&gt;</c> gibi iç içe
/// klasörler kullandığından alt klasörler yasak değildir; her parça ayrı ayrı
/// doğrulanır.
/// </summary>
public static class UploadPathSafety
{
    private const int MaxSegments = 4;
    private const int MaxSegmentLength = 64;

    /// <summary>
    /// Diskte tutulmasına izin verilen uzantılar. Listede olmayan her uzantı
    /// <see cref="FallbackExtension"/> ile saklanır — dosya kaybolmaz ama tarayıcı
    /// için çalıştırılabilir/aktif bir belge hâline de gelemez.
    /// <c>.html</c>, <c>.xhtml</c>, <c>.xml</c>, <c>.js</c> gibi script taşıyabilen
    /// türler bilerek listede DEĞİLDİR.
    ///
    /// <para><b>.svg özel durumdur:</b> kurum logosu, favicon ve soru görseli
    /// akışları SVG kabul ediyor, dolayısıyla reddetmek ürünü bozar. Bunun yerine
    /// SVG saklanır ama sunum katmanında etkisizleştirilir: yükleme kökündeki her
    /// yanıt <c>Content-Security-Policy: default-src 'none'; sandbox</c> ile döner,
    /// böylece dosyaya doğrudan gidilse bile içindeki script çalışmaz.
    /// <c>&lt;img&gt;</c> ile gömülü gösterim bundan etkilenmez (CSP yanıt başlığı
    /// alt-kaynak olarak yüklenen görselin çizimini engellemez).</para>
    /// </summary>
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        // Görseller
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".heic", ".heif", ".avif", ".ico", ".svg",
        // Belgeler
        ".pdf", ".txt", ".csv", ".tsv", ".rtf",
        ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp",
        // Ses / video
        ".mp3", ".m4a", ".wav", ".ogg", ".oga", ".aac", ".flac",
        ".mp4", ".m4v", ".mov", ".webm", ".mkv", ".avi",
        // Arşiv
        ".zip", ".rar", ".7z",
        // Nötr ikili
        ".bin",
    };

    /// <summary>
    /// Tarayıcıda gömülü gösterilmesi güvenli olan uzantılar. Bunun dışındaki her
    /// şey <c>Content-Disposition: attachment</c> ile indirilir; böylece aynı origin
    /// altında belge olarak açılamaz.
    ///
    /// <para><c>.svg</c> burada YER ALIR: logo/favicon/soru görseli akışları onu
    /// <c>&lt;img&gt;</c> ile çiziyor ve indirmeye zorlamak bu ekranları bozardı.
    /// Güvenliği sunum katmanındaki CSP sandbox başlığı sağlar (bkz. AllowedExtensions).</para>
    /// </summary>
    private static readonly HashSet<string> InlineSafeExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".avif", ".ico", ".svg",
        ".pdf",
        ".mp3", ".m4a", ".wav", ".ogg", ".oga", ".aac",
        ".mp4", ".m4v", ".mov", ".webm",
    };

    public const string FallbackExtension = ".bin";

    /// <summary>
    /// İstemciden gelen klasör adını güvenli göreli yola çevirir. Geçersizse
    /// <c>false</c> döner — sessizce "general" klasörüne düşürülmez, çünkü dosyanın
    /// beklenmedik bir yere yazılması sessizce yutulmamalıdır.
    /// </summary>
    public static bool TrySanitizeFolder(string? folder, out string safeFolder)
    {
        safeFolder = "general";
        if (string.IsNullOrWhiteSpace(folder)) return true;

        var raw = folder.Trim();

        // Mutlak yol, sürücü harfi (C:) ve UNC (\\sunucu) baştan reddedilir.
        if (raw.StartsWith('/') || raw.StartsWith('\\') || raw.Contains(':')) return false;

        var segments = raw.Split(['/', '\\'], StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length is 0 or > MaxSegments) return false;

        var safeSegments = new List<string>(segments.Length);
        foreach (var segment in segments)
        {
            var normalized = segment.Trim().ToLowerInvariant();
            if (normalized.Length is 0 or > MaxSegmentLength) return false;

            // "." ve ".." (ve yalnız noktadan oluşan her varyant) üst dizine çıkarır.
            if (normalized.All(ch => ch == '.')) return false;

            // Yalnız harf/rakam/tire/alt tire/nokta. Yüzde kodlaması, boşluk, NUL ve
            // Unicode ayraç benzerleri bu kapıdan geçemez.
            if (!normalized.All(ch => char.IsAsciiLetterOrDigit(ch) || ch is '-' or '_' or '.')) return false;

            safeSegments.Add(normalized);
        }

        safeFolder = string.Join('/', safeSegments);
        return true;
    }

    /// <summary>
    /// Dosya adının gövdesini güvenli hâle getirir (yalnız harf/rakam/tire/alt tire).
    /// Boş kalırsa "asset" döner.
    /// </summary>
    public static string SanitizeBaseName(string? fileName)
    {
        var baseName = Path.GetFileNameWithoutExtension(fileName ?? string.Empty);
        var safeName = string.Concat(baseName.Where(ch => char.IsAsciiLetterOrDigit(ch) || ch is '-' or '_')).Trim();
        if (safeName.Length > MaxSegmentLength) safeName = safeName[..MaxSegmentLength];
        return string.IsNullOrWhiteSpace(safeName) ? "asset" : safeName;
    }

    /// <summary>
    /// Diske yazılacak uzantıyı belirler. Beyaz listede olmayan her uzantı
    /// <see cref="FallbackExtension"/> olur — istemci <c>.html</c> ya da <c>.svg</c>
    /// göndererek aynı origin altında aktif içerik yayınlayamaz.
    /// </summary>
    public static string ResolveSafeExtension(string? fileName)
    {
        var extension = Path.GetExtension(fileName ?? string.Empty);
        if (string.IsNullOrWhiteSpace(extension)) return FallbackExtension;

        // Çift uzantı ("rapor.pdf.html") zaten yalnız SON uzantıyla değerlendirilir;
        // gövdedeki noktalar SanitizeBaseName tarafından atılır.
        extension = extension.Trim().ToLowerInvariant();
        if (extension.Length > 12 || !extension.Skip(1).All(char.IsAsciiLetterOrDigit)) return FallbackExtension;

        return AllowedExtensions.Contains(extension) ? extension : FallbackExtension;
    }

    /// <summary>Uzantı tarayıcıda gömülü gösterilebilir mi?</summary>
    public static bool IsInlineSafeExtension(string? extension)
        => !string.IsNullOrWhiteSpace(extension) && InlineSafeExtensions.Contains(extension.Trim());

    /// <summary>
    /// <paramref name="candidatePath"/> gerçekten <paramref name="root"/> altında mı?
    /// Sembolik bağlantı ve normalize edilmemiş yol oyunlarına karşı son kapıdır.
    /// </summary>
    public static bool IsWithinRoot(string root, string candidatePath)
    {
        var fullRoot = Path.GetFullPath(root);
        var rootWithSeparator = Path.EndsInDirectorySeparator(fullRoot)
            ? fullRoot
            : fullRoot + Path.DirectorySeparatorChar;
        return Path.GetFullPath(candidatePath)
            .StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase);
    }
}
