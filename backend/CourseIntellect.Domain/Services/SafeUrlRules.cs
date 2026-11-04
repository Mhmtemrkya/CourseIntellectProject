using System.Text.Json;

namespace CourseIntellect.Domain.Services;

/// <summary>
/// Herkese açık sayfalarda bağlantı olarak çizilen adresler için izin listesi: site içi yol
/// ("/...", "#...", "?..."), http(s), mailto, tel. <c>javascript:</c>, <c>data:</c>, <c>vbscript:</c>
/// ve protokol-göreli ("//evil.com") adresler kayıtlı XSS / açık yönlendirme için kullanılabilir.
/// </summary>
public static class SafeUrlRules
{
    private static readonly string[] AllowedSchemes = ["http", "https", "mailto", "tel"];

    public static bool IsSafe(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return true;
        // Tarayıcının yok saydığı kontrol karakterleri ("java\tscript:") çıkarılarak bakılır.
        var compact = new string(value.Where(ch => ch > ' ' && (ch < '\u007f' || ch > '\u009f')).ToArray());
        if (compact.StartsWith("//") || compact.StartsWith("\\\\") || compact.StartsWith("/\\")) return false;
        if (compact.StartsWith('/') || compact.StartsWith('#') || compact.StartsWith('?')) return true;
        var colon = compact.IndexOf(':');
        if (colon <= 0) return false;
        var scheme = compact[..colon];
        return scheme.All(ch => char.IsAsciiLetterOrDigit(ch) || ch is '+' or '.' or '-')
            && AllowedSchemes.Contains(scheme.ToLowerInvariant());
    }

    /// <summary>
    /// Tıklanınca/yüklenince kod çalıştırabilen adres mi? (javascript:, vbscript:, livescript:,
    /// resim olmayan data:). İzin listesinden gevşektir: göreli yollar, özel uygulama şemaları
    /// ve resim data: adresleri (fotoğraf alanları) geçer. Genel istek filtresi bunu kullanır.
    /// </summary>
    public static bool IsExecutable(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        var compact = new string(value.Where(ch => ch > ' ' && (ch < '\u007f' || ch > '\u009f')).ToArray()).ToLowerInvariant();
        if (compact.StartsWith("javascript:") || compact.StartsWith("vbscript:") || compact.StartsWith("livescript:")) return true;
        if (compact.StartsWith("data:"))
        {
            return !(compact.StartsWith("data:image/png") || compact.StartsWith("data:image/jpeg")
                || compact.StartsWith("data:image/jpg") || compact.StartsWith("data:image/gif")
                || compact.StartsWith("data:image/webp"));
        }
        return false;
    }

    /// <summary>
    /// JSON içerikte adı href/url/link ile biten metin alanlarından güvensiz olanların yollarını döner.
    /// </summary>
    public static IReadOnlyList<string> FindUnsafeLinks(JsonElement content)
    {
        var problems = new List<string>();
        Walk(content, "$", problems);
        return problems;
    }

    private static void Walk(JsonElement element, string path, List<string> problems)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                {
                    var childPath = $"{path}.{property.Name}";
                    if (property.Value.ValueKind == JsonValueKind.String && IsLinkKey(property.Name))
                    {
                        if (!IsSafe(property.Value.GetString())) problems.Add(childPath);
                    }
                    else
                    {
                        Walk(property.Value, childPath, problems);
                    }
                }
                break;
            case JsonValueKind.Array:
                var index = 0;
                foreach (var item in element.EnumerateArray())
                {
                    Walk(item, $"{path}[{index++}]", problems);
                }
                break;
        }
    }

    private static bool IsLinkKey(string name) =>
        name.EndsWith("href", StringComparison.OrdinalIgnoreCase)
        || name.EndsWith("url", StringComparison.OrdinalIgnoreCase)
        || name.EndsWith("link", StringComparison.OrdinalIgnoreCase);
}
