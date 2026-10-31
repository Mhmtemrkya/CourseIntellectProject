namespace CourseIntellect.Application.DTOs.SubjectGroups;

public sealed record SubjectGroupMemberDto(
    Guid TeacherUserId,
    string TeacherName,
    string Branch,
    bool IsHead,
    DateTime JoinedAtUtc);

public sealed record SubjectGroupDto(
    Guid Id,
    string Subject,
    string Name,
    string AcademicYear,
    Guid? HeadTeacherUserId,
    string HeadTeacherName,
    string Description,
    string Color,
    IReadOnlyList<SubjectGroupMemberDto> Members,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);

/// <summary>Zümre oluşturma/güncelleme. Başkan üye listesinde yoksa otomatik eklenir.</summary>
public sealed record SaveSubjectGroupRequest(
    string Subject,
    string? Name,
    string? AcademicYear,
    Guid? HeadTeacherUserId,
    IReadOnlyList<Guid>? MemberUserIds,
    string? Description,
    string? Color);

/// <summary>Zümreye eklenebilecek öğretmen; Branch personel kartındaki branştır.</summary>
public sealed record SubjectGroupTeacherOptionDto(
    Guid UserId,
    string FullName,
    string Branch,
    IReadOnlyList<string> CurrentGroups);

/// <summary>Personel kartlarındaki branşlardan önerilen ders ve o branştaki öğretmen sayısı.</summary>
public sealed record SubjectSuggestionDto(string Subject, int TeacherCount, bool HasGroup);

public sealed record SubjectGroupOverviewDto(
    string AcademicYear,
    int GroupCount,
    int TeacherCount,
    int TeachersWithoutGroup,
    int GroupsWithoutHead,
    IReadOnlyList<SubjectGroupDto> Groups,
    IReadOnlyList<SubjectSuggestionDto> Suggestions);
