namespace CourseIntellect.Application.Interfaces;

/// <summary>Dönem kontenjanı, kesim tarihi ve MEBBİS mutabakatını tek kaynaktan hesaplar.</summary>
public interface IDrivingTermAlertService
{
    Task<DrivingTermAlertSnapshot> GetAsync(CancellationToken cancellationToken = default);
}

public sealed record DrivingTermAlertSnapshot(
    DateTime GeneratedAtUtc,
    int ActiveTermCount,
    int CriticalCount,
    int WarningCount,
    int MissingMebbisCount,
    int HealthReportPendingCount,
    int ReadyNotEnteredCount,
    int ReconciliationMismatchCount,
    IReadOnlyList<DrivingTermAlertItem> Alerts,
    IReadOnlyList<DrivingTermAlertGroup> Terms);

public sealed record DrivingTermAlertItem(
    string Code,
    string Severity,
    string Title,
    string Message,
    int Count,
    Guid? GroupId,
    string ActionPath);

public sealed record DrivingTermAlertGroup(
    Guid GroupId,
    string Name,
    int? TermYear,
    int? TermNumber,
    string MebbisTermCode,
    int Quota,
    int StudentCount,
    int RemainingCapacity,
    bool CapacityExceeded,
    DateTime? RegistrationDeadlineUtc,
    int? DaysToDeadline,
    int MissingMebbisCount,
    int HealthReportPendingCount,
    int ReadyNotEnteredCount,
    int ReconciliationMismatchCount);
