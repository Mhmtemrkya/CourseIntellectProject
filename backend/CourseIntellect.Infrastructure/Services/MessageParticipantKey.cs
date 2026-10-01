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

    // ---- SignalR kişisel grup anahtarları ----
    // Gönderen servis ve hub AYNI biçimi kullanır. Ad tabanlı anahtar kurumla
    // nitelenir: eskiden yalnız ad kullanılıyordu ve başka kurumda aynı adlı
    // kullanıcı mesaj içeriğini (messageReceived) canlı olarak alıyordu.

    /// <summary>Kullanıcı kimliği küresel olarak tekildir; kurum gerekmez.</summary>
    public static string RealtimeUserKey(Guid userId) => $"id:{userId:N}";

    /// <summary>Kimliği olmayan (eski) kayıtlar için kurum + ad anahtarı.</summary>
    public static string RealtimeNameKey(Guid? tenantId, string? name) =>
        // "İ".ToLowerInvariant() "i" + U+0307 üretir; hub anahtarı küçültülmüş geldiği
        // için birleşik nokta atılır, aksi hâlde "İsmail" iki tarafta farklı anahtar olurdu.
        $"t:{tenantId?.ToString("N") ?? "none"}:{Compare(name).Replace("\u0307", string.Empty)}";

    /// <summary>Thread katılımcısı için anahtar: kimlik varsa kimlik, yoksa kurum + ad.</summary>
    public static string RealtimeParticipantKey(Guid? tenantId, Guid? userId, string? name) =>
        userId is Guid id ? RealtimeUserKey(id) : RealtimeNameKey(tenantId, name);
}
