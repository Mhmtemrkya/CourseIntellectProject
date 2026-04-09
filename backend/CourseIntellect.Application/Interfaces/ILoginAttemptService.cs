using CourseIntellect.Application.DTOs.LoginAttempts;

namespace CourseIntellect.Application.Interfaces;

public interface ILoginAttemptService
{
    Task<IReadOnlyList<LoginAttemptDto>> GetAllAsync(string? search, string? role, bool? success, CancellationToken cancellationToken = default);
    Task<LoginAttemptStatsDto> GetStatsAsync(CancellationToken cancellationToken = default);
    Task<LoginAttemptDto> CreateAsync(CreateLoginAttemptRequest request, CancellationToken cancellationToken = default);
}
