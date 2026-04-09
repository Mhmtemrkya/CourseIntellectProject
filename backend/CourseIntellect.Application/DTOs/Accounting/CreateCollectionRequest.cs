namespace CourseIntellect.Application.DTOs.Accounting;

public sealed record CreateCollectionRequest(string Name, string ClassName, string Amount, string Method, string Note);
