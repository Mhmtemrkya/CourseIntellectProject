namespace CourseIntellect.Application.DTOs.QuestionBank;

/// <summary>
/// Öğrencinin soru bankası çözüm kırılımı: toplam soru, çözülen, doğru, yanlış,
/// boş ve net. Soru başına en son deneme dikkate alınır.
/// </summary>
public sealed record QuestionPracticeStatsDto(
    int Total,
    int Solved,
    int Correct,
    int Wrong,
    int Blank,
    double Net
);
