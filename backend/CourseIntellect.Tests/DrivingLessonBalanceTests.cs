using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

/// <summary>
/// Ders hakkı defterinin sözleşmesi. Buradaki her test bir para/hak kuralıdır:
/// planlanan dakika bloke olur, iptalde geri gelir, geç iptalde bir kısmı yanar,
/// devamsızlıkta hepsi yanar, kurum iptalinde öğrenci cezalandırılmaz.
/// </summary>
public sealed class DrivingLessonBalanceTests
{
    private static DrivingLessonBalanceSummary Compute(params LedgerMovement[] movements)
        => DrivingLessonBalance.Compute(movements);

    [Fact]
    public void PackageMinutes_StartTheBalance()
    {
        var balance = Compute(new LedgerMovement(DrivingLedgerEntryType.PackageMinutes, 840));

        Assert.Equal(840, balance.TotalGrantedMinutes);
        Assert.Equal(840, balance.RemainingMinutes);
        Assert.Equal(840, balance.AvailableMinutes);
        Assert.Equal(0, balance.PlannedMinutes);
    }

    [Fact]
    public void PlanningAnAppointment_ReservesMinutes_ButDoesNotConsumeThem()
    {
        var balance = Compute(
            new LedgerMovement(DrivingLedgerEntryType.PackageMinutes, 840),
            new LedgerMovement(DrivingLedgerEntryType.PlannedMinutes, -60));

        Assert.Equal(60, balance.PlannedMinutes);
        Assert.Equal(0, balance.UsedMinutes);
        // Hak hâlâ duruyor ama bağlı: yeni randevuya sadece 780 dk planlanabilir.
        Assert.Equal(840, balance.RemainingMinutes);
        Assert.Equal(780, balance.AvailableMinutes);
    }

    [Fact]
    public void OverBooking_IsImpossible_BecauseReservationsAccumulate()
    {
        // 120 dakikalık hakla üç ayrı 60 dakikalık randevu alınamaz.
        var balance = Compute(
            new LedgerMovement(DrivingLedgerEntryType.PackageMinutes, 120),
            new LedgerMovement(DrivingLedgerEntryType.PlannedMinutes, -60),
            new LedgerMovement(DrivingLedgerEntryType.PlannedMinutes, -60));

        Assert.Equal(120, balance.PlannedMinutes);
        Assert.Equal(0, balance.AvailableMinutes);
    }

    [Fact]
    public void CompletingALesson_ReleasesReservation_AndChargesActualTime()
    {
        // 60 dk planlandı, ders 45 dk sürdü: 15 dk öğrenciye geri kalır.
        var balance = Compute(
            new LedgerMovement(DrivingLedgerEntryType.PackageMinutes, 840),
            new LedgerMovement(DrivingLedgerEntryType.PlannedMinutes, -60),
            new LedgerMovement(DrivingLedgerEntryType.ReservationReleased, 60),
            new LedgerMovement(DrivingLedgerEntryType.LessonUsage, -45));

        Assert.Equal(0, balance.PlannedMinutes);
        Assert.Equal(45, balance.UsedMinutes);
        Assert.Equal(795, balance.RemainingMinutes);
        Assert.Equal(795, balance.AvailableMinutes);
    }

    [Fact]
    public void EarlyCancellation_ReturnsTheFullReservation()
    {
        var balance = Compute(
            new LedgerMovement(DrivingLedgerEntryType.PackageMinutes, 840),
            new LedgerMovement(DrivingLedgerEntryType.PlannedMinutes, -60),
            new LedgerMovement(DrivingLedgerEntryType.ReservationReleased, 60));

        Assert.Equal(0, balance.PlannedMinutes);
        Assert.Equal(0, balance.PenaltyMinutes);
        Assert.Equal(840, balance.AvailableMinutes);
    }

    [Fact]
    public void LateCancellation_ReturnsReservation_ButBurnsThePenalty()
    {
        var balance = Compute(
            new LedgerMovement(DrivingLedgerEntryType.PackageMinutes, 840),
            new LedgerMovement(DrivingLedgerEntryType.PlannedMinutes, -60),
            new LedgerMovement(DrivingLedgerEntryType.ReservationReleased, 60),
            new LedgerMovement(DrivingLedgerEntryType.CancelledDeductedMinutes, -30));

        Assert.Equal(0, balance.PlannedMinutes);
        Assert.Equal(30, balance.PenaltyMinutes);
        Assert.Equal(810, balance.RemainingMinutes);
    }

    [Fact]
    public void NoShow_BurnsTheWholeLesson()
    {
        var balance = Compute(
            new LedgerMovement(DrivingLedgerEntryType.PackageMinutes, 840),
            new LedgerMovement(DrivingLedgerEntryType.PlannedMinutes, -60),
            new LedgerMovement(DrivingLedgerEntryType.ReservationReleased, 60),
            new LedgerMovement(DrivingLedgerEntryType.NoShowDeductedMinutes, -60));

        Assert.Equal(60, balance.PenaltyMinutes);
        Assert.Equal(780, balance.RemainingMinutes);
        Assert.Equal(780, balance.AvailableMinutes);
    }

    [Fact]
    public void ExtraPurchaseAndRefund_IncreaseTheGrantedTotal()
    {
        var balance = Compute(
            new LedgerMovement(DrivingLedgerEntryType.PackageMinutes, 840),
            new LedgerMovement(DrivingLedgerEntryType.ExtraPurchasedMinutes, 120),
            new LedgerMovement(DrivingLedgerEntryType.RefundedMinutes, 60),
            new LedgerMovement(DrivingLedgerEntryType.ManualAdjustmentMinutes, -30));

        Assert.Equal(120, balance.ExtraPurchasedMinutes);
        Assert.Equal(990, balance.TotalGrantedMinutes);
        Assert.Equal(990, balance.AvailableMinutes);
    }

    [Theory]
    [InlineData(60, 100, 60)]
    [InlineData(60, 50, 30)]
    [InlineData(60, 0, 0)]
    [InlineData(90, 50, 45)]
    // Yüzde 100'ü aşamaz, ceza dersin süresini geçemez.
    [InlineData(60, 150, 60)]
    [InlineData(0, 100, 0)]
    public void Penalty_IsAPercentageOfTheLesson_AndNeverExceedsIt(int lessonMinutes, int percent, int expected)
        => Assert.Equal(expected, DrivingLessonBalance.PenaltyMinutes(lessonMinutes, percent));

    [Fact]
    public void StudentCancellation_IsLate_OnlyInsideTheConfiguredWindow()
    {
        var now = new DateTime(2026, 7, 14, 12, 0, 0, DateTimeKind.Utc);

        // 24 saatlik pencere: yarın 10:00'daki ders (22 saat sonra) geç iptaldir.
        Assert.True(DrivingLessonBalance.IsLateStudentCancellation(now.AddHours(22), now, 24));
        // 3 gün sonraki ders erken iptaldir.
        Assert.False(DrivingLessonBalance.IsLateStudentCancellation(now.AddDays(3), now, 24));
    }

    [Fact]
    public void Reconciliation_CatchesLedgerDriftAgainstRealAppointments()
    {
        var balance = Compute(
            new LedgerMovement(DrivingLedgerEntryType.PackageMinutes, 840),
            new LedgerMovement(DrivingLedgerEntryType.PlannedMinutes, -60));

        Assert.True(DrivingLessonBalance.ReservationMatches(balance, activeAppointmentMinutes: 60));
        // Defterde rezervasyon var ama ortada randevu yok → tutarsızlık.
        Assert.False(DrivingLessonBalance.ReservationMatches(balance, activeAppointmentMinutes: 0));
    }

    [Fact]
    public void CancelledAndNoShowAppointments_DoNotBlockTheCalendar()
    {
        Assert.Contains(DrivingAppointmentStatus.Planned, DrivingAppointmentStatuses.Blocking);
        Assert.Contains(DrivingAppointmentStatus.InProgress, DrivingAppointmentStatuses.Blocking);

        Assert.DoesNotContain(DrivingAppointmentStatus.CancelledByStudent, DrivingAppointmentStatuses.Blocking);
        Assert.DoesNotContain(DrivingAppointmentStatus.NoShow, DrivingAppointmentStatuses.Blocking);
        Assert.DoesNotContain(DrivingAppointmentStatus.Rescheduled, DrivingAppointmentStatuses.Blocking);
        Assert.DoesNotContain(DrivingAppointmentStatus.Draft, DrivingAppointmentStatuses.Blocking);
    }

    [Fact]
    public void StartedOrClosedAppointments_CannotBeCancelled()
    {
        Assert.True(DrivingAppointmentStatuses.CanCancel(DrivingAppointmentStatus.Planned));
        Assert.True(DrivingAppointmentStatuses.CanCancel(DrivingAppointmentStatus.Approved));
        Assert.True(DrivingAppointmentStatuses.CanCancel(DrivingAppointmentStatus.CheckedIn));

        // Ders başlamışsa iptal edilmez — tamamlanır veya devamsızlık yazılır.
        Assert.False(DrivingAppointmentStatuses.CanCancel(DrivingAppointmentStatus.InProgress));
        Assert.False(DrivingAppointmentStatuses.CanCancel(DrivingAppointmentStatus.Completed));
        Assert.False(DrivingAppointmentStatuses.CanCancel(DrivingAppointmentStatus.NoShow));
        Assert.False(DrivingAppointmentStatuses.CanCancel(DrivingAppointmentStatus.CancelledByStudent));
    }
}
