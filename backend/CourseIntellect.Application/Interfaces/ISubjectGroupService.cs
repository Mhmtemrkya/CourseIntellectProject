using CourseIntellect.Application.DTOs.SubjectGroups;

namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Zümreler. Yazma işlemleri kurum yöneticisi ve şube müdürüne aittir (denetleyici
/// rolü kontrol eder); servis veri kurallarını uygular. Kural ihlalinde
/// InvalidOperationException, geçersiz girdide ArgumentException, bulunamazsa
/// KeyNotFoundException fırlatır.
/// </summary>
public interface ISubjectGroupService
{
    Task<SubjectGroupOverviewDto> GetOverviewAsync(string? academicYear, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SubjectGroupDto>> GetForTeacherAsync(Guid teacherUserId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SubjectGroupTeacherOptionDto>> GetTeacherOptionsAsync(string? academicYear, CancellationToken cancellationToken = default);
    Task<SubjectGroupDto> CreateAsync(SaveSubjectGroupRequest request, Guid? actorUserId, CancellationToken cancellationToken = default);
    Task<SubjectGroupDto> UpdateAsync(Guid id, SaveSubjectGroupRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
