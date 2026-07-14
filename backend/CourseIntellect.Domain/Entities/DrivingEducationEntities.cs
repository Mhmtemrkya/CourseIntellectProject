using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Entities;

public sealed class DrivingTheoryClass : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string LicenseClass { get; set; } = "B";
    public Guid InstructorStaffId { get; set; }
    public int Capacity { get; set; } = 24;
    public DateTime StartsAtUtc { get; set; }
    public DateTime EndsAtUtc { get; set; }
    public string Room { get; set; } = string.Empty;
    public DrivingTheoryClassStatus Status { get; set; } = DrivingTheoryClassStatus.Active;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class DrivingTheoryEnrollment : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid TheoryClassId { get; set; }
    public Guid StudentDrivingProfileId { get; set; }
    public DateTime EnrolledAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class DrivingTheorySession : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid TheoryClassId { get; set; }
    public Guid InstructorStaffId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Topic { get; set; } = string.Empty;
    public DateTime StartsAtUtc { get; set; }
    public DateTime EndsAtUtc { get; set; }
    public string Room { get; set; } = string.Empty;
    public DrivingTheorySessionStatus Status { get; set; } = DrivingTheorySessionStatus.Planned;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class DrivingTheoryAttendance : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid TheorySessionId { get; set; }
    public Guid StudentDrivingProfileId { get; set; }
    public DrivingTheoryAttendanceStatus Status { get; set; }
    public string Note { get; set; } = string.Empty;
    public Guid? MarkedByUserId { get; set; }
    public DateTime MarkedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class DrivingExamSession : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public DrivingExamType ExamType { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime StartsAtUtc { get; set; }
    public DateTime EndsAtUtc { get; set; }
    public string Location { get; set; } = string.Empty;
    public int Capacity { get; set; } = 20;
    public DrivingExamSessionStatus Status { get; set; } = DrivingExamSessionStatus.Planned;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class DrivingExamCommissionMember : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid ExamSessionId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Organization { get; set; } = string.Empty;
}

public sealed class DrivingExamCandidate : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid ExamSessionId { get; set; }
    public Guid StudentDrivingProfileId { get; set; }
    public int AttemptNo { get; set; } = 1;
    public Guid? PreviousCandidateId { get; set; }
    public DrivingExamCandidateStatus Status { get; set; } = DrivingExamCandidateStatus.Planned;
    public decimal? Score { get; set; }
    public string FailureReason { get; set; } = string.Empty;
    public string ResultNote { get; set; } = string.Empty;
    public DateTime? ResultEnteredAtUtc { get; set; }
    public Guid? ResultEnteredByUserId { get; set; }
    public Guid? DrivingChargeId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
