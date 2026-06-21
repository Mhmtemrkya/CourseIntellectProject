using CourseIntellect.Application.DTOs.Duty;

namespace CourseIntellect.Application.Interfaces;

public interface ITeacherDutyService
{
    Task<CreateDutyResult> CreateAsync(CreateDutyRequest request, Guid? actorUserId, string actorName, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<DutyResponse>> GetMineAsync(Guid? teacherUserId, string teacherName, string scope, CancellationToken cancellationToken = default);

    Task<DutyStatsResponse> GetMineStatsAsync(Guid? teacherUserId, string teacherName, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<DutyResponse>> GetAllAsync(DateTime? from, DateTime? to, string? dutyType, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TeacherDutyLoadDto>> GetLoadAsync(DateTime? monthStart, CancellationToken cancellationToken = default);

    Task<DutyResponse?> UpdateAsync(Guid id, UpdateDutyRequest request, CancellationToken cancellationToken = default);

    Task<DutyResponse?> SetStatusAsync(Guid id, string status, CancellationToken cancellationToken = default);

    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);

    Task<int> CancelSeriesAsync(Guid groupId, CancellationToken cancellationToken = default);
}
