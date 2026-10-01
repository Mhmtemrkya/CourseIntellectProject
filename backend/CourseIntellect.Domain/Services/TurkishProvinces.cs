namespace CourseIntellect.Domain.Services;

/// <summary>Türkiye'nin 81 ili. Kurum kaydında il alanı bu listeden doğrulanır.</summary>
public static class TurkishProvinces
{
    public static readonly IReadOnlyList<string> All =
    [
        "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya",
        "Artvin", "Aydın", "Balıkesir", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur",
        "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Edirne",
        "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane",
        "Hakkâri", "Hatay", "Isparta", "Mersin", "İstanbul", "İzmir", "Kars", "Kastamonu",
        "Kayseri", "Kırklareli", "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya",
        "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu",
        "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdağ", "Tokat",
        "Trabzon", "Tunceli", "Şanlıurfa", "Uşak", "Van", "Yozgat", "Zonguldak", "Aksaray",
        "Bayburt", "Karaman", "Kırıkkale", "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır",
        "Yalova", "Karabük", "Kilis", "Osmaniye", "Düzce",
    ];

    // Karşılaştırma tr-TR küçültmesiyle yapılır: "istanbul" (düz i) ile "İstanbul"
    // OrdinalIgnoreCase altında eşleşmez (noktalı/noktasız I). tr-TR'de ikisi de
    // "istanbul" olur.
    private static readonly System.Globalization.CultureInfo Tr = new("tr-TR");

    private static string Fold(string value) => value.Trim().ToLower(Tr);

    private static readonly Dictionary<string, string> Lookup =
        All.ToDictionary(Fold, p => p);

    public static bool IsKnown(string? province) =>
        !string.IsNullOrWhiteSpace(province) && Lookup.ContainsKey(Fold(province));

    /// <summary>Girilen ili kanonik yazımıyla (büyük/küçük harf standardı) döndürür.</summary>
    public static string? Canonical(string? province)
    {
        if (string.IsNullOrWhiteSpace(province)) return null;
        return Lookup.TryGetValue(Fold(province), out var known) ? known : null;
    }
}
