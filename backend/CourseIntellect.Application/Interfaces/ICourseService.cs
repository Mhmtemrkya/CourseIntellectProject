using CourseIntellect.Application.DTOs.Courses;

namespace CourseIntellect.Application.Interfaces;

public interface ICourseService
{
    Task<IReadOnlyList<CourseDto>> GetAllAsync(string? search, bool? isActive, CancellationToken cancellationToken = default);
    Task<CourseDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<CourseDto> CreateAsync(CreateCourseRequest request, CancellationToken cancellationToken = default);
    Task<CourseDto?> UpdateAsync(Guid id, UpdateCourseRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
