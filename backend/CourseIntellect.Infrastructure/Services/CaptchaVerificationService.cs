using System.Text.Json;
using CourseIntellect.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Cloudflare Turnstile (varsayılan) veya hCaptcha token doğrulaması.
/// </summary>
/// <remarks>
/// Yapılandırma:
/// <code>
/// Captcha:Provider  turnstile | hcaptcha   (varsayılan: turnstile)
/// Captcha:Secret    sağlayıcıdan alınan gizli anahtar
/// Captcha:VerifyUrl (opsiyonel; sağlayıcıya göre varsayılanı var)
/// </code>
/// ÜRETİMDE FAIL-CLOSED: <c>Captcha:Secret</c> tanımlı değilse doğrulama
/// <see cref="CaptchaVerificationStatus.Failed"/> döner ve kayıt reddedilir.
/// Anahtarsız deploy, korumayı sessizce kaldırmak yerine kaydı gürültülü
/// şekilde durdurur. Üretim dışında (lokal/dev) atlanır.
/// </remarks>
public sealed class CaptchaVerificationService : ICaptchaVerificationService
{
    private const string TurnstileVerifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
    private const string HCaptchaVerifyUrl = "https://hcaptcha.com/siteverify";

    private readonly HttpClient httpClient;
    private readonly ILogger<CaptchaVerificationService> logger;
    private readonly IHostEnvironment environment;
    private readonly string? secret;
    private readonly string verifyUrl;

    public CaptchaVerificationService(
        HttpClient httpClient,
        IConfiguration configuration,
        IHostEnvironment environment,
        ILogger<CaptchaVerificationService> logger)
    {
        this.httpClient = httpClient;
        this.logger = logger;
        this.environment = environment;

        var configuredSecret = Environment.GetEnvironmentVariable("COURSE_INTELLECT_CAPTCHA_SECRET");
        if (string.IsNullOrWhiteSpace(configuredSecret)) configuredSecret = configuration["Captcha:Secret"];
        secret = string.IsNullOrWhiteSpace(configuredSecret) ? null : configuredSecret.Trim();

        var provider = configuration["Captcha:Provider"]?.Trim().ToLowerInvariant() ?? "turnstile";
        var configuredUrl = configuration["Captcha:VerifyUrl"];
        verifyUrl = string.IsNullOrWhiteSpace(configuredUrl)
            ? provider == "hcaptcha" ? HCaptchaVerifyUrl : TurnstileVerifyUrl
            : configuredUrl.Trim();
    }

    public async Task<CaptchaVerificationResult> VerifyAsync(
        string? token,
        string? remoteIp,
        CancellationToken cancellationToken = default)
    {
        if (secret is null)
        {
            if (environment.IsProduction())
            {
                logger.LogCritical(
                    "Captcha:Secret tanımlı değil. Üretimde halka açık form korumasız kalmasın diye istek REDDEDİLDİ.");
                return new CaptchaVerificationResult(
                    CaptchaVerificationStatus.Failed,
                    "Doğrulama servisi yapılandırılmamış.");
            }

            logger.LogWarning("Captcha:Secret tanımlı değil; {Environment} ortamında doğrulama atlandı.",
                environment.EnvironmentName);
            return new CaptchaVerificationResult(CaptchaVerificationStatus.SkippedNotConfigured);
        }

        if (string.IsNullOrWhiteSpace(token))
        {
            return new CaptchaVerificationResult(CaptchaVerificationStatus.Failed, "Doğrulama kodu eksik.");
        }

        try
        {
            var fields = new List<KeyValuePair<string, string>>
            {
                new("secret", secret),
                new("response", token.Trim()),
            };
            if (!string.IsNullOrWhiteSpace(remoteIp))
            {
                fields.Add(new KeyValuePair<string, string>("remoteip", remoteIp));
            }

            using var response = await httpClient.PostAsync(
                verifyUrl,
                new FormUrlEncodedContent(fields),
                cancellationToken);

            var payload = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Captcha doğrulama servisi {Status} döndü.", (int)response.StatusCode);
                return new CaptchaVerificationResult(CaptchaVerificationStatus.Failed, "Doğrulama tamamlanamadı.");
            }

            using var document = JsonDocument.Parse(payload);
            var success = document.RootElement.TryGetProperty("success", out var successElement)
                          && successElement.ValueKind == JsonValueKind.True;

            if (success)
            {
                return new CaptchaVerificationResult(CaptchaVerificationStatus.Success);
            }

            logger.LogInformation("Captcha doğrulaması reddedildi: {Payload}", payload);
            return new CaptchaVerificationResult(CaptchaVerificationStatus.Failed, "Doğrulama başarısız.");
        }
        catch (Exception ex)
        {
            // Sağlayıcıya ulaşılamıyorsa da fail-closed: aksi hâlde sağlayıcıyı
            // yavaşlatmak korumayı kapatmanın yolu olurdu.
            logger.LogError(ex, "Captcha doğrulaması sırasında hata.");
            return new CaptchaVerificationResult(CaptchaVerificationStatus.Failed, "Doğrulama tamamlanamadı.");
        }
    }
}
