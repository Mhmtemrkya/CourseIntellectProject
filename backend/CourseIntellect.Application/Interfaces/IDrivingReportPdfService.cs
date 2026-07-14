namespace CourseIntellect.Application.Interfaces;

/// <summary>Rapor tablosunun tek bir sütunu. <paramref name="Numeric"/> sağa yaslar.</summary>
public sealed record DrivingReportColumn(string Header, bool Numeric = false);

/// <summary>
/// Denetime/muhasebeye sunulabilir rapor dökümü. Aynı model hem PDF hem CSV
/// üretiminde kullanılır ki iki çıktı asla ayrışmasın.
/// </summary>
public sealed record DrivingReportDocument(
    string InstitutionName,
    string Title,
    string Description,
    DateTime FromUtc,
    DateTime ToUtc,
    IReadOnlyList<DrivingReportColumn> Columns,
    IReadOnlyList<IReadOnlyList<string>> Rows,
    IReadOnlyList<(string Label, string Value)> Summary,
    string? PrimaryColor = null,
    byte[]? LogoBytes = null);

public interface IDrivingReportPdfService
{
    byte[] Generate(DrivingReportDocument document);
}
