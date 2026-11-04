namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Optik okuyucu çıktısının (sabit genişlikli metin dosyası) kolon düzeni. Kurum başına
/// kaydedilir ve denemelerde yeniden kullanılır. Kolonlar 1'den başlar; uzunluk 0 ise alan yok.
/// SubjectsJson: [{ "name": "Türkçe", "start": 41, "count": 20 }, ...] (sıra önemlidir).
/// </summary>
public sealed class OpticalTemplate : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    /// <summary>windows-1254 (Türkçe Windows; çoğu optik yazılım) ya da utf-8.</summary>
    public string Encoding { get; set; } = "windows-1254";
    public int StudentNoStart { get; set; }
    public int StudentNoLength { get; set; }
    public int NameStart { get; set; }
    public int NameLength { get; set; }
    public int ClassStart { get; set; }
    public int ClassLength { get; set; }
    public int BookletStart { get; set; }
    public int BookletLength { get; set; }
    public string SubjectsJson { get; set; } = "[]";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Optik deneme: cevap anahtarı, soru-konu eşlemesi ve puanlama kuralları.
/// KeysJson: [{ "booklet": "A", "subjects": [{ "subject": "Türkçe", "answers": "ABCD...", "topics": ["Paragraf", ...] }] }].
/// Cevap anahtarında X ya da * iptal edilmiş soruyu gösterir.
/// </summary>
public sealed class OpticalExam : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid TemplateId { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime ExamDateUtc { get; set; }
    /// <summary>Konu listesinin seviyesi: 5, 6, 7, LGS, TYT, AYT, YDT; boş = belirtilmemiş (eski kayıtlar).</summary>
    public string Level { get; set; } = string.Empty;
    /// <summary>Kaç yanlış bir doğruyu götürür: LGS 3, TYT/AYT 4, 0 = götürmez.</summary>
    public int WrongPenalty { get; set; }
    /// <summary>Çoklu işaretleme (*) yanlış mı sayılır (true) yoksa boş mu (false).</summary>
    public bool MultiMarkAsWrong { get; set; } = true;
    /// <summary>İptal edilen soru: exclude (değerlendirme dışı) ya da correct (herkese doğru).</summary>
    public string CancelledMode { get; set; } = "exclude";
    public string KeysJson { get; set; } = "[]";
    public string Status { get; set; } = "Draft";
    public string FileName { get; set; } = string.Empty;
    public int ImportedStudentCount { get; set; }
    public DateTime? ImportedAtUtc { get; set; }
    public Guid? ImportedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>Öğrencinin bir denemedeki tek sorusu (konu analizi bunu kullanır).</summary>
public sealed class OpticalExamAnswer : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid OpticalExamId { get; set; }
    public Guid StudentUserId { get; set; }
    public string Booklet { get; set; } = "A";
    public string Subject { get; set; } = string.Empty;
    /// <summary>Kitapçıktaki soru sırası (1'den başlar).</summary>
    public int QuestionNo { get; set; }
    /// <summary>Boşsa konu analizine girmez.</summary>
    public string Topic { get; set; } = string.Empty;
    /// <summary>Correct, Wrong ya da Blank.</summary>
    public string Outcome { get; set; } = "Blank";
    public string Marked { get; set; } = string.Empty;
}

/// <summary>Öğrencinin bir denemedeki ders sonucu; mevcut raporlar için ExamResult'a da yazılır.</summary>
public sealed class OpticalExamStudentResult : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid OpticalExamId { get; set; }
    public Guid StudentUserId { get; set; }
    public string StudentNo { get; set; } = string.Empty;
    public string Booklet { get; set; } = "A";
    public string Subject { get; set; } = string.Empty;
    public int Correct { get; set; }
    public int Wrong { get; set; }
    public int Blank { get; set; }
    public decimal Net { get; set; }
    public Guid? ExamResultId { get; set; }
}

/// <summary>
/// Kurumun hazır listede olmayan, kendi eklediği soru konusu. Ders ve seviyeye bağlıdır (seviye boş = her seviye).
/// Denemelerde konu yine düz metin olarak saklanır; bu kayıt yalnız seçim listesini besler, silinmesi denemeleri etkilemez.
/// </summary>
public sealed class OpticalCustomTopic : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Level { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    /// <summary>Türkçe harf katlamalı tekilleştirme anahtarı (OpticalTopicCatalog.Fold).</summary>
    public string NormalizedName { get; set; } = string.Empty;
    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
