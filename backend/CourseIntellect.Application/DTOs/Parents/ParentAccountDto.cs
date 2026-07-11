namespace CourseIntellect.Application.DTOs.Parents;

/// <summary>Veli hesabı özeti: yönetici listesinde durum (aktif/pasif) ve bağlı öğrencilerle gösterilir.</summary>
public sealed record ParentAccountDto(
    Guid UserId,
    string FullName,
    string Username,
    string Phone,
    string Status,
    DateTime? LastLoginAtUtc,
    IReadOnlyList<string> Children);
