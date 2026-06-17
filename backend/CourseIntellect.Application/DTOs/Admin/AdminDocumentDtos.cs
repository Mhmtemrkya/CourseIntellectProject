namespace CourseIntellect.Application.DTOs.Admin;

public sealed record CreateDocumentRequest(
    string Title,
    string Category,
    string Direction,
    string? DocumentNo,
    string? RelatedParty,
    string? FileUrl,
    string? ContentType,
    DateTime? ExpiryDate,
    string? Note);

public sealed record AdminDocumentDto(
    Guid Id,
    string Title,
    string Category,
    string Direction,
    string DocumentNo,
    string RelatedParty,
    string FileUrl,
    string ContentType,
    string Status,
    string Note,
    string UploadedByName,
    DateTime? ExpiryDateUtc,
    DateTime CreatedAtUtc);
