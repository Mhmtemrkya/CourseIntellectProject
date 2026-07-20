using System.Text.Json;
using System.Security.Claims;
using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Application.DTOs.Assistant;

public sealed record CreateAssistantConversationRequest(string? Title);
public sealed record AssistantConversationDto(Guid Id, string Title, DateTime CreatedAtUtc, DateTime UpdatedAtUtc, DateTime? LastMessageAtUtc);
public sealed record AssistantClientContext(string? CurrentRoute, Guid? SelectedStudentId);
public sealed record SendAssistantMessageRequest(Guid? ConversationId, string Message, Guid ClientMessageId, AssistantClientContext? Context);
public sealed record AssistantActionRequest(Guid ConversationId, string Command, Guid? StudentId);
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
public sealed record AssistantMessageDto(Guid Id, string Sender, string Type, string Text, AssistantIntent Intent, JsonElement? Data, DateTime CreatedAtUtc);
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
    string UserAgent);
