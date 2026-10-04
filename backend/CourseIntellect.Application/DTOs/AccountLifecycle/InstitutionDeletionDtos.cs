namespace CourseIntellect.Application.DTOs.AccountLifecycle;

/// <summary>Kurum silme talebi oluşturma (kurum yöneticisi). Reauth zorunlu.</summary>
public sealed class CreateInstitutionDeletionRequest
{
    public string Password { get; set; } = string.Empty;
    public bool Confirm { get; set; }
}

/// <summary>Platform yöneticisinin kurum silme kararı.</summary>
public sealed class InstitutionDeletionDecisionRequest
{
    /// <summary>true → onayla (zamanla); false → reddet.</summary>
    public bool Approve { get; set; }

    /// <summary>Reddetme gerekçesi (reddederken zorunlu).</summary>
    public string? RejectReason { get; set; }
}

/// <summary>İşlem öncesi etkilenecek varlıkların özeti.</summary>
public sealed class InstitutionDeletionImpactDto
{
    public int UserCount { get; set; }
    public int StudentCount { get; set; }
    public int FileCount { get; set; }
    public int FinanceRecordCount { get; set; }
    public int EducationRecordCount { get; set; }
}

public sealed class InstitutionDeletionStatusDto
{
    public Guid? Id { get; set; }
    public string Status { get; set; } = "none";
    public DateTime? RequestedAtUtc { get; set; }
    public DateTime? FinalizeAtUtc { get; set; }
    public string? RejectReason { get; set; }
    public InstitutionDeletionImpactDto? Impact { get; set; }
}

/// <summary>Platform kuyruğundaki kurum silme talebi.</summary>
public sealed class InstitutionDeletionQueueItemDto
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime RequestedAtUtc { get; set; }
    public DateTime? FinalizeAtUtc { get; set; }
    public InstitutionDeletionImpactDto Impact { get; set; } = new();
}
