using CourseIntellect.Application.DTOs.OpticalExams;

namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Deneme sonrası kişisel çalışma planı: içe aktarılmış optik cevaplardan öğrenci başına zayıf konular,
/// bir haftalık görev önerisi ve kısa veli özeti. Önizleme hiçbir şey yazmaz; öğretmen düzenleyip
/// onaylayınca görevler öğrencinin çalışma programına eklenir, isterse veliye özet gider.
/// </summary>
public interface IOpticalStudyPlanService
{
    Task<OpticalStudyPlanPreviewDto> PreviewAsync(Guid examId, bool studyPlanEnabled, CancellationToken cancellationToken = default);
    Task<OpticalStudyPlanApplyResultDto> ApplyAsync(Guid examId, ApplyOpticalStudyPlansRequest request, Guid? userId, CancellationToken cancellationToken = default);
}
