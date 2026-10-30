namespace CourseIntellect.Domain.Services;

/// <summary>
/// Vade/gecikme kararının tek kaynağı. Taksit vadeleri gün olarak tutulur
/// (vade günü 00:00 UTC). Taksit, vade GÜNÜ boyunca gecikmiş sayılmaz; kurumun
/// yerel takviminde ertesi gün başladığında gecikmeye düşer. Eskiden
/// <c>DueDateUtc &lt; UtcNow</c> kullanıldığı için öğrenci listesi taksiti vade
/// günü sabah 03:00'te "Gecikmiş" gösteriyor, ana pano ise ertesi gün sayıyordu.
/// </summary>
public static class FinanceDates
{
    // Türkiye 2016'dan beri yaz saati uygulamadan sabit UTC+3'tedir.
    private static readonly TimeSpan InstitutionOffset = TimeSpan.FromHours(3);

    /// <summary>Kurumun yerel "bugün"ü, vade tarihleriyle karşılaştırılabilir biçimde (00:00 UTC).</summary>
    public static DateTime TodayUtcDate(DateTime nowUtc) =>
        DateTime.SpecifyKind((nowUtc + InstitutionOffset).Date, DateTimeKind.Utc);

    /// <summary>Vadesi bugünden önceki bir güne düşen taksit gecikmiştir.</summary>
    public static bool IsOverdue(DateTime dueDateUtc, DateTime nowUtc) =>
        dueDateUtc < TodayUtcDate(nowUtc);
}
