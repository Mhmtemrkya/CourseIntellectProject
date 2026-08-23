namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Giden e-posta. Sağlayıcıdan BAĞIMSIZ: yapılandırma düz SMTP (host/port/kullanıcı/
/// parola/gönderen) olduğu için SES, Postmark, Brevo, kurum sunucusu — hepsi aynı
/// ayarla çalışır. Böylece "hangi sağlayıcı" kararı koda sızmaz.
/// </summary>
public interface IEmailSender
{
    /// <summary>SMTP yapılandırılmış mı. Kapalıyken çağıranlar davranışlarını değiştirir.</summary>
    bool IsConfigured { get; }

    /// <summary>Gönderilemezse <c>false</c> döner; istisna fırlatmaz.</summary>
    Task<bool> SendAsync(
        string toAddress,
        string subject,
        string htmlBody,
        CancellationToken cancellationToken = default);
}
