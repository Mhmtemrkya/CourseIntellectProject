namespace CourseIntellect.Application.Interfaces;

public enum CaptchaVerificationStatus
{
    /// <summary>Sağlayıcı token'ı doğruladı.</summary>
    Success,

    /// <summary>Token yok, geçersiz ya da üretimde captcha yapılandırılmamış.</summary>
    Failed,

    /// <summary>Yalnız üretim dışında: captcha yapılandırılmadığı için atlandı.</summary>
    SkippedNotConfigured
}

public sealed record CaptchaVerificationResult(CaptchaVerificationStatus Status, string? Detail = null)
{
    public bool IsAllowed => Status != CaptchaVerificationStatus.Failed;
}

/// <summary>Halka açık formlar için bot doğrulaması (Cloudflare Turnstile / hCaptcha).</summary>
public interface ICaptchaVerificationService
{
    Task<CaptchaVerificationResult> VerifyAsync(
        string? token,
        string? remoteIp,
        CancellationToken cancellationToken = default);
}
