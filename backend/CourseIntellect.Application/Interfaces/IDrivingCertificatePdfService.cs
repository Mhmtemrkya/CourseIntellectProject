namespace CourseIntellect.Application.Interfaces;

public sealed record DrivingCertificatePdfModel(
    string InstitutionName,
    string StudentName,
    string LicenseClass,
    string DocumentNumber,
    string CertificateTitle,
    DateTime IssuedAtUtc,
    string DirectorName,
    string DirectorTitle,
    string PrimaryColor,
    string VerificationUrl,
    byte[]? LogoBytes,
    byte[]? SignatureBytes);

public interface IDrivingCertificatePdfService
{
    byte[] Generate(DrivingCertificatePdfModel model);
}
