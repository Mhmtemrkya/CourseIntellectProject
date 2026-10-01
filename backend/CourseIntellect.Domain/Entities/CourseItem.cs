namespace CourseIntellect.Domain.Entities;

/// <summary>Kuruma ait ders/kurs kaydı; TenantId null kayıtlar herkese açık sitenin
/// platform kataloğudur. Eskiden tablo ortaktı: her okulun kursları diğer okullara
/// ve kimlik doğrulamasız isteklere görünüyordu.</summary>
public sealed class CourseItem : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string Duration { get; set; } = string.Empty;
    public string Level { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
