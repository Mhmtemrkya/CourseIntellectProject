using CourseIntellect.Application.DTOs.StudentFinance;

namespace CourseIntellect.Application.Interfaces;

/// <summary>Ekstre PDF'inin marka/logo tarafı — belge verisi <see cref="Statement"/> içinde gelir.</summary>
public sealed record StudentStatementPdfModel(
    StudentStatementDto Statement,
    string BrandName,
    byte[]? LogoBytes,
    string AccentColor);

public interface IStudentStatementPdfService
{
    byte[] Generate(StudentStatementPdfModel model);
}
