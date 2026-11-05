namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Bir öğrenci için üretilmiş yazılı öneri notu (yapay zekâ ya da şablon). Sayılar ve
/// konu teşhisleri her zaman analiz motorundan gelir; bu kayıt yalnız metni saklar.
/// <see cref="InputHash"/> analiz girdisinin özetidir: veri değişmediyse yeniden üretilmez.
/// </summary>
public sealed class StudentInsightNote : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid StudentUserId { get; set; }
    public string InputHash { get; set; } = string.Empty;
    /// <summary>Pending, Ready ya da Failed.</summary>
    public string Status { get; set; } = "Pending";
    /// <summary>llm (model yazdı ve doğrulamadan geçti) ya da template (yedek şablon).</summary>
    public string Source { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    /// <summary>Modele verilen takma adlı, sayısız taslak (ad/sınıf yok). Eğitim verisinin girdisi.</summary>
    public string Draft { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    /// <summary>Doğrulamadan geçemeyen model çıktısının nedeni (ör. "rakam içeriyor").</summary>
    public string Error { get; set; } = string.Empty;
    public Guid? RequestedByUserId { get; set; }
    public DateTime RequestedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? GeneratedAtUtc { get; set; }
    /// <summary>
    /// Öğretmen değerlendirmesi: None, Approved, Edited, Rejected. Onaylanan/düzeltilen notlar
    /// (Draft → ReviewedText) kurumun kendi modelini ince ayarlamak için eğitim örneği olur.
    /// </summary>
    public string ReviewStatus { get; set; } = "None";
    public string ReviewedText { get; set; } = string.Empty;
    public Guid? ReviewedByUserId { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
}

/// <summary>
/// Sistemde çözülen denemede boş bırakılan soru. Cevaplanan sorular QuestionPracticeAttempt'e
/// yazılır; boşlar oraya YAZILMAZ (Yanlışlarım, XP ve çalışma istatistikleri o tabloyu "çözülen
/// soru" olarak okur). Yalnız konu analizi okur: başarı oranı ve "boş bırakma" teşhisi için gerekir.
/// </summary>
public sealed class ExamBlankAnswer : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid QuestionId { get; set; }
    public string StudentUsername { get; set; } = string.Empty;
    public Guid ExamSessionId { get; set; }
    public DateTime CompletedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Öğrenciye gösterilen öncelikli konu önerisi (ölçme için). Öneri gösterildiği andaki başarı
/// (Baseline) saklanır; sonraki cevaplar bununla karşılaştırılır. Aynı konu için 28 gün içinde
/// ikinci kayıt açılmaz. Sonuç (ilerleme/değişim yok/düşüş) saklanmaz, her seferinde cevaplardan hesaplanır.
/// </summary>
public sealed class StudentRecommendationRecord : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid StudentUserId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Topic { get; set; } = string.Empty;
    public string Diagnosis { get; set; } = string.Empty;
    public int Priority { get; set; }
    public int SuggestedQuestions { get; set; }
    public decimal BaselineSuccessRate { get; set; }
    public int BaselineSolved { get; set; }
    public DateTime IssuedAtUtc { get; set; } = DateTime.UtcNow;
}
