namespace CourseIntellect.Application.Exceptions;

/// <summary>
/// Kısa sürede çok sayıda başarısız giriş denemesi nedeniyle hesap geçici olarak
/// kilitlendiğinde fırlatılır. Controller bunu yakalayıp 429 + kalan süreyi döndürür.
/// </summary>
public sealed class AccountLockedException : Exception
{
    public AccountLockedException(int retryAfterMinutes)
        : base($"Çok sayıda hatalı giriş denemesi yapıldı. Hesabınız {retryAfterMinutes} dakika boyunca giriş için kilitlendi.")
    {
        RetryAfterMinutes = retryAfterMinutes;
    }

    public int RetryAfterMinutes { get; }
}
