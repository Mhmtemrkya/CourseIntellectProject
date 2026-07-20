using System.Text.Json.Serialization;

namespace CourseIntellect.Domain.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum DrivingMebbisWorkType
{
    CandidateRegistration = 1,
    DocumentApproval = 2,
    TermAssignment = 3,
    ExamResult = 4,
    CertificateNumber = 5,
    TermDeadline = 6,
    Reconciliation = 7,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum DrivingMebbisWorkStatus
{
    Preparing = 1,
    Ready = 2,
    EntryPending = 3,
    Entered = 4,
    Verified = 5,
    Error = 6,
    CorrectionPending = 7,
}
