using System.Globalization;
using System.Security;
using System.Text;
using CourseIntellect.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// NVİ'nin halka açık KPSPublic SOAP servisiyle TC kimlik doğrulaması.
/// Servis yalnızca "bu TC, bu ad-soyad ve doğum yılına ait mi?" sorusuna
/// evet/hayır döner — kişisel veri sızdırmaz, ücretsiz ve resmîdir.
/// </summary>
public sealed class NviIdentityVerificationService(
    HttpClient httpClient,
    ILogger<NviIdentityVerificationService> logger) : IIdentityVerificationService
{
    private const string Endpoint = "https://tckimlik.nvi.gov.tr/Service/KPSPublic.asmx";
    private static readonly CultureInfo Turkish = CultureInfo.GetCultureInfo("tr-TR");

    public async Task<bool?> VerifyTurkishIdAsync(
        string identityNumber,
        string firstName,
        string lastName,
        int birthYear,
        CancellationToken cancellationToken = default)
    {
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
            using var request = new HttpRequestMessage(HttpMethod.Post, Endpoint)
            {
                Content = new StringContent(envelope, Encoding.UTF8, "text/xml"),
            };
            request.Headers.Add("SOAPAction", "http://tckimlik.nvi.gov.tr/WS/TCKimlikNoDogrula");

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(8));

            var response = await httpClient.SendAsync(request, timeout.Token);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("NVİ doğrulama servisi {Status} döndü.", (int)response.StatusCode);
                return null;
            }

            var body = await response.Content.ReadAsStringAsync(timeout.Token);
            if (body.Contains("<TCKimlikNoDogrulaResult>true</TCKimlikNoDogrulaResult>", StringComparison.OrdinalIgnoreCase)) return true;
            if (body.Contains("<TCKimlikNoDogrulaResult>false</TCKimlikNoDogrulaResult>", StringComparison.OrdinalIgnoreCase)) return false;

            logger.LogWarning("NVİ doğrulama yanıtı çözümlenemedi.");
            return null;
        }
        catch (Exception exception) when (exception is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            // Servis çökmesi kayıt akışını asla durdurmaz: "doğrulanamadı" döneriz.
            logger.LogWarning(exception, "NVİ doğrulama servisine ulaşılamadı.");
            return null;
        }
    }
}
