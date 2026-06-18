using System.Net.Http.Json;
using System.Text.Json;
using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Ortak yapılandırma çözümlemesi: önce <see cref="IAppSettingService"/> (geliştirici
/// panelinden runtime girilen anahtar), yoksa ortam değişkeni / appsettings.json.
/// Böylece anahtar girilince entegrasyon yeniden derleme gerektirmeden aktifleşir.
/// </summary>
internal static class IntegrationSettingResolver
{
    public static async Task<string?> ResolveAsync(
        IAppSettingService appSettingService,
        IConfiguration configuration,
        string key,
        CancellationToken cancellationToken)
    {
        var setting = await appSettingService.GetByKeyAsync(key, cancellationToken);
        if (!string.IsNullOrWhiteSpace(setting?.Value))
        {
            return setting!.Value.Trim();
        }

        var fromConfig = configuration[key];
        return string.IsNullOrWhiteSpace(fromConfig) ? null : fromConfig.Trim();
    }

    public static bool IsTruthy(string? value) =>
        !string.IsNullOrWhiteSpace(value)
        && (value.Equals("true", StringComparison.OrdinalIgnoreCase)
            || value == "1"
            || value.Equals("on", StringComparison.OrdinalIgnoreCase)
            || value.Equals("enabled", StringComparison.OrdinalIgnoreCase));

    public static bool IsFalsy(string? value) =>
        !string.IsNullOrWhiteSpace(value)
        && (value.Equals("false", StringComparison.OrdinalIgnoreCase)
            || value == "0"
            || value.Equals("off", StringComparison.OrdinalIgnoreCase)
            || value.Equals("disabled", StringComparison.OrdinalIgnoreCase));
}

/// <summary>
/// Online ödeme ağ geçidi. "PaymentGateway:Provider" + "ApiKey" + "BaseUrl"
/// girilince gerçek REST çağrısı yapar (Bearer apiKey). Anahtar yoksa güvenli
/// test stub'u (yalnızca "TEST-OK" token'ı başarı). Sağlayıcıdan bağımsız jenerik
/// sözleşme: POST {BaseUrl}/payments/intents ve POST {BaseUrl}/payments/{id}/confirm.
/// </summary>
public sealed class HttpPaymentGatewayService(
    IConfiguration configuration,
    IAppSettingService appSettingService,
    HttpClient httpClient) : IPaymentGatewayService
{
    private const string EnabledKey = "PaymentGateway:Enabled";
    private const string ProviderKey = "PaymentGateway:Provider";
    private const string ApiKeyKey = "PaymentGateway:ApiKey";
    private const string BaseUrlKey = "PaymentGateway:BaseUrl";
    private const string CurrencyKey = "PaymentGateway:Currency";

    // Senkron best-effort (yalnızca appsettings/env). Asıl karar metot içinde async çözümlenir.
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(configuration[ProviderKey])
        && !string.IsNullOrWhiteSpace(configuration[ApiKeyKey])
        && !string.IsNullOrWhiteSpace(configuration[BaseUrlKey]);

    private async Task<(bool Configured, string Provider, string? ApiKey, string? BaseUrl, string Currency)> ResolveAsync(CancellationToken ct)
    {
        var provider = await IntegrationSettingResolver.ResolveAsync(appSettingService, configuration, ProviderKey, ct);
        var apiKey = await IntegrationSettingResolver.ResolveAsync(appSettingService, configuration, ApiKeyKey, ct);
        var baseUrl = (await IntegrationSettingResolver.ResolveAsync(appSettingService, configuration, BaseUrlKey, ct))?.TrimEnd('/');
        var currency = await IntegrationSettingResolver.ResolveAsync(appSettingService, configuration, CurrencyKey, ct) ?? "TRY";
        var enabledRaw = await IntegrationSettingResolver.ResolveAsync(appSettingService, configuration, EnabledKey, ct);

        var hasKeys = !string.IsNullOrWhiteSpace(provider) && !string.IsNullOrWhiteSpace(apiKey) && !string.IsNullOrWhiteSpace(baseUrl);
        // Enabled açıkça false ise kapalı; aksi halde anahtarlar tamsa açık.
        var configured = hasKeys && !IntegrationSettingResolver.IsFalsy(enabledRaw);
        return (configured, provider ?? "stub", apiKey, baseUrl, currency);
    }

    public async Task<PaymentIntentDto> CreateIntentAsync(PaymentIntentRequest request, CancellationToken cancellationToken = default)
    {
        var (configured, provider, apiKey, baseUrl, currency) = await ResolveAsync(cancellationToken);
        var reference = (request.FinanceInstallmentId ?? request.EnrollmentContractId ?? Guid.NewGuid()).ToString();

        if (!configured)
        {
            return new PaymentIntentDto(provider, $"PI-{Guid.NewGuid():N}", "StubReady", null, false);
        }

        try
        {
            using var message = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/payments/intents");
            message.Headers.TryAddWithoutValidation("Authorization", $"Bearer {apiKey}");
            message.Content = JsonContent.Create(new
            {
                amount = request.Amount,
                currency,
                reference,
                studentName = request.StudentName,
                returnUrl = request.ReturnUrl,
            });

            using var response = await httpClient.SendAsync(message, cancellationToken);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return new PaymentIntentDto(provider, reference, "Failed", null, true);
            }

            var intentId = ReadString(body, "id", "intentId", "token", "paymentId") ?? $"PI-{Guid.NewGuid():N}";
            var checkoutUrl = ReadString(body, "checkoutUrl", "paymentPageUrl", "redirectUrl", "url");
            var status = ReadString(body, "status") ?? "RequiresAction";
            return new PaymentIntentDto(provider, intentId, status, checkoutUrl, true);
        }
        catch
        {
            return new PaymentIntentDto(provider, reference, "Failed", null, true);
        }
    }

    public async Task<bool> ConfirmAsync(ConfirmPaymentRequest request, CancellationToken cancellationToken = default)
    {
        var (configured, _, apiKey, baseUrl, _) = await ResolveAsync(cancellationToken);

        if (!configured)
        {
            // Yapılandırma yoksa yalnızca açık test token'ı ile başarı (dev akışı).
            return string.Equals(request.Token, "TEST-OK", StringComparison.OrdinalIgnoreCase);
        }

        try
        {
            using var message = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/payments/{Uri.EscapeDataString(request.IntentId)}/confirm");
            message.Headers.TryAddWithoutValidation("Authorization", $"Bearer {apiKey}");
            message.Content = JsonContent.Create(new { token = request.Token });

            using var response = await httpClient.SendAsync(message, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return false;
            }

            var body = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
            var status = ReadString(body, "status", "result", "state") ?? string.Empty;
            return status.Equals("succeeded", StringComparison.OrdinalIgnoreCase)
                || status.Equals("paid", StringComparison.OrdinalIgnoreCase)
                || status.Equals("success", StringComparison.OrdinalIgnoreCase)
                || status.Equals("completed", StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private static string? ReadString(JsonElement element, params string[] names)
    {
        if (element.ValueKind != JsonValueKind.Object) return null;
        foreach (var name in names)
        {
            foreach (var prop in element.EnumerateObject())
            {
                if (string.Equals(prop.Name, name, StringComparison.OrdinalIgnoreCase)
                    && prop.Value.ValueKind is JsonValueKind.String or JsonValueKind.Number)
                {
                    var value = prop.Value.ToString();
                    if (!string.IsNullOrWhiteSpace(value)) return value;
                }
            }
        }
        return null;
    }
}

/// <summary>
/// e-Fatura/e-Arşiv. "EInvoice:Provider" + "ApiKey" + "BaseUrl" girilince GİB
/// entegratörüne gerçek istek (POST {BaseUrl}/einvoices). Anahtar yoksa KDV
/// hesaplı stub (mock ETTN). KDV her durumda hesaplanır.
/// </summary>
public sealed class HttpEInvoiceService(
    IConfiguration configuration,
    IAppSettingService appSettingService,
    HttpClient httpClient) : IEInvoiceService
{
    private const string EnabledKey = "EInvoice:Enabled";
    private const string ProviderKey = "EInvoice:Provider";
    private const string ApiKeyKey = "EInvoice:ApiKey";
    private const string BaseUrlKey = "EInvoice:BaseUrl";

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(configuration[ProviderKey])
        && !string.IsNullOrWhiteSpace(configuration[ApiKeyKey])
        && !string.IsNullOrWhiteSpace(configuration[BaseUrlKey]);

    public async Task<EInvoiceResultDto> IssueAsync(IssueEInvoiceRequest request, CancellationToken cancellationToken = default)
    {
        // Tutar KDV dahil kabul edilir; net ve KDV ayrıştırılır.
        var vatRate = request.VatRate <= 0 ? 0m : request.VatRate;
        var gross = Math.Max(0, request.Amount);
        var net = vatRate > 0 ? Math.Round(gross / (1 + vatRate / 100m), 2, MidpointRounding.AwayFromZero) : gross;
        var vat = gross - net;

        var provider = await IntegrationSettingResolver.ResolveAsync(appSettingService, configuration, ProviderKey, cancellationToken);
        var apiKey = await IntegrationSettingResolver.ResolveAsync(appSettingService, configuration, ApiKeyKey, cancellationToken);
        var baseUrl = (await IntegrationSettingResolver.ResolveAsync(appSettingService, configuration, BaseUrlKey, cancellationToken))?.TrimEnd('/');
        var enabledRaw = await IntegrationSettingResolver.ResolveAsync(appSettingService, configuration, EnabledKey, cancellationToken);

        var hasKeys = !string.IsNullOrWhiteSpace(provider) && !string.IsNullOrWhiteSpace(apiKey) && !string.IsNullOrWhiteSpace(baseUrl);
        var configured = hasKeys && !IntegrationSettingResolver.IsFalsy(enabledRaw);
        var providerName = string.IsNullOrWhiteSpace(provider) ? "stub" : provider!;

        if (!configured)
        {
            return new EInvoiceResultDto(
                providerName, "Stub", $"{Guid.NewGuid():N}"[..32].ToUpperInvariant(),
                net, vat, gross, false,
                "e-Fatura sağlayıcısı yapılandırılmadı; örnek (stub) belge üretildi.");
        }

        try
        {
            using var message = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/einvoices");
            message.Headers.TryAddWithoutValidation("Authorization", $"Bearer {apiKey}");
            message.Content = JsonContent.Create(new
            {
                customerName = request.StudentName,
                grossAmount = gross,
                netAmount = net,
                vatAmount = vat,
                vatRate,
                description = request.Description,
            });

            using var response = await httpClient.SendAsync(message, cancellationToken);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return new EInvoiceResultDto(providerName, "Failed", null, net, vat, gross, true,
                    $"Sağlayıcı hatası ({(int)response.StatusCode}).");
            }

            var ettn = ReadString(body, "ettn", "uuid", "id", "invoiceId") ?? $"{Guid.NewGuid():N}"[..32].ToUpperInvariant();
            var status = ReadString(body, "status") ?? "Issued";
            return new EInvoiceResultDto(providerName, status, ettn, net, vat, gross, true, null);
        }
        catch (Exception ex)
        {
            return new EInvoiceResultDto(providerName, "Failed", null, net, vat, gross, true, ex.Message);
        }
    }

    private static string? ReadString(JsonElement element, params string[] names)
    {
        if (element.ValueKind != JsonValueKind.Object) return null;
        foreach (var name in names)
        {
            foreach (var prop in element.EnumerateObject())
            {
                if (string.Equals(prop.Name, name, StringComparison.OrdinalIgnoreCase)
                    && prop.Value.ValueKind is JsonValueKind.String or JsonValueKind.Number)
                {
                    var value = prop.Value.ToString();
                    if (!string.IsNullOrWhiteSpace(value)) return value;
                }
            }
        }
        return null;
    }
}
