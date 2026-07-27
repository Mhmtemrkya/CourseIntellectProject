using System.Globalization;
using System.Security;
using System.Text;
using CourseIntellect.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// KPS (NVİ) kimlik doğrulama istemcisi.
/// </summary>
/// <remarks>
/// NVİ'nin herkese açık <c>KPSPublic.asmx</c> SOAP servisi kapatıldığı için uç nokta
/// artık SABİT DEĞİL, yapılandırmadan okunur:
/// <code>
/// Nvi:Endpoint  (veya COURSE_INTELLECT_NVI_ENDPOINT)
/// Nvi:SoapAction
/// </code>
/// Tanımlı değilse servis "yapılandırılmadı" der; sahte bir "doğrulanamadı"
/// mesajıyla kullanıcıyı yanıltmaz. Kurum KPS aboneliği aldığında tek satır
/// yapılandırmayla devreye girer, kod değişmez.
/// </remarks>
public sealed class NviIdentityVerificationService : IIdentityVerificationService
{
    private static readonly CultureInfo Turkish = CultureInfo.GetCultureInfo("tr-TR");

    private readonly HttpClient httpClient;
    private readonly ILogger<NviIdentityVerificationService> logger;
    private readonly string? endpoint;
    private readonly string soapAction;

    public NviIdentityVerificationService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<NviIdentityVerificationService> logger)
    {
        this.httpClient = httpClient;
        this.logger = logger;
        var configured = Environment.GetEnvironmentVariable("COURSE_INTELLECT_NVI_ENDPOINT");
        if (string.IsNullOrWhiteSpace(configured)) configured = configuration["Nvi:Endpoint"];
        endpoint = string.IsNullOrWhiteSpace(configured) ? null : configured.Trim();
        soapAction = configuration["Nvi:SoapAction"] ?? "http://tckimlik.nvi.gov.tr/WS/TCKimlikNoDogrula";
    }

    public bool IsConfigured => endpoint is not null;

    public async Task<IdentityVerificationResult> VerifyTurkishIdAsync(
        string identityNumber,
        string firstName,
        string lastName,
        int birthYear,
        CancellationToken cancellationToken = default)
    {
        if (endpoint is null)
        {
            return new IdentityVerificationResult(
                IdentityVerificationStatus.NotConfigured,
                "Kurumda KPS/NVİ kimlik doğrulama aboneliği tanımlı değil.");
        }

        // NVİ adları BÜYÜK harf Türkçe karşılaştırır; "ömer" → "ÖMER" (tr-TR).
        var envelope = $"""
            <?xml version="1.0" encoding="utf-8"?>
            <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body>
                <TCKimlikNoDogrula xmlns="http://tckimlik.nvi.gov.tr/WS">
                  <TCKimlikNo>{SecurityElement.Escape(identityNumber.Trim())}</TCKimlikNo>
                  <Ad>{SecurityElement.Escape(firstName.Trim().ToUpper(Turkish))}</Ad>
                  <Soyad>{SecurityElement.Escape(lastName.Trim().ToUpper(Turkish))}</Soyad>
                  <DogumYili>{birthYear}</DogumYili>
                </TCKimlikNoDogrula>
              </soap:Body>
            </soap:Envelope>
            """;

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
            {
                Content = new StringContent(envelope, Encoding.UTF8, "text/xml"),
            };
            request.Headers.Add("SOAPAction", soapAction);

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(8));

            var response = await httpClient.SendAsync(request, timeout.Token);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("NVİ doğrulama servisi {Status} döndü ({Endpoint}).", (int)response.StatusCode, endpoint);
                return new IdentityVerificationResult(
                    IdentityVerificationStatus.Unavailable,
                    $"Servis {(int)response.StatusCode} yanıtı verdi.");
            }

            var body = await response.Content.ReadAsStringAsync(timeout.Token);
            if (body.Contains("<TCKimlikNoDogrulaResult>true</TCKimlikNoDogrulaResult>", StringComparison.OrdinalIgnoreCase))
                return new IdentityVerificationResult(IdentityVerificationStatus.Verified);
            if (body.Contains("<TCKimlikNoDogrulaResult>false</TCKimlikNoDogrulaResult>", StringComparison.OrdinalIgnoreCase))
                return new IdentityVerificationResult(IdentityVerificationStatus.Mismatch);

            logger.LogWarning("NVİ doğrulama yanıtı çözümlenemedi.");
            return new IdentityVerificationResult(IdentityVerificationStatus.Unavailable, "Servis yanıtı çözümlenemedi.");
        }
        catch (Exception exception) when (exception is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            // Servis çökmesi kayıt akışını asla durdurmaz.
            logger.LogWarning(exception, "NVİ doğrulama servisine ulaşılamadı ({Endpoint}).", endpoint);
            return new IdentityVerificationResult(IdentityVerificationStatus.Unavailable, "Servise ulaşılamadı.");
        }
    }
}
