namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Onam formu PDF modeli. İmza görseli yoksa (şablon önizlemesi) belge ıslak
/// imza için boş çizgilerle basılır.
/// </summary>
public sealed record ConsentPdfModel(
    string InstitutionName,
    string Title,
    string Body,
    IReadOnlyList<string> CheckItems,
    IReadOnlyList<int> CheckedItems,
    string StudentName,
    string ContextLabel,
    string StaffName,
    string StaffNotes,
    string SignerLabel,
    string SignerName,
    string SignerRelation,
    DateTime? SignedAtUtc,
    byte[]? SignatureImage = null,
    byte[]? LogoBytes = null,
    string AccentColor = "#0F4C81",
    string FooterNote = "");

/// <summary>
/// Yüklenmiş PDF'in sonuna eklenen imza sayfasının künyesi. Belge kendisi
/// değişmediği için imzanın hangi dosyaya ait olduğu bu künyeden okunur.
/// </summary>
public sealed record ConsentDocumentStamp(string FileName, string Sha256, int PageCount);

/// <summary>Yüklenen PDF'in doğrulama sonucu.</summary>
public sealed record ConsentPdfInspection(bool Valid, string Message, int PageCount);

public interface IConsentFormPdfService
{
    byte[] Generate(ConsentPdfModel model);

    /// <summary>
    /// Yüklenmiş PDF + sonuna eklenen imza sayfası. Özgün sayfalara DOKUNULMAZ:
    /// matbu belgenin üstüne yazmak yerine ayrı bir imza tutanağı eklenir.
    /// </summary>
    byte[] AppendSignaturePage(byte[] sourcePdf, ConsentPdfModel model, ConsentDocumentStamp stamp);

    /// <summary>
    /// Yüklenen dosyanın gerçekten açılabilir, şifresiz bir PDF olduğunu doğrular
    /// ve sayfa sayısını döndürür. Yükleme anında çağrılır: bozuk belge imza
    /// masasında değil, yükleme ekranında fark edilmelidir.
    /// </summary>
    ConsentPdfInspection Inspect(byte[] pdf);
}
