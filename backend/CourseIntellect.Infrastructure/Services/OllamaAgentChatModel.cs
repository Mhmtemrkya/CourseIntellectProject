using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using CourseIntellect.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Asistan ajanı için Ollama istemcisi (<c>/api/chat</c>, araç çağırma). Ayarlar
/// <c>Assistant:Agent</c> bölümünden okunur; varsayılan KAPALI.
///
/// - Hiçbir hâlde fırlatmaz: hata/zaman aşımı → null, asistan kural motoruyla devam eder.
/// - <c>keep_alive</c> modeli bellekte tutar; ilk yükleme (10–20 sn) her soruda tekrarlanmaz.
/// - Sıcaklık 0: aynı soru aynı aracı seçsin.
/// </summary>
public sealed class OllamaAgentChatModel : IAssistantChatModel
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly HttpClient http;
    private readonly ILogger<OllamaAgentChatModel> logger;
    private readonly string model;
    private readonly int numCtx;
    private readonly string keepAlive;

    public OllamaAgentChatModel(HttpClient http, IConfiguration configuration, ILogger<OllamaAgentChatModel> logger)
    {
        this.http = http;
        this.logger = logger;
        var section = configuration.GetSection("Assistant:Agent");
        IsEnabled = section.GetValue("Enabled", false);
        NarrateResults = section.GetValue("Narrate", true);
        Budget = TimeSpan.FromSeconds(Math.Clamp(section.GetValue("BudgetSeconds", 45), 5, 300));
        model = section.GetValue("Model", "qwen2.5:7b-instruct") ?? "qwen2.5:7b-instruct";
        numCtx = Math.Clamp(section.GetValue("NumCtx", 8192), 2048, 32768);
        keepAlive = section.GetValue("KeepAlive", "30m") ?? "30m";
        http.BaseAddress = new Uri(section.GetValue("BaseUrl", "http://127.0.0.1:11434") ?? "http://127.0.0.1:11434");
        http.Timeout = TimeSpan.FromSeconds(Math.Clamp(section.GetValue("TimeoutSeconds", 30), 5, 300));
    }

    public bool IsEnabled { get; }

    public bool NarrateResults { get; }

    public TimeSpan Budget { get; }

    public async Task<AssistantChatTurn?> ChatAsync(IReadOnlyList<AssistantChatMessage> messages, IReadOnlyList<AssistantToolSpec> tools, CancellationToken cancellationToken)
    {
        if (!IsEnabled) return null;
        try
        {
            var request = new ChatRequest(
                model,
                messages.Select(message => new ChatMessage(
                    message.Role,
                    message.Content,
                    message.ToolCalls?.Select(call => new ChatToolCall(new ChatFunctionCall(call.Name, call.Arguments))).ToList(),
                    message.ToolName)).ToList(),
                tools.Select(tool => new ChatTool("function", new ChatFunction(tool.Name, tool.Description, tool.Parameters))).ToList(),
                false,
                keepAlive,
                new ChatOptions(0, numCtx));

            using var response = await http.PostAsJsonAsync("/api/chat", request, JsonOptions, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Asistan modeli cevap vermedi: HTTP {Status}", (int)response.StatusCode);
                return null;
            }
            var payload = await response.Content.ReadFromJsonAsync<ChatResponse>(JsonOptions, cancellationToken);
            if (payload?.Message is null) return null;
            var calls = (payload.Message.ToolCalls ?? [])
                .Where(call => !string.IsNullOrWhiteSpace(call.Function?.Name))
                .Select(call => new AssistantToolCall(call.Function!.Name, ArgumentsOf(call.Function.Arguments)))
                .ToList();
            return new AssistantChatTurn(payload.Message.Content ?? string.Empty, calls);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Asistan modeli atlandı");
            return null;
        }
    }

    /// <summary>Bazı modeller argümanları nesne yerine JSON metni olarak döndürür.</summary>
    private static JsonElement ArgumentsOf(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.String)
        {
            try { return JsonDocument.Parse(value.GetString() ?? "{}").RootElement.Clone(); }
            catch (JsonException) { return JsonDocument.Parse("{}").RootElement.Clone(); }
        }
        return value.ValueKind == JsonValueKind.Object ? value : JsonDocument.Parse("{}").RootElement.Clone();
    }

    private sealed record ChatRequest(
        [property: JsonPropertyName("model")] string Model,
        [property: JsonPropertyName("messages")] IReadOnlyList<ChatMessage> Messages,
        [property: JsonPropertyName("tools")] IReadOnlyList<ChatTool> Tools,
        [property: JsonPropertyName("stream")] bool Stream,
        [property: JsonPropertyName("keep_alive")] string KeepAlive,
        [property: JsonPropertyName("options")] ChatOptions Options);

    private sealed record ChatOptions(
        [property: JsonPropertyName("temperature")] double Temperature,
        [property: JsonPropertyName("num_ctx")] int NumCtx);

    private sealed record ChatMessage(
        [property: JsonPropertyName("role")] string Role,
        [property: JsonPropertyName("content")] string? Content,
        [property: JsonPropertyName("tool_calls")] IReadOnlyList<ChatToolCall>? ToolCalls,
        [property: JsonPropertyName("tool_name")] string? ToolName);

    private sealed record ChatToolCall([property: JsonPropertyName("function")] ChatFunctionCall? Function);

    private sealed record ChatFunctionCall(
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("arguments")] JsonElement Arguments);

    private sealed record ChatTool(
        [property: JsonPropertyName("type")] string Type,
        [property: JsonPropertyName("function")] ChatFunction Function);

    private sealed record ChatFunction(
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("description")] string Description,
        [property: JsonPropertyName("parameters")] JsonElement Parameters);

    private sealed record ChatResponse([property: JsonPropertyName("message")] ChatMessage? Message);
}
