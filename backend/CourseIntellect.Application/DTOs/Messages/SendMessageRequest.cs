namespace CourseIntellect.Application.DTOs.Messages;

public sealed record SendMessageRequest(
    string Text,
    IReadOnlyList<MessageAttachmentDto>? Attachments
);
