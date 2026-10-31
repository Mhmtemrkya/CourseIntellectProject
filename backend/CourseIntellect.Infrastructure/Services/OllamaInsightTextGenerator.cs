using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using CourseIntellect.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Öneri notu için yerel Ollama istemcisi. Ayar bölümü "Insights:Llm":
/// Enabled (varsayılan false), BaseUrl (geliştirmede bu makine, canlıda VPN'deki LLM kasası),
/// Model (varsayılan qwen2.5:3b), TimeoutSeconds, NumCtx (4 GB'lık kart için 2048), Temperature.
/// Kapalıysa, hata ya da zaman aşımında null döner; asla fırlatmaz.
/// </summary>
public sealed class OllamaInsightTextGenerator : IInsightTextGenerator
{
    private readonly HttpClient http;
    private readonly ILogger<OllamaInsightTextGenerator> logger;
    private readonly int numCtx;
    private readonly double temperature;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public OllamaInsightTextGenerator(HttpClient http, IConfiguration configuration, ILogger<OllamaInsightTextGenerator> logger)
    {
        this.http = http;
        this.logger = logger;
        var section = configuration.GetSection("Insights:Llm");
        IsEnabled = section.GetValue("Enabled", false);
        Model = section.GetValue("Model", "qwen2.5:3b") ?? "qwen2.5:3b";
        numCtx = Math.Clamp(section.GetValue("NumCtx", 2048), 512, 32768);
        temperature = Math.Clamp(section.GetValue("Temperature", 0.2), 0, 1);
        var baseUrl = section.GetValue("BaseUrl", "http://127.0.0.1:11434") ?? "http://127.0.0.1:11434";
        http.BaseAddress = new Uri(baseUrl);
        // Gece toplu üretimde yavaş bir kartta tek not dakikayı bulabilir.
        http.Timeout = TimeSpan.FromSeconds(Math.Clamp(section.GetValue("TimeoutSeconds", 90), 5, 600));
    }

    public bool IsEnabled { get; }
    public string Model { get; }

    public async Task<string?> GenerateJsonAsync(
        string systemPrompt,
        IReadOnlyList<(string Role, string Content)> messages,
        object jsonSchema,
        CancellationToken cancellationToken)
    {
        if (!IsEnabled) return null;
        try
        {
            var all = new List<ChatMessage> { new("system", systemPrompt) };
            all.AddRange(messages.Select(item => new ChatMessage(item.Role, item.Content)));
            var request = new ChatRequest(Model, all, false, jsonSchema, new ChatOptions(temperature, numCtx));
            using var response = await http.PostAsJsonAsync("/api/chat", request, JsonOptions, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Öneri modeli {Status} döndü.", (int)response.StatusCode);
                return null;
            }
            var body = await response.Content.ReadFromJsonAsync<ChatResponse>(JsonOptions, cancellationToken);
            return body?.Message?.Content;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or NotSupportedException)
        {
            logger.LogWarning(ex, "Öneri modeline ulaşılamadı.");
            return null;
        }
    }

    private sealed record ChatMessage(string Role, string Content);
    private sealed record ChatOptions(double Temperature, [property: JsonPropertyName("num_ctx")] int NumCtx);
    private sealed record ChatRequest(string Model, IReadOnlyList<ChatMessage> Messages, bool Stream, object Format, ChatOptions Options);
    private sealed record ChatResponse(ChatMessage? Message);
}
