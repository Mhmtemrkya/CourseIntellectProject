namespace CourseIntellect.Application.Interfaces;

/// <summary>Sözleşme/form paketinde üretilebilecek belgeler.</summary>
public enum DrivingContractFormKind
{
    /// <summary>EK-1 Özel Motorlu Taşıt Sürücüleri Kursuna Müracaat Formu.</summary>
    Application,
    /// <summary>Kursiyerin İmza Sirküleri (MEBBİS'e taranarak yüklenir).</summary>
    SignatureCircular,
    /// <summary>Kayıt sözleşmesi — ön ve arka yüz (2 sayfa).</summary>
    Contract,
}

/// <summary>Sözleşmedeki taksit tablosunun bir satırı.</summary>
public sealed record DrivingContractInstallment(string Label, decimal Amount, DateTime? DueDateUtc, DateTime? PaidAtUtc);

/// <summary>
/// Resmî formların doldurulması için gereken tüm veri. Controller kursiyer dosyası,
/// kurum ayarları ve finans sözleşmesinden toplayıp buraya düzleştirir; PDF katmanı
/// veri erişimi yapmaz.
/// </summary>
public sealed record DrivingContractFormData(
    // ─── Kursiyer ───
    string FullName,
    string IdentityNumber,
    string FatherName,
    string MotherName,
    string BirthPlace,
    string BirthDate,
    string EducationLevel,
    string LicenseClass,
    string Phone,
    string HomePhone,
    string ResidenceAddress,
    // Nüfusa kayıtlı olduğu yer
    string RegistrationCity,
    string RegistrationDistrict,
    string RegistrationNeighborhood,
    string RegistrationStreet,
    string RegistrationVolumeNo,
    string RegistrationFamilyOrderNo,
    string RegistrationOrderNo,
    string IdentityIssueDate,
    string IdentityIssuePlace,
    // Daha önce alınmış sürücü belgesi
    string ExistingLicenseCity,
    string ExistingLicenseClasses,
    string ExistingLicenseDate,
    string ExistingLicenseNumber,
    // ─── Kurum ───
    string InstitutionName,
    string InstitutionCity,
    string InstitutionDistrict,
    string InstitutionAddress,
    string InstitutionPhone,
    string DirectorName,
    string BankName,
    string BankAccountNo,
    string JurisdictionCity,
    // ─── Ücret ───
    decimal TotalFee,
    decimal TheoryHourlyFee,
    decimal DrivingHourlyFee,
    decimal TheoryExamFee,
    decimal DrivingExamFee,
    int TheoryHours,
    int DrivingHours,
    /// <summary>Dördüncü hakta başarısız olana uygulanacak ek eğitim bedeli.</summary>
    decimal FailedFourthAttemptFee,
    IReadOnlyList<DrivingContractInstallment> Installments,
    decimal DownPayment,
    // ─── Künye ───
    DateTime RegisteredAtUtc,
    DateTime GeneratedAtUtc);

public interface IDrivingContractFormPdfService
{
    /// <summary>Tek bir belgeyi üretir.</summary>
    byte[] Generate(DrivingContractFormKind kind, DrivingContractFormData data);

    /// <summary>Üç belgeyi tek PDF'te (4 sayfa) birleştirir — kayıt masasında tek seferde basmak için.</summary>
    byte[] GenerateBundle(DrivingContractFormData data);
}
