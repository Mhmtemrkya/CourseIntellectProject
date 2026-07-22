namespace CourseIntellect.Domain.Services;

public static class DrivingMebbisEntryFields
{
    public sealed record Definition(string Key, string Label);

    public static readonly IReadOnlyList<Definition> Ordered =
    [
        new("nationalId", "TC kimlik numarası"),
        new("firstName", "Ad"),
        new("lastName", "Soyad"),
        new("birthDate", "Doğum tarihi"),
        new("motherName", "Anne adı"),
        new("fatherName", "Baba adı"),
        new("birthPlace", "Doğum yeri"),
        new("educationLevel", "Öğrenim durumu"),
        new("phone", "Telefon"),
        new("licenseClass", "Sertifika sınıfı"),
    ];

    private static readonly HashSet<string> KeySet = Ordered.Select(x => x.Key).ToHashSet(StringComparer.Ordinal);

    public static bool IsKnown(string? key) => key is not null && KeySet.Contains(key);
}
