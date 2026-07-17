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
