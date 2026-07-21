using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using CourseIntellect.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Kurum sunucusunda çalışan Ollama'ya bağlanan yerel LLM istemcisi.
/// <c>/api/chat</c> ucunu <c>format: json</c> ile çağırır; modelden yalnız
/// <c>{"intent": "..."}</c> biçiminde bir etiket ister.
///
/// Tasarım ilkeleri:
/// - Yedek yoldur (kural motoru anlamayınca çağrılır), o yüzden zaman aşımı kısa.
/// - Hiçbir hâlde istisna fırlatmaz: ağ hatası, zaman aşımı, bozuk JSON → null.
///   Asistan, LLM olmasa da (Ollama kapalı) sorunsuz çalışmaya devam eder.
/// - Yalnız kullanıcının cümlesi ve niyet listesi gönderilir; öğrenci verisi asla.
/// </summary>
public sealed class OllamaIntentClient : ILocalLlmClient
{
    private readonly HttpClient http;
    private readonly ILogger<OllamaIntentClient> logger;
    private readonly bool enabled;
    private readonly string model;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public OllamaIntentClient(HttpClient http, IConfiguration configuration, ILogger<OllamaIntentClient> logger)
    {
        this.http = http;
        this.logger = logger;

        var section = configuration.GetSection("Assistant:Llm");
        enabled = section.GetValue("Enabled", false);
        model = section.GetValue("Model", "qwen2.5:7b-instruct") ?? "qwen2.5:7b-instruct";
        var baseUrl = section.GetValue("BaseUrl", "http://localhost:11434") ?? "http://localhost:11434";
        var timeout = section.GetValue("TimeoutSeconds", 8);

        http.BaseAddress = new Uri(baseUrl);
        http.Timeout = TimeSpan.FromSeconds(Math.Clamp(timeout, 2, 30));
    }

    public bool IsEnabled => enabled;

    public async Task<string?> ClassifyIntentAsync(
        string message,
        IReadOnlyDictionary<string, string> candidates,
        CancellationToken cancellationToken)
    {
        if (!enabled || string.IsNullOrWhiteSpace(message) || candidates.Count == 0)
            return null;

        try
        {
            var request = new OllamaChatRequest(
                model,
                new[]
                {
                    new OllamaMessage("system", BuildSystemPrompt(candidates)),
                    new OllamaMessage("user", message.Trim()),
                },
                Format: "json",
                Stream: false,
                Options: new OllamaOptions(Temperature: 0));

            using var response = await http.PostAsJsonAsync("/api/chat", request, JsonOptions, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Ollama sınıflama başarısız: HTTP {Status}", (int)response.StatusCode);
                return null;
            }

            var payload = await response.Content.ReadFromJsonAsync<OllamaChatResponse>(JsonOptions, cancellationToken);
            var content = payload?.Message?.Content;
            if (string.IsNullOrWhiteSpace(content)) return null;

            // Model format:json ile {"intent":"..."} döner; yine de savunmacı ayrıştır.
            using var doc = JsonDocument.Parse(content);
            if (doc.RootElement.TryGetProperty("intent", out var intentEl) && intentEl.ValueKind == JsonValueKind.String)
                return intentEl.GetString();

            return null;
        }
        catch (Exception ex)
        {
            // Zaman aşımı (TaskCanceledException), ağ hatası, bozuk JSON — hepsi
            // burada yutulur. Yerel LLM bir kolaylık katmanıdır, asistanı bloklamaz.
            logger.LogWarning(ex, "Ollama niyet sınıflama atlandı");
            return null;
        }
    }

    private static string BuildSystemPrompt(IReadOnlyDictionary<string, string> candidates)
    {
        var builder = new StringBuilder();
        builder.AppendLine("Sen bir okul/sürücü kursu yönetim yazılımının niyet sınıflandırıcısısın.");
        builder.AppendLine("Kullanıcının Türkçe cümlesini AŞAĞIDAKİ niyetlerden yalnız birine eşle.");
        builder.AppendLine("Hiçbiri uymuyorsa \"Unknown\" döndür. Açıklama yazma.");
        builder.AppendLine("Yanıtı SADECE şu JSON ile ver: {\"intent\": \"<NiyetAdı>\"}");
        builder.AppendLine();
        builder.AppendLine("Niyetler:");
        foreach (var (intent, description) in candidates)
            builder.AppendLine($"- {intent}: {description}");
        return builder.ToString();
    }

    private sealed record OllamaChatRequest(
        string Model,
        IReadOnlyList<OllamaMessage> Messages,
        [property: JsonPropertyName("format")] string Format,
        [property: JsonPropertyName("stream")] bool Stream,
        [property: JsonPropertyName("options")] OllamaOptions Options);

    private sealed record OllamaMessage(
        [property: JsonPropertyName("role")] string Role,
        [property: JsonPropertyName("content")] string Content);

    private sealed record OllamaOptions([property: JsonPropertyName("temperature")] double Temperature);

    private sealed record OllamaChatResponse([property: JsonPropertyName("message")] OllamaMessage? Message);
}
