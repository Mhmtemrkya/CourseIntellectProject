using System.Text.Json;
using System.Security.Claims;
using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Application.DTOs.Assistant;

public sealed record CreateAssistantConversationRequest(string? Title);
public sealed record AssistantConversationDto(Guid Id, string Title, DateTime CreatedAtUtc, DateTime UpdatedAtUtc, DateTime? LastMessageAtUtc, string Portal = "");
/// <summary>
/// Portal: istemcinin bulunduğu panel (admin, administrative, teacher, accounting, parent, student).
/// Sunucu yalnız kullanıcının gerçekten sahip olduğu bir role karşılık geliyorsa kabul eder.
/// Language: "tr" ya da "en" (cevap dili).
/// SelectedStudentId / SelectedStudentName: kullanıcının ekranda baktığı öğrenci (öğrenci profili ya da
/// kullanıcı kimliği, ya da ad). Yalnız ipucudur; sunucu yine rol kapsamındaki öğrenciler içinde eşler.
/// </summary>
public sealed record AssistantClientContext(string? CurrentRoute, Guid? SelectedStudentId, string? Portal = null, string? Language = null, string? SelectedStudentName = null);
public sealed record SendAssistantMessageRequest(Guid? ConversationId, string Message, Guid ClientMessageId, AssistantClientContext? Context);
public sealed record AssistantActionRequest(Guid ConversationId, string Command, Guid? StudentId, AssistantClientContext? Context = null);
public sealed record AssistantActionDto(string Type, string Label, string? Route, string? Command, object? Parameters);
public sealed record AssistantResponseDto(
    Guid ConversationId,
    Guid MessageId,
    string Type,
    string Text,
    object? Data,
    IReadOnlyList<AssistantActionDto> Actions,
    IReadOnlyList<string> Suggestions,
    AssistantIntent Intent);
public sealed record AssistantMessageDto(
    Guid Id, string Sender, string Type, string Text, AssistantIntent Intent, JsonElement? Data, DateTime CreatedAtUtc,
    IReadOnlyList<AssistantActionDto>? Actions = null, IReadOnlyList<string>? Suggestions = null, int? Feedback = null);
/// <summary>Panel açılınca gösterilen günlük özet. Ask: satıra tıklanınca gönderilecek soru.</summary>
public sealed record AssistantBriefingItemDto(string Text, string Tone, string? Ask);
public sealed record AssistantBriefingDto(string Greeting, IReadOnlyList<AssistantBriefingItemDto> Items);
public sealed record AssistantFeedbackRequest(bool Helpful);
/// <summary>Asistanın cevaplayamadığı ya da "işe yaramadı" işaretlenen soru (soranın kimliği gösterilmez).</summary>
public sealed record AssistantUnansweredDto(Guid MessageId, string Question, string Answer, string Reason, string Portal, DateTime CreatedAtUtc);
public sealed record AssistantSuggestionDto(string Label, string Command, string Category);
public sealed record ParsedAssistantQuery(
    AssistantIntent Intent,
    string NormalizedMessage,
    string SearchText,
    string? TcNo,
    string? StudentNumber,
    int? GradeLevel,
    string? SectionName,
    decimal? ScoreThreshold);

public sealed record AssistantRequestContext(
    Guid UserId,
    Guid TenantId,
    Guid? BranchId,
    string PrimaryRole,
    IReadOnlySet<string> Roles,
    ClaimsPrincipal Principal,
    string CorrelationId,
    string IpAddress,
    string UserAgent,
    string Language = "tr");
