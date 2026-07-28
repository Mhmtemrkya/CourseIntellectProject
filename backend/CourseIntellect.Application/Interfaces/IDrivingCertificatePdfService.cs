namespace CourseIntellect.Application.Interfaces;

public sealed record DrivingCertificatePdfModel(
    string InstitutionName,
    string InstitutionCode,
    string InstitutionCity,
    string InstitutionDistrict,
    string StudentName,
    string IdentityNumber,
    string FatherName,
    string MotherName,
    string BirthPlace,
    string BirthYear,
    string LicenseClass,
    string ExistingLicenseCity,
    string ExistingLicenseDate,
    string ExistingLicenseNumber,
    string ExistingLicenseClasses,
    string DocumentNumber,
    string MebbisCertificateNumber,
    string CertificateTitle,
    DateTime? CourseStartedAtUtc,
    DateTime? ExamPassedAtUtc,
    DateTime? IssuedAtUtc,
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
