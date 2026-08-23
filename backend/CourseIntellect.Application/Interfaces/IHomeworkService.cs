using CourseIntellect.Application.DTOs.Homework;

namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Ödev modülü. Çağıranın rolü ve adı SERVİSE geçirilir; teslim sahipliği ve
/// teslim görünürlüğü bu kimliğe göre belirlenir. İstemciden gelen öğrenci adına
/// güvenilmez.
/// </summary>
public interface IHomeworkService
{
    /// <param name="requestorRole">Çağıranın rolü — teslimlerin kime görüneceğini belirler.</param>
    /// <param name="requestorName">Çağıranın adı — öğrenci yalnız kendi teslimini görür.</param>
    Task<IReadOnlyList<HomeworkAssignmentDto>> GetAssignmentsAsync(
        string requestorRole,
        string requestorName,
        CancellationToken cancellationToken = default);

    Task<HomeworkAssignmentDto> CreateAssignmentAsync(CreateHomeworkAssignmentRequest request, CancellationToken cancellationToken = default);

    Task<bool> DeleteAssignmentAsync(Guid id, CancellationToken cancellationToken = default);

    /// <param name="requestorRole">Öğrenci ise teslim daima KENDİ adına yazılır.</param>
    /// <param name="requestorName">Oturumdaki ad; gövdedeki ad yok sayılır.</param>
    Task<HomeworkAssignmentDto?> SubmitAssignmentAsync(
        Guid id,
        string requestorRole,
        string requestorName,
        CreateHomeworkSubmissionRequest request,
        CancellationToken cancellationToken = default);
}
