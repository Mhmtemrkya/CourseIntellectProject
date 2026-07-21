namespace CourseIntellect.Application.DTOs.Common;

public sealed record UserSummaryDto(
    Guid Id,
    string FullName,
    string Username,
    string PrimaryRole,
    IReadOnlyList<string> ExtraRoles,
    string Status,
    string Campus,
    string DepartmentOrBranch
);

/// <summary>Pasif (deaktive) hesap — "Pasif Kayıtlar" ekranı için. Detail = öğrencide sınıf,
/// personelde bölüm/şube. Yeniden aktifleştirme username üzerinden yapılır.</summary>
public sealed record PassiveAccountDto(
    Guid UserId,
    string FullName,
    string Username,
    string PrimaryRole,
    IReadOnlyList<string> ExtraRoles,
    string Detail,
    DateTime? LastLoginAtUtc
);
