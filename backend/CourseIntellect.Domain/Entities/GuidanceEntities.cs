namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Rehberlik görüşme kaydı. Not içeriği hassastır: Visibility "private" ise
/// yalnızca kaydı oluşturan rehber, "guidance" ise tüm rehberlik servisi,
/// "admin" ise ek olarak kurum yöneticisi görebilir.
/// </summary>
public sealed class GuidanceSessionRecord : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string CounselorName { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    /// <summary>bireysel | veli | grup</summary>
    public string SessionType { get; set; } = "bireysel";
    /// <summary>motivasyon | sinav-kaygisi | aile | arkadas | akademik | diger</summary>
    public string Topic { get; set; } = "diger";
    public string Note { get; set; } = string.Empty;
    /// <summary>private | guidance | admin</summary>
    public string Visibility { get; set; } = "guidance";
    public DateTime SessionAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? FollowUpAtUtc { get; set; }
    public bool FollowUpDone { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>Öğrenci/veli tarafından istenen rehberlik randevusu.</summary>
public sealed class GuidanceAppointment : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string CounselorName { get; set; } = string.Empty;
    public string RequesterName { get; set; } = string.Empty;
    /// <summary>student | parent</summary>
    public string RequesterRole { get; set; } = "student";
    public string StudentName { get; set; } = string.Empty;
    /// <summary>"Pazartesi 09:00" biçiminde müsaitlik slotu.</summary>
    public string Slot { get; set; } = string.Empty;
    public string Topic { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
    /// <summary>Bekliyor | Onaylandı | Reddedildi | Tamamlandı</summary>
    public string Status { get; set; } = "Bekliyor";
    public string DecisionNote { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? DecidedAtUtc { get; set; }
}

/// <summary>Rehberin haftalık müsaitlik slotu ("Pazartesi 09:00").</summary>
public sealed class GuidanceAvailabilitySlot : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string CounselorName { get; set; } = string.Empty;
    public string Slot { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>Öğrencinin hedef okul/puan bilgisi ve ilerlemesi.</summary>
public sealed class GuidanceGoal : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string CounselorName { get; set; } = string.Empty;
    public string TargetSchool { get; set; } = string.Empty;
    public string TargetField { get; set; } = string.Empty;
    public string TargetScore { get; set; } = string.Empty;
    /// <summary>0-100 ilerleme; rehber günceller.</summary>
    public int Progress { get; set; }
    public string Note { get; set; } = string.Empty;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>Risk motorunun işaretlediği öğrenci için rehber inceleme kaydı.</summary>
public sealed class GuidanceRiskReview : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string CounselorName { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    /// <summary>İnceleme anındaki seviye: low | medium | high</summary>
    public string RiskLevel { get; set; } = "low";
    public string Note { get; set; } = string.Empty;
    public DateTime ReviewedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>Öğrenciye atanan anket/envanter ve yanıtları (tanı/puanlama yok).</summary>
public sealed class GuidanceInventoryAssignment : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string CounselorName { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    /// <summary>ogrenme-stili | sinav-kaygisi | ilgi-envanteri</summary>
    public string InventoryType { get; set; } = string.Empty;
    /// <summary>Atandı | Tamamlandı</summary>
    public string Status { get; set; } = "Atandı";
    /// <summary>[{"q":"...","a":"..."}] JSON.</summary>
    public string AnswersJson { get; set; } = "[]";
    public DateTime AssignedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAtUtc { get; set; }
}
