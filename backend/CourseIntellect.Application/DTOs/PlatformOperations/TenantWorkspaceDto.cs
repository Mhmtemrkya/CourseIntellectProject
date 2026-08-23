namespace CourseIntellect.Application.DTOs.PlatformOperations;

public sealed record TenantWorkspaceDto(
    Guid Id,
    string Name,
    string Email,
    string Plan,
    string Status,
    int Users,
    int Branches,
    int StudentCount,
    int StaffCount,
    decimal MonthlyFee,
    decimal Collected,
    decimal Storage,
    int Api,
    DateTime CreatedAtUtc,
    string Slug,
    string ContactName,
    string ContactPhone,
    Guid? AdminUserId,
    string? AdminUsername,
    string? TemporaryPassword,
    DateTime? ApprovedAtUtc,
    string InstitutionType,
    bool DrivingSchoolModuleEnabled,
    // Yalnız kurum kaydı başvurularında anlamlı; kurum satırlarında hep false.
    bool IsSuspicious = false,
    string? SuspiciousReason = null,
    // verified | awaiting | unproven — kurum satırlarında hep "verified".
    string VerificationState = "verified",
    /// <summary>Geçici parolanın son kullanma anı. Yalnız onay yanıtında dolu döner.</summary>
    DateTime? TemporaryPasswordExpiresAtUtc = null,
    /// <summary>Kurulum belgesi (PDF), base64. Yalnız onay ve belge yenileme
    /// yanıtlarında dolu; listeleme uçlarında hep null.</summary>
    string? SetupDocumentBase64 = null,
    string? SetupDocumentFileName = null
);

public enum SetupDocumentOutcome
{
    Ready,
    NotFound,

    /// <summary>Kurum yöneticisi kendi parolasını belirlemiş; belge yenilemek onun
    /// parolasını sıfırlamak olurdu. Doğru yol parola sıfırlama akışı.</summary>
    AlreadyActivated
}

public sealed record SetupDocumentResult(SetupDocumentOutcome Outcome, TenantWorkspaceDto? Tenant = null);
