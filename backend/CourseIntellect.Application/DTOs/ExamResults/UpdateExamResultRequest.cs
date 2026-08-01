namespace CourseIntellect.Application.DTOs.ExamResults;

/// <summary>
/// Var olan bir sınav sonucunun düzenlenmesi. Öğrenci adı değiştirilmez —
/// sonuç bir kişiye aittir; başka öğrenciye taşınmak istenirse kayıt silinip
/// yenisi açılır (sıralama ve veli bildirimi geçmişi bozulmasın).
/// </summary>
public sealed record UpdateExamResultRequest(
    string ExamTitle,
    string Type,
    string Subject,
    string DateLabel,
    string ClassName,
    int Score,
    decimal Net,
    int? CorrectCount = null,
    int? WrongCount = null,
    int? TotalQuestions = null
);
