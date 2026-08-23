namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Mesajlaşma katılımcı kimliği tek kaynaktan üretilir. Thread kayıtlarında
/// katılımcı ADI tutulduğu için (ParticipantOneName/ParticipantTwoName), bu adı
/// karşılaştıran her yer — servis ve SignalR hub'ı — aynı normalizasyonu
/// kullanmak zorundadır. Aksi hâlde hub "katılımcı değil" derken servis
/// "katılımcı" diyebilir ve yetki kontrolü delinir.
/// </summary>
public static class MessageParticipantKey
{
    /// <summary>Türkçe karakterleri katlar; büyük/küçük hâli KORUR (kayıt biçimi budur).</summary>
    public static string Normalize(string? value)
    {
        return (value ?? string.Empty).Trim()
            .Replace('ç', 'c')
            .Replace('Ç', 'C')
            .Replace('ğ', 'g')
            .Replace('Ğ', 'G')
            .Replace('ı', 'i')
            .Replace('İ', 'I')
            .Replace('ö', 'o')
            .Replace('Ö', 'O')
            .Replace('ş', 's')
            .Replace('Ş', 'S')
            .Replace('ü', 'u')
            .Replace('Ü', 'U');
    }

    /// <summary>Karşılaştırma anahtarı: normalize + küçült. Yalnız EŞİTLİK için kullanılır.</summary>
    public static string Compare(string? value) => Normalize(value).ToLowerInvariant();

    /// <summary>Verilen ad, thread'in iki katılımcısından biri mi?</summary>
    public static bool IsParticipant(string? candidateName, string? participantOne, string? participantTwo)
    {
        var key = Compare(candidateName);
        if (key.Length == 0) return false;
        return key == Compare(participantOne) || key == Compare(participantTwo);
    }
}
