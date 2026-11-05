namespace CourseIntellect.Domain.Entities;

public sealed class StudyPlanState : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    /// <summary>Planın sahibi (öğrenci ya da personel kullanıcısı). Plan bununla bulunur; aynı adlı iki
    /// öğrenci ayrı plana sahiptir. Eski (ada göre tutulmuş) kayıtlarda migration ad kurumda tekse doldurur.</summary>
    public Guid? StudentUserId { get; set; }
    /// <summary>Yalnız gösterim için ad; anahtar DEĞİLDİR.</summary>
    public string StudentName { get; set; } = string.Empty;
    public string PlanItemsSerialized { get; set; } = "[]";
    public int StreakCount { get; set; }
    public int XpPoints { get; set; }
    public DateTime? LastCompletedAt { get; set; }
}
