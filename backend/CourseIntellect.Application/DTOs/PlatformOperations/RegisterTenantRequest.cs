namespace CourseIntellect.Application.DTOs.PlatformOperations;

/// <summary>
/// Pazarlama sitesindeki kurum kaydı formundan gelen ANONİM istek.
/// </summary>
/// <remarks>
/// Buraya parola alanı EKLENMEZ. Yönetici parolası onay anında üretilir
/// (<c>ApproveTenantAsync</c>); anonim uçta parola hash'lemek kimliksiz
/// KDF çalıştırmak demektir ve CPU amplifikasyon DoS'una açar.
/// </remarks>
public sealed record RegisterTenantRequest(
    string InstitutionName,
    string ContactName,
    string Email,
    string Phone,
    string Plan,
    int EstimatedStudents,
    string InstitutionType = "PrivateSchool",
    string? CaptchaToken = null,
    bool KvkkAccepted = false
);

/// <summary>Anonim isteğin kötüye kullanım triyajı için taşınan HTTP bağlamı.</summary>
public sealed record TenantRegistrationContext(
    string? IpAddress,
    string? UserAgent,
    string? Referer
);

/// <summary>
/// Kayıt sonucu. Anonim çağırana ne döneceğini controller belirler; servis
/// yalnız ne olduğunu söyler.
/// </summary>
public enum TenantRegistrationOutcome
{
    /// <summary>Başvuru alındı ve kuyruğa yazıldı.</summary>
    Accepted,

    /// <summary>Aynı e-posta için bekleyen başvuru var / cooldown penceresi dolmadı.</summary>
    Duplicate,

    /// <summary>Alan doğrulaması başarısız.</summary>
    Invalid,

    /// <summary>Captcha doğrulanamadı ya da üretimde yapılandırılmamış.</summary>
    CaptchaFailed,

    /// <summary>Günlük tavan aşıldı.</summary>
    Throttled,

    /// <summary>Alan adı ya da IP kara listede. Çağırana KABUL EDİLMİŞ gibi yanıt döner.</summary>
    Blocked
}

public sealed record RegistrationBlocklistEntryDto(
    Guid Id,
    string Kind,
    string Value,
    string? Reason,
    string CreatedByName,
    DateTime CreatedAtUtc);

/// <param name="Kind">domain | ip</param>
public sealed record AddRegistrationBlocklistRequest(string Kind, string Value, string? Reason);

/// <param name="Outcome">Ne olduğu.</param>
/// <param name="Message">Yalnız <see cref="TenantRegistrationOutcome.Invalid"/> ve
/// <see cref="TenantRegistrationOutcome.CaptchaFailed"/> için kullanıcıya gösterilebilir.</param>
public sealed record RegisterTenantResult(TenantRegistrationOutcome Outcome, string? Message = null);

public sealed record VerifyRegistrationRequest(string? Token);
