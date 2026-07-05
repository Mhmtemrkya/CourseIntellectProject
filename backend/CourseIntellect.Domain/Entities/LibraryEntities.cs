namespace CourseIntellect.Domain.Entities;

/// <summary>Kütüphane katalog kaydı. Kopya takibi TotalCopies üzerinden,
/// müsait kopya sayısı aktif ödünçlerden hesaplanır.</summary>
public sealed class LibraryBook : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string Publisher { get; set; } = string.Empty;
    public string Isbn { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Shelf { get; set; } = string.Empty;
    public int TotalCopies { get; set; } = 1;
    public string Notes { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>Ödünç kaydı. ReturnedAtUtc null ise aktiftir; gecikme durumu
/// DueAtUtc üzerinden hesaplanır. FineAmount iade anında hesaplanıp saklanır
/// (bilgilendirme amaçlı; tahsilat finans modülünde manuel yapılır).</summary>
public sealed class LibraryLoan : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid BookId { get; set; }
    public string BookTitle { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public DateTime LoanedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime DueAtUtc { get; set; }
    public DateTime? ReturnedAtUtc { get; set; }
    public int ExtensionCount { get; set; }
    public string IssuedBy { get; set; } = string.Empty;
    public decimal FineAmount { get; set; }
}

/// <summary>Rezervasyon kuyruğu. Kitap iade edilince sıradaki kayıt
/// "Hazır" yapılır ve öğrenciye bildirim düşer.</summary>
public sealed class LibraryReservation : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid BookId { get; set; }
    public string BookTitle { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    /// <summary>Bekliyor | Hazır | Tamamlandı | İptal</summary>
    public string Status { get; set; } = "Bekliyor";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ReadyAtUtc { get; set; }
}

/// <summary>Öğretmenin öğrenciye/sınıfa kitap önerisi.</summary>
public sealed class LibraryRecommendation : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid BookId { get; set; }
    public string BookTitle { get; set; } = string.Empty;
    public string TeacherName { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>Kurum bazlı kütüphane kuralları (tek satır/tenant).</summary>
public sealed class LibrarySettings : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public int LoanDays { get; set; } = 15;
    public int MaxActiveLoans { get; set; } = 3;
    public int MaxExtensions { get; set; } = 1;
    public int ExtensionDays { get; set; } = 7;
    public decimal FinePerDay { get; set; }
}
