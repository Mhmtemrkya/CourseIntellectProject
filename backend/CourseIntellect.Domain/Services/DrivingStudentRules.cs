using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Services;

/// <summary>
/// Sürücü adayının kayıt ve kurs dosyası kuralları. Controller'dan bağımsızdır ki
/// "hangi belge zorunlu", "belge hâlâ geçerli mi", "TC doğru mu" soruları tek yerde
/// yanıtlansın ve testlenebilsin.
/// </summary>
public static class DrivingStudentRules
{
    /// <summary>Her adayda aranan belgeler.</summary>
    public static readonly IReadOnlyList<StudentDocumentType> BaseRequiredDocuments =
    [
        StudentDocumentType.Identity,
        StudentDocumentType.Diploma,
        StudentDocumentType.HealthReport,
        StudentDocumentType.BiometricPhoto,
        StudentDocumentType.CriminalRecord,
        StudentDocumentType.BloodTypeCertificate,
        StudentDocumentType.Residence,
    ];

    /// <summary>Süreli belgeler: son geçerlilik tarihi olmadan yüklenemez/onaylanamaz.</summary>
    public static readonly IReadOnlySet<StudentDocumentType> ExpiringDocuments =
        new HashSet<StudentDocumentType>
        {
            StudentDocumentType.HealthReport,
            StudentDocumentType.CriminalRecord,
            StudentDocumentType.ExistingLicense,
        };

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

    /// <summary>
    /// Belgenin görünen durumu. Süresi dolmuş bir belge onaylı olsa bile geçerli
    /// sayılmaz — dosya yeniden eksiğe düşer.
    /// </summary>
    public static StudentDocumentStatus EffectiveStatus(
        StudentDocumentStatus stored,
        DateTime? expiresAtUtc,
        DateTime nowUtc)
        => expiresAtUtc is { } expires && expires <= nowUtc
            ? StudentDocumentStatus.Expired
            : stored;

    /// <summary>Dosyayı "tamam" sayabilmek için belge onaylı VE süresi geçerli olmalı.</summary>
    public static bool CountsAsSatisfied(StudentDocumentStatus stored, DateTime? expiresAtUtc, DateTime nowUtc)
        => EffectiveStatus(stored, expiresAtUtc, nowUtc) == StudentDocumentStatus.Approved;

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
        _ => "Diğer belge",
    };
}
