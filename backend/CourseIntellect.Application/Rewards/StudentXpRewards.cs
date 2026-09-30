namespace CourseIntellect.Application.Rewards;

/// <summary>
/// Öğrenci XP'si YALNIZ sunucuda, doğrulanmış olaylardan hesaplanır: soru bankası
/// denemesi (sunucu puanlar) ve ödev teslimi. İstemcinin gönderdiği XP miktarı
/// kabul edilmez (öğrenci kendi XP'sini ayarlayabiliyordu). Formüller önceki
/// istemci formülleriyle aynıdır; yalnız hesaplama yeri değişti.
/// </summary>
public static class StudentXpRewards
{
    /// <summary>Soruya İLK denemede verilir; tekrar denemeler XP getirmez.</summary>
    public static int QuestionSolve(bool isCorrect, bool hasImage, bool hasSolutionAsset)
    {
        var amount = isCorrect ? 18 : 6;
        if (hasImage) amount += 4;
        if (hasSolutionAsset) amount += 3;
        return amount;
    }

    /// <summary>Ödevin İLK tesliminde verilir; yeniden teslim XP getirmez.</summary>
    public static int HomeworkSubmission(int fileCount, bool hasNote)
    {
        var amount = 25;
        if (fileCount > 1) amount += Math.Clamp((fileCount - 1) * 5, 0, 15);
        if (hasNote) amount += 5;
        return amount;
    }
}
