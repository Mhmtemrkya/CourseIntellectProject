namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Öğrenci kulübü. Kurum yöneticisi/şube müdürü açar ve danışman öğretmen atar;
/// danışman üyeleri ve etkinlikleri yönetir. Öğrenci katılma isteği gönderir,
/// danışman onaylar. Kontenjan (Capacity) doluysa yeni üye alınmaz.
/// </summary>
public sealed class Club : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public string Name { get; set; } = string.Empty;
    /// <summary>Science, Technology, Sports, Arts, Music, Literature, Language, SocialResponsibility, Culture, Other.</summary>
    public string Category { get; set; } = "Other";
    public string Description { get; set; } = string.Empty;
    public string AcademicYear { get; set; } = string.Empty;
    public Guid? AdvisorTeacherUserId { get; set; }
    public string AdvisorTeacherName { get; set; } = string.Empty;
    /// <summary>0 = sınırsız.</summary>
    public int Capacity { get; set; }
    /// <summary>Serbest metin toplantı düzeni (ör. "Çarşamba 15:30").</summary>
    public string MeetingSchedule { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    /// <summary>Kartlarda kullanılan vurgu rengi (#RRGGBB).</summary>
    public string Color { get; set; } = "#2563EB";
    /// <summary>true: öğrenci katılma isteği gönderebilir; false: üyeleri yalnız danışman/yönetici ekler.</summary>
    public bool AcceptsRequests { get; set; } = true;
    /// <summary>Active ya da Archived.</summary>
    public string Status { get; set; } = "Active";
    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
}

public sealed class ClubMember : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid ClubId { get; set; }
    public Guid StudentUserId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    /// <summary>President, VicePresident, Secretary, Member.</summary>
    public string Role { get; set; } = "Member";
    /// <summary>Pending (istek), Active, Rejected, Left.</summary>
    public string Status { get; set; } = "Pending";
    public string RequestNote { get; set; } = string.Empty;
    public string DecisionNote { get; set; } = string.Empty;
    public DateTime RequestedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? JoinedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
}

public sealed class ClubActivity : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid ClubId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime StartsAtUtc { get; set; }
    public string Location { get; set; } = string.Empty;
    /// <summary>Planned, Completed, Cancelled.</summary>
    public string Status { get; set; } = "Planned";
    /// <summary>Tamamlanan etkinlikte katılan üye sayısı ve kısa rapor.</summary>
    public int? AttendeeCount { get; set; }
    public string Outcome { get; set; } = string.Empty;
    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
}
