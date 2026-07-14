using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;

namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Ders hakkı defterine yazan tek kapı. Hiçbir controller doğrudan ledger satırı
/// eklemez veya <c>UsedDrivingMinutes</c> alanını elle oynamaz — hepsi buradan geçer,
/// böylece bakiye her zaman defterle tutarlı kalır.
/// </summary>
public interface IDrivingLedgerService
{
    Task<DrivingLessonBalanceSummary> GetBalanceAsync(Guid studentDrivingProfileId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Hareket ekler. Çağıran zaten bir transaction açtıysa ona katılır; SaveChanges
    /// çağırmaz — kaydı çağıran tamamlar (atomik kalması için).
    /// </summary>
    Task AddAsync(
        Guid studentDrivingProfileId,
        DrivingLedgerEntryType type,
        int minutesDelta,
        string description,
        Guid? appointmentId = null,
        Guid? drivingLessonId = null,
        string? reason = null,
        CancellationToken cancellationToken = default);

    /// <summary>Profildeki önbellek alanlarını (Used/Purchased) defterle eşitler.</summary>
    Task SyncProfileCacheAsync(Guid studentDrivingProfileId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Mutabakat: defterdeki açık rezervasyon, gerçekten aktif randevuların
    /// toplamıyla uyuşuyor mu? Uyuşmuyorsa fark döner.
    /// </summary>
    Task<LedgerReconciliation> ReconcileAsync(Guid studentDrivingProfileId, CancellationToken cancellationToken = default);
}

public sealed record LedgerReconciliation(
    Guid StudentDrivingProfileId,
    int LedgerPlannedMinutes,
    int ActiveAppointmentMinutes,
    bool IsBalanced)
{
    public int DifferenceMinutes => LedgerPlannedMinutes - ActiveAppointmentMinutes;
}
