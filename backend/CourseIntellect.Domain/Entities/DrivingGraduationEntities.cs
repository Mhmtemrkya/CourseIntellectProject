using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Entities;

public sealed class DrivingGraduationRecord : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid StudentDrivingProfileId { get; set; }
    public DrivingGraduationStatus Status { get; set; } = DrivingGraduationStatus.Pending;
    public string ChecklistJson { get; set; } = "[]";
    public DateTime CheckedAtUtc { get; set; } = DateTime.UtcNow;
    public Guid? GraduatedByUserId { get; set; }
    public DateTime? GraduatedAtUtc { get; set; }
    public string Note { get; set; } = string.Empty;
    public Guid? RevokedByUserId { get; set; }
    public DateTime? RevokedAtUtc { get; set; }
    public string RevocationReason { get; set; } = string.Empty;
}

public sealed class DrivingCertificate : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid GraduationRecordId { get; set; }
    public Guid StudentDrivingProfileId { get; set; }
    public DrivingCertificateType CertificateType { get; set; } = DrivingCertificateType.Completion;
    public string DocumentNumber { get; set; } = string.Empty;
    /// <summary>MEBBİS'in verdiği resmî sertifika numarası — kurum MEBBİS'ten okuyup işler.</summary>
    public string MebbisCertificateNo { get; set; } = string.Empty;
    public DateTime IssuedAtUtc { get; set; } = DateTime.UtcNow;
    public Guid? IssuedByUserId { get; set; }
    public DrivingCertificateDeliveryStatus DeliveryStatus { get; set; } = DrivingCertificateDeliveryStatus.Ready;
    public DateTime? DeliveredAtUtc { get; set; }
    public string DeliveredTo { get; set; } = string.Empty;
    public string DeliveryNote { get; set; } = string.Empty;
    public DrivingCertificateStatus Status { get; set; } = DrivingCertificateStatus.Active;
    public int Version { get; set; } = 1;
    public Guid? ReissuedFromCertificateId { get; set; }
    public string ReissueReason { get; set; } = string.Empty;
    public string VerificationTokenHash { get; set; } = string.Empty;
    public string PdfFileUrl { get; set; } = string.Empty;
    public string SnapshotJson { get; set; } = "{}";
    public Guid? RevokedByUserId { get; set; }
    public DateTime? RevokedAtUtc { get; set; }
    public string RevocationReason { get; set; } = string.Empty;
}

public sealed class DrivingGraduationActionRequest : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid StudentDrivingProfileId { get; set; }
    public Guid? GraduationRecordId { get; set; }
    public DrivingGraduationActionType ActionType { get; set; }
    public DrivingGraduationActionStatus Status { get; set; } = DrivingGraduationActionStatus.Pending;
    public string RequestedChecklistKeysJson { get; set; } = "[]";
    public string Reason { get; set; } = string.Empty;
    public Guid RequestedByUserId { get; set; }
    public DateTime RequestedAtUtc { get; set; } = DateTime.UtcNow;
    public Guid? FirstApprovedByUserId { get; set; }
    public DateTime? FirstApprovedAtUtc { get; set; }
    public Guid? SecondApprovedByUserId { get; set; }
    public DateTime? SecondApprovedAtUtc { get; set; }
    public Guid? RejectedByUserId { get; set; }
    public DateTime? RejectedAtUtc { get; set; }
    public string DecisionNote { get; set; } = string.Empty;
    public DateTime? AppliedAtUtc { get; set; }
}

public sealed class DrivingAppointmentRequest : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid StudentDrivingProfileId { get; set; }
    public DrivingAppointmentRequestType RequestType { get; set; }
    public DrivingAppointmentRequestStatus Status { get; set; } = DrivingAppointmentRequestStatus.Pending;
    public Guid? SourceAppointmentId { get; set; }
    public Guid? PreferredInstructorProfileId { get; set; }
    public Guid? PreferredVehicleId { get; set; }
    public DateTime RequestedStartsAtUtc { get; set; }
    public DateTime RequestedEndsAtUtc { get; set; }
    public string MeetingPoint { get; set; } = string.Empty;
    public string StudentNote { get; set; } = string.Empty;
    public string DecisionNote { get; set; } = string.Empty;
    public Guid? DecidedByUserId { get; set; }
    public DateTime? DecidedAtUtc { get; set; }
    public Guid? ResultAppointmentId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
