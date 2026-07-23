namespace CourseIntellect.Application.DTOs.DrivingMebbis;

/// <summary>
/// MEBBİS dışa aktarımının TEK belge modeli: hem Excel (.xlsx) hem PDF aynı
/// belgeden türer. Böylece iki çıktı asla ayrışmaz. Sürücü kursu raporlarındaki
/// tek-belge kuralının MEBBİS bölümleri için karşılığıdır.
/// </summary>
public sealed class MebbisExportDocument
{
    public string Title { get; init; } = string.Empty;
    public string Subtitle { get; init; } = string.Empty;
    public string SheetName { get; init; } = "MEBBIS";
    public List<MebbisExportColumn> Columns { get; init; } = [];
    public List<MebbisExportRow> Rows { get; init; } = [];
}

public sealed class MebbisExportColumn
{
    public string Header { get; init; } = string.Empty;
    /// <summary>Bu sütun biyometrik fotoğraf taşır (Excel'e gömülür, PDF'e çizilir).</summary>
    public bool IsPhoto { get; init; }
    /// <summary>Excel sütun genişliği (karakter). Fotoğraf sütununda görsel genişliğe göre ayarlanır.</summary>
    public double Width { get; init; } = 18;
}

public sealed class MebbisExportRow
{
    public List<string> Cells { get; init; } = [];
    /// <summary>Fotoğraf sütunu için görsel baytları (JPEG/PNG). Yoksa hücre boş kalır.</summary>
    public byte[]? Photo { get; init; }
}
