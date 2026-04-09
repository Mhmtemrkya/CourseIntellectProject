namespace CourseIntellect.Application.DTOs.Translations;

public sealed record BulkUpsertTranslationRequest(
    List<UpsertTranslationRequest> Items
);
