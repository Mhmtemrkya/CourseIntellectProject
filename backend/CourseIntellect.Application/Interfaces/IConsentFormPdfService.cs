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

public interface IConsentFormPdfService
{
    byte[] Generate(ConsentPdfModel model);
}
