namespace CourseIntellect.Domain.Permissions;

/// <summary>
/// Kurum yöneticisinin bir özel role verebileceği SAYFA/MODÜL kataloğu.
///
/// <para>Bu liste tek doğruluk kaynağıdır: yetki matrisi ekranı buradan çizilir,
/// rol kaydedilirken gelen anahtarlar buradan doğrulanır. İstemcinin gönderdiği
/// serbest metin anahtar KABUL EDİLMEZ — aksi hâlde kurum yöneticisi
/// "platform" gibi kendisine ait olmayan bir anahtar yazıp yetki uydurabilirdi.</para>
///
/// <para><b>Enforced:</b> anahtarın backend'de <c>[RequireEntitlement]</c> karşılığı
/// var demektir; işaretlenmemesi o sayfanın API'sini de kapatır. Enforced olmayan
/// anahtarlar yalnız MENÜ görünürlüğünü etkiler — katalogda açıkça ayrılır ki
/// "kapattım ama veri hâlâ çekilebiliyor" sürprizi olmasın.</para>
/// </summary>
public static class SchoolModuleCatalog
{
    public sealed record ModuleItem(string Key, string Label, string Group, bool Enforced);

    /// <summary>
    /// Katalog. Enforced=true olanlar backend'deki RequireEntitlement anahtarlarıyla
    /// BİREBİR aynıdır; yeni bir RequireEntitlement anahtarı eklenirse buraya da eklenmeli.
    /// </summary>
    public static readonly IReadOnlyList<ModuleItem> Items =
    [
        // ── Öğrenci ve akademik ──────────────────────────────────────────────
        new("students", "Öğrenciler", "Öğrenci ve Akademik", true),
        new("parents", "Veliler", "Öğrenci ve Akademik", true),
        new("teachers", "Öğretmenler", "Öğrenci ve Akademik", true),
        new("classes", "Sınıflar", "Öğrenci ve Akademik", true),
        new("schedule", "Ders Programı", "Öğrenci ve Akademik", true),
        new("attendance", "Yoklama / Devamsızlık", "Öğrenci ve Akademik", true),
        new("excuse", "Mazeret Bildirimi", "Öğrenci ve Akademik", true),
        new("exams", "Sınavlar", "Öğrenci ve Akademik", true),
        new("assignments", "Ödevler", "Öğrenci ve Akademik", true),
        new("content", "İçerikler", "Öğrenci ve Akademik", true),
        new("questions", "Soru Kutusu", "Öğrenci ve Akademik", true),
        new("question-bank", "Soru Bankası", "Öğrenci ve Akademik", true),
        new("live-lessons", "Canlı Dersler", "Öğrenci ve Akademik", true),
        new("study-plan", "Çalışma Planı", "Öğrenci ve Akademik", true),
        new("courses", "Kurslar", "Öğrenci ve Akademik", true),
        new("guidance", "Rehberlik", "Öğrenci ve Akademik", true),
        new("library", "Kütüphane", "Öğrenci ve Akademik", true),

        // ── Kurum operasyonu ─────────────────────────────────────────────────
        new("registrations", "Kayıt İşlemleri", "Kurum Operasyonu", true),
        new("staff-hr", "Personel / İzin", "Kurum Operasyonu", true),
        new("approvals", "Onaylar", "Kurum Operasyonu", true),
        new("tasks", "Görev Merkezi", "Kurum Operasyonu", true),
        new("duties", "Nöbet Çizelgesi", "Kurum Operasyonu", true),
        new("documents", "Belge Merkezi", "Kurum Operasyonu", true),
        new("notifications", "Duyurular", "Kurum Operasyonu", true),
        new("meetings", "Veli Görüşmeleri", "Kurum Operasyonu", true),
        new("chat", "Mesajlar", "Kurum Operasyonu", true),
        new("cafeteria", "Yemekhane", "Kurum Operasyonu", true),
        new("service", "Servis Takibi", "Kurum Operasyonu", true),
        new("org-units", "Şube / Birim Yönetimi", "Kurum Operasyonu", true),
        new("settings", "Ayarlar", "Kurum Operasyonu", true),

        // ── Finans ───────────────────────────────────────────────────────────
        new("finance", "Finans Özeti", "Finans", true),
        new("collections", "Tahsilatlar", "Finans", true),
        new("installments", "Taksitler", "Finans", true),
        new("late-payments", "Geciken Ödemeler", "Finans", true),
        new("payments", "Ödeme İşlemleri", "Finans", true),
        new("billing", "Fatura & Makbuz", "Finans", true),
        new("discounts-scholarships", "İndirim & Burs", "Finans", true),
        new("salary", "Maaş Yönetimi", "Finans", true),
        new("reconciliation", "Mutabakat", "Finans", true),
        new("overdue-rules", "Gecikme Kuralları", "Finans", true),
        new("bulk-actions", "Toplu İşlemler", "Finans", true),

        // ── Yalnız menü görünürlüğü (arkasında entitlement kapısı yok) ────────
        new("dashboard", "Ana Panel", "Genel", false),
        new("kpi", "Kurum Özeti", "Genel", false),
        new("reports", "Raporlar", "Genel", false),
    ];

    private static readonly HashSet<string> Keys =
        new(Items.Select(item => item.Key), StringComparer.OrdinalIgnoreCase);

    /// <summary>Anahtar bu katalogda var mı? (rol kaydında doğrulama kapısı)</summary>
    public static bool IsKnown(string key) => Keys.Contains(key?.Trim() ?? string.Empty);

    /// <summary>
    /// Katalogda OLMAYAN anahtarlar. Boş liste dönmesi "hepsi geçerli" demektir.
    /// Platform yönetimi anahtarları (platform, tenants, plans, limits…) katalogda
    /// bilinçli olarak YOKTUR: kurum yöneticisi kendi rolüne platform sayfası veremez.
    /// </summary>
    public static IReadOnlyList<string> UnknownKeys(IEnumerable<string>? requested) =>
        (requested ?? [])
            .Select(item => item?.Trim() ?? string.Empty)
            .Where(item => item.Length > 0 && !Keys.Contains(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
}
