using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Services;

/// <summary>
/// Sürücü adayının kayıt ve kurs dosyası kuralları. Controller'dan bağımsızdır ki
/// "hangi belge zorunlu", "belge onaylı mı", "TC doğru mu" soruları tek yerde
/// yanıtlansın ve testlenebilsin.
/// </summary>
public static class DrivingStudentRules
{
    /// <summary>
    /// Her adayda aranan belgeler. Kan grubu belgesi 2026-07-22'de listeden
    /// çıkarıldı (kan grubu zaten kimlik/sağlık raporundan alınıyor); enum değeri
    /// ve etiketi eski kayıtlar okunabilsin diye duruyor, yeni dosyalarda aranmaz.
    /// </summary>
    public static readonly IReadOnlyList<StudentDocumentType> BaseRequiredDocuments =
    [
        StudentDocumentType.Identity,
        StudentDocumentType.Diploma,
        StudentDocumentType.HealthReport,
        StudentDocumentType.BiometricPhoto,
        StudentDocumentType.CriminalRecord,
        StudentDocumentType.Residence,
    ];

    /// <summary>18 yaşından küçük adayda veli izin belgesi de zorunludur.</summary>
    public static IReadOnlyList<StudentDocumentType> RequiredDocumentsFor(string? birthDate, DateTime nowUtc)
    {
        var required = BaseRequiredDocuments.ToList();
        if (DateTime.TryParse(birthDate, out var parsed) && parsed > nowUtc.AddYears(-18))
        {
            required.Add(StudentDocumentType.ParentalConsent);
        }
        return required;
    }

    public static List<StudentDocumentType> MissingDocuments(
        IEnumerable<StudentDocumentType> required,
        IReadOnlySet<StudentDocumentType> satisfied)
        => required.Where(x => !satisfied.Contains(x)).ToList();

    /// <summary>Belgenin görünen durumu yalnız inceleme durumudur; tarih metadata'sı kullanılmaz.</summary>
    public static StudentDocumentStatus EffectiveStatus(StudentDocumentStatus stored) => stored;

    /// <summary>Dosyayı "tamam" sayabilmek için güncel belge onaylı olmalıdır.</summary>
    public static bool CountsAsSatisfied(StudentDocumentStatus stored)
        => stored == StudentDocumentStatus.Approved;

    /// <summary>TC kimlik numarasının resmî kontrol basamağı doğrulaması.</summary>
    public static bool IsValidTurkishId(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length != 11 || !value.All(char.IsDigit) || value[0] == '0') return false;

        var digits = value.Select(x => x - '0').ToArray();
        var oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
        var evenSum = digits[1] + digits[3] + digits[5] + digits[7];
        var tenth = ((oddSum * 7) - evenSum) % 10;
        if (tenth < 0) tenth += 10;
        if (tenth != digits[9]) return false;

        return digits.Take(10).Sum() % 10 == digits[10];
    }

    public static string DocumentLabel(StudentDocumentType type) => type switch
    {
        StudentDocumentType.Identity => "Kimlik fotokopisi",
        StudentDocumentType.Diploma => "Diploma / öğrenim belgesi",
        StudentDocumentType.HealthReport => "Sağlık raporu",
        StudentDocumentType.BiometricPhoto => "Biyometrik fotoğraf",
        StudentDocumentType.CriminalRecord => "Adli sicil kaydı",
        StudentDocumentType.BloodTypeCertificate => "Kan grubu belgesi",
        StudentDocumentType.Residence => "İkametgâh",
        StudentDocumentType.ParentalConsent => "Veli izin belgesi",
        StudentDocumentType.ExistingLicense => "Mevcut ehliyet",
        StudentDocumentType.ForeignStudentDocument => "Yabancı kursiyer belgesi",
        _ => "Diğer belge",
    };

    /// <summary>MEBBİS aday kaydı için gereken verilerin sadeleştirilmiş görünümü.</summary>
    public sealed record MebbisCandidate(
        bool HasValidNationalId,
        string? BirthDate,
        string? FatherName,
        string? MotherName,
        string? BirthPlace,
        string? EducationLevel,
        string? IdentitySerialNo,
        string? Phone,
        bool HasPhoto,
        bool HealthReportApproved,
        bool DiplomaApproved,
        bool CriminalRecordApproved);

    /// <summary>
    /// MEBBİS aday girişinde eksik kalacak alanların listesi. Boş liste = MEBBİS'e
    /// eksiksiz girilebilir. Sıra, MEBBİS ekran sırasına yakın tutulur.
    /// </summary>
    public static List<string> MebbisMissingFields(MebbisCandidate candidate)
    {
        var missing = new List<string>();
        void Require(bool present, string label) { if (!present) missing.Add(label); }

        Require(candidate.HasValidNationalId, "Geçerli TC kimlik numarası");
        Require(!string.IsNullOrWhiteSpace(candidate.BirthDate), "Doğum tarihi");
        Require(!string.IsNullOrWhiteSpace(candidate.FatherName), "Baba adı");
        Require(!string.IsNullOrWhiteSpace(candidate.MotherName), "Anne adı");
        Require(!string.IsNullOrWhiteSpace(candidate.BirthPlace), "Doğum yeri");
        Require(!string.IsNullOrWhiteSpace(candidate.EducationLevel), "Öğrenim durumu");
        Require(!string.IsNullOrWhiteSpace(candidate.IdentitySerialNo), "Kimlik seri no");
        Require(!string.IsNullOrWhiteSpace(candidate.Phone), "Telefon");
        Require(candidate.HasPhoto, "Biyometrik fotoğraf");
        Require(candidate.HealthReportApproved, "Onaylı sağlık raporu");
        Require(candidate.DiplomaApproved, "Onaylı öğrenim belgesi");
        Require(candidate.CriminalRecordApproved, "Onaylı adli sicil kaydı");
        return missing;
    }
}
