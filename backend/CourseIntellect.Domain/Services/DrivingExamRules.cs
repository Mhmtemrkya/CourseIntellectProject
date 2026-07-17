using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Services;

public static class DrivingExamRules
{
    /// <summary>
    /// MTSK mevzuatı: aday her sınav türüne (e-sınav ve direksiyon) en fazla
    /// DÖRT kez girebilir. Dördüncü başarısızlıkta dönemi düşer — kursa yeniden
    /// kayıt olmadan sınava eklenemez.
    /// </summary>
    public const int MaxAttempts = 4;

    /// <summary>İptal edilen deneme hak yakmaz; diğer tüm sonuçlar (planlı dahil) hak tüketir.</summary>
    public static bool ConsumesAttempt(DrivingExamCandidateStatus status)
        => status != DrivingExamCandidateStatus.Cancelled;

    public static int RemainingAttempts(int usedAttempts)
        => Math.Max(0, MaxAttempts - Math.Max(0, usedAttempts));

    public static bool IsOutOfAttempts(int usedAttempts) => RemainingAttempts(usedAttempts) == 0;

    /// <summary>Hak bittiğinde personele gösterilen standart mesaj.</summary>
    public static string OutOfAttemptsMessage(DrivingExamType examType)
        => $"{ExamTypeLabel(examType)} için {MaxAttempts} sınav hakkı doldu — aday dönemi düştü, yeniden kayıt gerekir.";

    public static string ExamTypeLabel(DrivingExamType examType)
        => examType == DrivingExamType.TheoryEExam ? "E-sınav" : "Direksiyon sınavı";

    /// <summary>e-Sınav geçme notu (MEB): 100 üzerinden 70.</summary>
    public const decimal TheoryPassScore = 70;

    /// <summary>
    /// Toplu içe aktarılan satırdan sonucu çıkarır. Açık "geçti/kaldı" metni her
    /// zaman öncelikli; yoksa e-sınavda puan 70 barajına vurulur. Sonuç
    /// çıkarılamazsa null döner (satır reddedilir, sessizce geçilmez).
    /// </summary>
    public static bool? ParseImportedResult(string? resultText, decimal? score, DrivingExamType examType)
    {
        // 'İ' invariant küçültmede bozulur; Türkçe büyük harfler ÖNCE indirgenir.
        var normalized = (resultText ?? string.Empty).Trim()
            .Replace('İ', 'i').Replace('I', 'i').Replace('Ç', 'c').Replace('Ş', 's').Replace('Ğ', 'g').Replace('Ü', 'u').Replace('Ö', 'o')
            .ToLowerInvariant()
            .Replace('ı', 'i').Replace('ç', 'c').Replace('ş', 's').Replace('ğ', 'g').Replace('ü', 'u').Replace('ö', 'o');

        if (normalized is "gecti" or "gecer" or "basarili" or "passed" or "pass" or "p" or "1" or "true" or "evet") return true;
        if (normalized is "kaldi" or "basarisiz" or "failed" or "fail" or "f" or "0" or "false" or "hayir") return false;

        if (score is { } value && examType == DrivingExamType.TheoryEExam) return value >= TheoryPassScore;
        return null;
    }

    public static DrivingStudentStatus StudentStatusAfterResult(DrivingExamType examType, bool passed)
    {
        if (!passed) return DrivingStudentStatus.ExamPending;

        return examType == DrivingExamType.TheoryEExam
            ? DrivingStudentStatus.PracticeOngoing
            : DrivingStudentStatus.GraduationPending;
    }

    public static bool CanScheduleRetry(DrivingExamCandidateStatus status)
        => status == DrivingExamCandidateStatus.Failed;
}
