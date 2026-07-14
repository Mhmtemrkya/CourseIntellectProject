using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Services;

/// <summary>Ders hakkı defterinin tek bir hareketi (hesaplama için sadeleştirilmiş görünüm).</summary>
public readonly record struct LedgerMovement(DrivingLedgerEntryType Type, int MinutesDelta);

/// <summary>
/// Bir kursiyerin ders hakkı özeti. Tüm dakika soruları bu kayıttan yanıtlanır.
///
/// <para><b>Rezervasyon fikri:</b> randevu oluşturulunca dakikalar hemen "planlanmış"
/// olarak bloke edilir. Böylece öğrenci elindeki hakkın iki katı kadar randevu alamaz.
/// Ders yapılınca rezervasyon serbest bırakılır ve gerçek kullanım işlenir.</para>
/// </summary>
public readonly record struct DrivingLessonBalanceSummary(
    int PurchasedMinutes,
    int ExtraPurchasedMinutes,
    int UsedMinutes,
    int PlannedMinutes,
    int PenaltyMinutes,
    int RefundedMinutes,
    int ManualAdjustmentMinutes)
{
    /// <summary>Öğrencinin sahip olduğu toplam hak (paket + ek satın alma + iade + düzeltme).</summary>
    public int TotalGrantedMinutes => PurchasedMinutes + ExtraPurchasedMinutes + RefundedMinutes + ManualAdjustmentMinutes;

    /// <summary>Harcanmış hak: gerçekleşen dersler + cezalar.</summary>
    public int ConsumedMinutes => UsedMinutes + PenaltyMinutes;

    /// <summary>Randevusu olmayan, hemen planlanabilir hak.</summary>
    public int AvailableMinutes => TotalGrantedMinutes - ConsumedMinutes - PlannedMinutes;

    /// <summary>Planlanmış dahil, kalan toplam hak.</summary>
    public int RemainingMinutes => TotalGrantedMinutes - ConsumedMinutes;
}

/// <summary>
/// Ders hakkı hesabının TEK merkezi. Controller'lar dakika toplamaz — buraya sorar.
/// Böylece "iptal edilince hak geri geliyor mu", "devamsızlıkta ne kadar yanıyor"
/// gibi sorular tek yerde ve testli olarak yanıtlanır.
/// </summary>
public static class DrivingLessonBalance
{
    public static DrivingLessonBalanceSummary Compute(IEnumerable<LedgerMovement> movements)
    {
        var purchased = 0;
        var extra = 0;
        var used = 0;
        var planned = 0;
        var penalty = 0;
        var refunded = 0;
        var manual = 0;

        foreach (var movement in movements)
        {
            switch (movement.Type)
            {
                case DrivingLedgerEntryType.PackageMinutes:
                    purchased += movement.MinutesDelta;
                    break;
                case DrivingLedgerEntryType.ExtraPurchasedMinutes:
                    extra += movement.MinutesDelta;
                    break;
                case DrivingLedgerEntryType.LessonUsage:
                    used += -movement.MinutesDelta;
                    break;
                // Rezervasyon: planlama düşer (negatif), serbest bırakma geri ekler (pozitif).
                case DrivingLedgerEntryType.PlannedMinutes:
                case DrivingLedgerEntryType.ReservationReleased:
                    planned += -movement.MinutesDelta;
                    break;
                case DrivingLedgerEntryType.NoShowDeductedMinutes:
                case DrivingLedgerEntryType.CancelledDeductedMinutes:
                    penalty += -movement.MinutesDelta;
                    break;
                case DrivingLedgerEntryType.RefundedMinutes:
                    refunded += movement.MinutesDelta;
                    break;
                case DrivingLedgerEntryType.ManualAdjustmentMinutes:
                    manual += movement.MinutesDelta;
                    break;
            }
        }

        return new DrivingLessonBalanceSummary(purchased, extra, used, planned, penalty, refunded, manual);
    }

    /// <summary>
    /// Geç iptal / devamsızlık cezası. Yüzde kurumun ayarından gelir; sonuç asla
    /// dersin süresini aşmaz ve negatif olmaz.
    /// </summary>
    public static int PenaltyMinutes(int lessonMinutes, int deductPercent)
    {
        if (lessonMinutes <= 0 || deductPercent <= 0) return 0;
        var clamped = Math.Clamp(deductPercent, 0, 100);
        return Math.Min(lessonMinutes, (int)Math.Round(lessonMinutes * (clamped / 100.0), MidpointRounding.AwayFromZero));
    }

    /// <summary>
    /// İptalin cezası var mı? Kurum ve öğretmen kaynaklı iptallerde öğrenci
    /// cezalandırılmaz; öğrenci iptalinde yalnızca "geç" ise ceza uygulanır.
    /// </summary>
    public static bool IsLateStudentCancellation(
        DateTime lessonStartsAtUtc,
        DateTime nowUtc,
        int lateCancellationHours)
        => lessonStartsAtUtc - nowUtc < TimeSpan.FromHours(Math.Max(0, lateCancellationHours));

    /// <summary>
    /// Defterin kendi içinde tutarlı olup olmadığını söyler: mevcut aktif randevuların
    /// toplam süresi, defterdeki açık rezervasyona eşit olmalıdır.
    /// </summary>
    public static bool ReservationMatches(DrivingLessonBalanceSummary balance, int activeAppointmentMinutes)
        => balance.PlannedMinutes == activeAppointmentMinutes;
}
