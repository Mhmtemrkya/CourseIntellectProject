using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Services;

public static class DrivingMebbisRules
{
    private static readonly IReadOnlyDictionary<DrivingMebbisWorkStatus, DrivingMebbisWorkStatus[]> Transitions =
        new Dictionary<DrivingMebbisWorkStatus, DrivingMebbisWorkStatus[]>
        {
            [DrivingMebbisWorkStatus.Preparing] = [DrivingMebbisWorkStatus.Ready, DrivingMebbisWorkStatus.Error],
            [DrivingMebbisWorkStatus.Ready] = [DrivingMebbisWorkStatus.EntryPending, DrivingMebbisWorkStatus.Error],
            [DrivingMebbisWorkStatus.EntryPending] = [DrivingMebbisWorkStatus.Entered, DrivingMebbisWorkStatus.Error],
            [DrivingMebbisWorkStatus.Entered] = [DrivingMebbisWorkStatus.Verified, DrivingMebbisWorkStatus.Error],
            [DrivingMebbisWorkStatus.Verified] = [DrivingMebbisWorkStatus.Error],
            [DrivingMebbisWorkStatus.Error] = [DrivingMebbisWorkStatus.CorrectionPending],
            [DrivingMebbisWorkStatus.CorrectionPending] = [DrivingMebbisWorkStatus.Ready, DrivingMebbisWorkStatus.Error],
        };

    public static bool CanTransition(DrivingMebbisWorkStatus current, DrivingMebbisWorkStatus target)
        => Transitions.TryGetValue(current, out var allowed) && allowed.Contains(target);

    public static bool RequiresReason(DrivingMebbisWorkStatus target)
        => target is DrivingMebbisWorkStatus.Error or DrivingMebbisWorkStatus.CorrectionPending;
}
