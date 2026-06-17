using System.Net.Http.Headers;
using System.Text.Json;
using CourseIntellect.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Azure Document Intelligence (prebuilt-layout) REST entegrasyonu.
/// Endpoint/anahtar yapılandırılmadıysa <see cref="IsConfigured"/> false döner
/// ve çağıran taraf mevcut yerel çıkarıma (regex/Word) güvenli şekilde düşer.
/// </summary>
public sealed class AzureDocumentIntelligenceService(
    HttpClient httpClient,
    IConfiguration configuration,
    IAppSettingService appSettingService) : IDocumentIntelligenceService
{
    private const string EnabledKey = "AzureDocumentIntelligence:Enabled";
    private const string EndpointKey = "AzureDocumentIntelligence:Endpoint";
    private const string ApiKeyKey = "AzureDocumentIntelligence:ApiKey";

    private readonly string _apiVersion =
        string.IsNullOrWhiteSpace(configuration["AzureDocumentIntelligence:ApiVersion"])
            ? "2024-11-30"
            : configuration["AzureDocumentIntelligence:ApiVersion"]!;
    private readonly string _model =
        string.IsNullOrWhiteSpace(configuration["AzureDocumentIntelligence:Model"])
            ? "prebuilt-layout"
            : configuration["AzureDocumentIntelligence:Model"]!;
    private readonly int _maxPollAttempts =
        int.TryParse(configuration["AzureDocumentIntelligence:MaxPollAttempts"], out var attempts) && attempts > 0 ? attempts : 60;
    private readonly int _pollDelayMs =
        int.TryParse(configuration["AzureDocumentIntelligence:PollDelayMs"], out var delay) && delay > 0 ? delay : 1500;

    public async Task<bool> IsEnabledAsync(CancellationToken cancellationToken = default)
    {
        var (enabled, endpoint, apiKey) = await ResolveSettingsAsync(cancellationToken);
        return enabled && !string.IsNullOrWhiteSpace(endpoint) && !string.IsNullOrWhiteSpace(apiKey);
    }

    // Ayar önceliği: geliştirici panelinden kaydedilen app-settings > ortam
    // değişkeni > appsettings.json. "Enabled" yoksa, anahtarlar tanımlıysa açık
    // kabul edilir (panelden kapatılana kadar).
    private async Task<(bool Enabled, string? Endpoint, string? ApiKey)> ResolveSettingsAsync(CancellationToken cancellationToken)
    {
        var section = configuration.GetSection("AzureDocumentIntelligence");

        var enabledSetting = await GetSettingAsync(EnabledKey, cancellationToken);
        var enabled = string.IsNullOrWhiteSpace(enabledSetting)
            || enabledSetting.Trim().Equals("true", StringComparison.OrdinalIgnoreCase)
            || enabledSetting.Trim() == "1";

        var endpoint = (await GetSettingAsync(EndpointKey, cancellationToken)
            ?? Environment.GetEnvironmentVariable("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
            ?? section["Endpoint"])?.TrimEnd('/');

        var apiKey = await GetSettingAsync(ApiKeyKey, cancellationToken)
            ?? Environment.GetEnvironmentVariable("AZURE_DOCUMENT_INTELLIGENCE_KEY")
            ?? section["ApiKey"];

        return (enabled, endpoint, apiKey);
    }

    private async Task<string?> GetSettingAsync(string key, CancellationToken cancellationToken)
    {
        try
        {
            var setting = await appSettingService.GetByKeyAsync(key, cancellationToken);
            return string.IsNullOrWhiteSpace(setting?.Value) ? null : setting!.Value;
        }
        catch
        {
            return null;
        }
    }

    public async Task<DocumentLayoutResult> AnalyzeLayoutAsync(
        byte[] content,
        string fileName,
        CancellationToken cancellationToken = default)
    {
        var (enabled, endpoint, apiKey) = await ResolveSettingsAsync(cancellationToken);
        if (!enabled)
        {
            return DocumentLayoutResult.Failure("Azure Document Intelligence geliştirici panelinden kapalı.");
        }

        if (string.IsNullOrWhiteSpace(endpoint) || string.IsNullOrWhiteSpace(apiKey))
        {
            return DocumentLayoutResult.Failure("Azure Document Intelligence yapılandırılmamış.");
        }

        try
        {
            var analyzeUrl =
                $"{endpoint}/documentintelligence/documentModels/{_model}:analyze" +
                $"?api-version={_apiVersion}&outputContentFormat=markdown";

            using var request = new HttpRequestMessage(HttpMethod.Post, analyzeUrl);
            request.Headers.TryAddWithoutValidation("Ocp-Apim-Subscription-Key", apiKey);
            request.Content = new ByteArrayContent(content);
            request.Content.Headers.ContentType = new MediaTypeHeaderValue(ResolveContentType(fileName));

            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                return DocumentLayoutResult.Failure($"Analyze isteği başarısız ({(int)response.StatusCode}): {Trim(body)}");
            }

            if (!response.Headers.TryGetValues("Operation-Location", out var locations))
            {
                return DocumentLayoutResult.Failure("Operation-Location başlığı dönmedi.");
            }

            var operationUrl = locations.First();
            return await PollResultAsync(operationUrl, apiKey, cancellationToken);
        }
        catch (Exception ex)
        {
            return DocumentLayoutResult.Failure($"Azure analizi sırasında hata: {ex.Message}");
        }
    }

    private async Task<DocumentLayoutResult> PollResultAsync(string operationUrl, string apiKey, CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < _maxPollAttempts; attempt++)
        {
            await Task.Delay(_pollDelayMs, cancellationToken);

            using var poll = new HttpRequestMessage(HttpMethod.Get, operationUrl);
            poll.Headers.TryAddWithoutValidation("Ocp-Apim-Subscription-Key", apiKey);

            using var response = await httpClient.SendAsync(poll, cancellationToken);
            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return DocumentLayoutResult.Failure($"Sonuç sorgusu başarısız ({(int)response.StatusCode}): {Trim(json)}");
            }

            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            var status = root.TryGetProperty("status", out var statusElement)
                ? statusElement.GetString()
                : null;

            switch (status)
            {
                case "succeeded":
                    return ParseAnalyzeResult(root);
                case "failed":
                    return DocumentLayoutResult.Failure("Azure analizi başarısız olarak işaretlendi.");
                default:
                    continue; // running / notStarted
            }
        }

        return DocumentLayoutResult.Failure("Azure analizi zaman aşımına uğradı.");
    }

    private static DocumentLayoutResult ParseAnalyzeResult(JsonElement root)
    {
        if (!root.TryGetProperty("analyzeResult", out var analyze))
        {
            return DocumentLayoutResult.Failure("analyzeResult bulunamadı.");
        }

        var text = analyze.TryGetProperty("content", out var contentElement)
            ? contentElement.GetString() ?? string.Empty
            : string.Empty;

        var pageCount = analyze.TryGetProperty("pages", out var pages) && pages.ValueKind == JsonValueKind.Array
            ? pages.GetArrayLength()
            : 0;

        var tableCount = analyze.TryGetProperty("tables", out var tables) && tables.ValueKind == JsonValueKind.Array
            ? tables.GetArrayLength()
            : 0;

        var selectedMarks = 0;
        if (pages.ValueKind == JsonValueKind.Array)
        {
            foreach (var page in pages.EnumerateArray())
            {
                if (!page.TryGetProperty("selectionMarks", out var marks) || marks.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                foreach (var mark in marks.EnumerateArray())
                {
                    if (mark.TryGetProperty("state", out var state) &&
                        string.Equals(state.GetString(), "selected", StringComparison.OrdinalIgnoreCase))
                    {
                        selectedMarks++;
                    }
                }
            }
        }

        return new DocumentLayoutResult(true, text, pageCount, tableCount, selectedMarks, null);
    }

    private static string ResolveContentType(string fileName)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        return extension switch
        {
            ".pdf" => "application/pdf",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".doc" => "application/msword",
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            ".tiff" or ".tif" => "image/tiff",
            ".bmp" => "image/bmp",
            _ => "application/octet-stream",
        };
    }

    private static string Trim(string value) =>
        value.Length > 500 ? value[..500] : value;
}
