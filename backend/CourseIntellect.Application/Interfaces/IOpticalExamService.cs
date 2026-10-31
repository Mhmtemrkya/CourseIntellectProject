using CourseIntellect.Application.DTOs.OpticalExams;

namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Optik okuyucu dosyasından deneme sonucu aktarımı. Akış: şablon (kolon düzeni) → deneme
/// (cevap anahtarı + soru-konu eşlemesi) → dosya önizleme (öğrenci eşleştirme, puan) → onayla
/// içe aktar. Önizleme hiçbir şey yazmaz; aynı deneme yeniden aktarılırsa eski sonuçların yerine geçer.
/// Ders netleri mevcut sınav sonuçlarına (ExamResult) da yazılır; soru-konu cevapları konu analizine girer.
/// </summary>
public interface IOpticalExamService
{
    Task<IReadOnlyList<OpticalTemplateDto>> ListTemplatesAsync(CancellationToken cancellationToken = default);
    Task<OpticalTemplateDto> SaveTemplateAsync(Guid? id, SaveOpticalTemplateRequest request, CancellationToken cancellationToken = default);
    Task DeleteTemplateAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<OpticalExamSummaryDto>> ListExamsAsync(CancellationToken cancellationToken = default);
    Task<OpticalExamDto?> GetExamAsync(Guid id, CancellationToken cancellationToken = default);
    Task<OpticalExamDto> SaveExamAsync(Guid? id, SaveOpticalExamRequest request, CancellationToken cancellationToken = default);
    Task DeleteExamAsync(Guid id, CancellationToken cancellationToken = default);

    Task<OpticalPreviewDto> PreviewAsync(Guid examId, byte[] file, string? encoding, CancellationToken cancellationToken = default);
    Task<OpticalImportResultDto> ImportAsync(Guid examId, byte[] file, string? encoding, string fileName,
        IReadOnlyList<OpticalMatchOverrideDto> overrides, Guid? importedByUserId, CancellationToken cancellationToken = default);
    Task<OpticalExamResultsDto?> GetResultsAsync(Guid examId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<OpticalStudentCandidateDto>> SearchStudentsAsync(string? search, CancellationToken cancellationToken = default);
}
