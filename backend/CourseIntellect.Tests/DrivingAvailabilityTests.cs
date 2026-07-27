using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

/// <summary>
/// Randevu uygunluk kurallarının sözleşmesi: izinli öğretmene randevu verilmez,
/// çalışma saati dışına taşılmaz, atanmamış araç kullanılmaz, günlük limitler ve
/// hazırlık payı korunur.
///
/// Saatler YEREL (UTC+3) yorumlanır; testler bu yüzden UTC girdiyi bilerek kaydırır.
/// </summary>
public sealed class DrivingAvailabilityTests
{
    private static readonly Guid VehicleA = Guid.NewGuid();
    private static readonly Guid VehicleB = Guid.NewGuid();

    /// <summary>Yerel saati UTC'ye çevirir — testler "yerel 10:00" gibi düşünsün diye.</summary>
    private static DateTime LocalTime(int year, int month, int day, int hour, int minute = 0)
        => new DateTime(year, month, day, hour, minute, 0, DateTimeKind.Utc)
            .AddHours(-DrivingAvailability.LocalUtcOffsetHours);

    // 14 Temmuz 2026 = Salı
    private static readonly DateTime TuesdayTenLocal = LocalTime(2026, 7, 14, 10);
    private static readonly DateTime TuesdayElevenLocal = LocalTime(2026, 7, 14, 11);

    [Fact]
    public void InstructorOnLeave_BlocksTheAppointment()
    {
        var leaves = new[]
        {
            new LeaveWindow(LocalTime(2026, 7, 13, 0), LocalTime(2026, 7, 20, 0)),
        };

        Assert.True(DrivingAvailability.IsOnLeave(leaves, TuesdayTenLocal, TuesdayElevenLocal));
        // İzin bittikten sonraki randevu serbest.
        Assert.False(DrivingAvailability.IsOnLeave(leaves, LocalTime(2026, 7, 21, 10), LocalTime(2026, 7, 21, 11)));
    }

    [Fact]
    public void NoWorkingHoursDefined_MeansNoRestriction()
    {
        // Kurum henüz çalışma saati girmediyse randevuyu engellemeyiz.
        Assert.True(DrivingAvailability.IsWithinWorkingHours([], TuesdayTenLocal, TuesdayElevenLocal));
    }

    [Fact]
    public void AppointmentMustFitEntirelyInsideAWorkingWindow()
    {
        // Salı 09:00-12:00 çalışıyor (yerel dakika: 540-720).
        var hours = new[] { new WorkingWindow(DayOfWeek.Tuesday, 540, 720) };

        Assert.True(DrivingAvailability.IsWithinWorkingHours(hours, TuesdayTenLocal, TuesdayElevenLocal));

        // 11:30-12:30 penceresinin dışına taşıyor.
        Assert.False(DrivingAvailability.IsWithinWorkingHours(hours, LocalTime(2026, 7, 14, 11, 30), LocalTime(2026, 7, 14, 12, 30)));
        // Pencereden önce başlıyor.
        Assert.False(DrivingAvailability.IsWithinWorkingHours(hours, LocalTime(2026, 7, 14, 8), LocalTime(2026, 7, 14, 9, 30)));
    }

    [Fact]
    public void InstructorDoesNotWorkThatDay_BlocksTheAppointment()
    {
        // Yalnızca pazartesi çalışıyor; salı randevusu olmaz.
        var hours = new[] { new WorkingWindow(DayOfWeek.Monday, 540, 1080) };

        Assert.False(DrivingAvailability.IsWithinWorkingHours(hours, TuesdayTenLocal, TuesdayElevenLocal));
    }

    [Fact]
    public void NoAssignmentsDefined_MeansAnyVehicleIsAllowed()
        => Assert.True(DrivingAvailability.IsVehicleAssigned([], VehicleA, TuesdayTenLocal));

    [Fact]
    public void OnceAssignmentsExist_OnlyAssignedVehiclesAreAllowed()
    {
        var assignments = new[]
        {
            new AssignmentWindow(VehicleA, VehicleAssignmentType.Primary, null, null, 0, 1, true),
        };

        Assert.True(DrivingAvailability.IsVehicleAssigned(assignments, VehicleA, TuesdayTenLocal));
        // B aracı bu öğretmene atanmamış → randevuya çıkamaz.
        Assert.False(DrivingAvailability.IsVehicleAssigned(assignments, VehicleB, TuesdayTenLocal));
    }

    [Fact]
    public void InactiveAssignment_DoesNotGrantAccess()
    {
        var assignments = new[]
        {
            new AssignmentWindow(VehicleA, VehicleAssignmentType.Primary, null, null, 0, 1, IsActive: false),
        };

        Assert.False(DrivingAvailability.IsVehicleAssigned(assignments, VehicleA, TuesdayTenLocal));
    }

    [Fact]
    public void TemporaryAssignment_OnlyAppliesInsideItsDateRange()
    {
        var assignments = new[]
        {
            new AssignmentWindow(
                VehicleA,
                VehicleAssignmentType.Temporary,
                LocalTime(2026, 7, 13, 0),
                LocalTime(2026, 7, 15, 0),
                0, 1, true),
        };

        Assert.True(DrivingAvailability.IsVehicleAssigned(assignments, VehicleA, TuesdayTenLocal));
        // Aralık bitmiş.
        Assert.False(DrivingAvailability.IsVehicleAssigned(assignments, VehicleA, LocalTime(2026, 7, 20, 10)));
    }

    [Fact]
    public void SpecificDaysAssignment_OnlyAppliesOnTheSelectedDays()
    {
        // Yalnızca pazartesi (1 << 1 = 2) geçerli.
        var mondayOnly = new[]
        {
            new AssignmentWindow(VehicleA, VehicleAssignmentType.SpecificDays, null, null, 1 << (int)DayOfWeek.Monday, 1, true),
        };

        Assert.False(DrivingAvailability.IsVehicleAssigned(mondayOnly, VehicleA, TuesdayTenLocal));
        Assert.True(DrivingAvailability.IsVehicleAssigned(mondayOnly, VehicleA, LocalTime(2026, 7, 13, 10)));
    }

    [Fact]
    public void DailyMinuteLimit_CountsExistingLessons()
    {
        var existing = new[]
        {
            new BookedSlot(LocalTime(2026, 7, 14, 8), LocalTime(2026, 7, 14, 11)),   // 180 dk
            new BookedSlot(LocalTime(2026, 7, 14, 13), LocalTime(2026, 7, 14, 16)),  // 180 dk
        };

        // 360 + 60 = 420 ≤ 480 → geçer.
        Assert.False(DrivingAvailability.ExceedsDailyMinutes(existing, 60, 480));
        // 360 + 180 = 540 > 480 → limit aşılır.
        Assert.True(DrivingAvailability.ExceedsDailyMinutes(existing, 180, 480));
        // Limit 0 = sınırsız.
        Assert.False(DrivingAvailability.ExceedsDailyMinutes(existing, 600, 0));
    }

    [Fact]
    public void StudentDailyLessonLimit_IsEnforced()
    {
        Assert.False(DrivingAvailability.ExceedsDailyLessonCount(1, 2));
        Assert.True(DrivingAvailability.ExceedsDailyLessonCount(2, 2));
        Assert.False(DrivingAvailability.ExceedsDailyLessonCount(9, 0)); // sınırsız
    }

    [Fact]
    public void PreparationGap_IsRequiredBetweenBackToBackLessons()
    {
        var existing = new[] { new BookedSlot(LocalTime(2026, 7, 14, 9), LocalTime(2026, 7, 14, 10)) };

        // Hemen ardından başlayan ders: 15 dk hazırlık payı yok → reddedilir.
        Assert.False(DrivingAvailability.HasEnoughPreparationGap(existing, LocalTime(2026, 7, 14, 10), LocalTime(2026, 7, 14, 11), 15));
        // 15 dk sonra başlıyor → tam yeterli.
        Assert.True(DrivingAvailability.HasEnoughPreparationGap(existing, LocalTime(2026, 7, 14, 10, 15), LocalTime(2026, 7, 14, 11), 15));
        // Öncesine yerleşen ders de aynı payı bırakmalı.
        Assert.False(DrivingAvailability.HasEnoughPreparationGap(existing, LocalTime(2026, 7, 14, 8, 10), LocalTime(2026, 7, 14, 8, 55), 15));
        Assert.True(DrivingAvailability.HasEnoughPreparationGap(existing, LocalTime(2026, 7, 14, 7, 30), LocalTime(2026, 7, 14, 8, 30), 15));
        // Hazırlık süresi kapalıysa kısıt yok.
        Assert.True(DrivingAvailability.HasEnoughPreparationGap(existing, LocalTime(2026, 7, 14, 10), LocalTime(2026, 7, 14, 11), 0));
    }

    [Fact]
    public void FinancialHold_OnlyBlocksWhenEnabledAndOverThreshold()
    {
        Assert.True(DrivingAvailability.IsFinanciallyBlocked(holdEnabled: true, overdueAmount: 1500, threshold: 1000));
        Assert.False(DrivingAvailability.IsFinanciallyBlocked(holdEnabled: true, overdueAmount: 500, threshold: 1000));
        // Ayar kapalıysa borç randevuyu engellemez.
        Assert.False(DrivingAvailability.IsFinanciallyBlocked(holdEnabled: false, overdueAmount: 99999, threshold: 1000));
    }

    [Fact]
    public void AppointmentCrossingMidnight_NeverFitsADailyWindow()
    {
        var hours = new[] { new WorkingWindow(DayOfWeek.Tuesday, 0, 1440) };

        Assert.False(DrivingAvailability.IsWithinWorkingHours(
            hours,
            LocalTime(2026, 7, 14, 23, 30),
            LocalTime(2026, 7, 15, 0, 30)));
    }

    // ─── Gece dersi yasağı (mevzuat saat penceresi) ──────────────────────────

    [Fact]
    public void AllowedHours_LessonInsideWindow_Passes()
        => Assert.True(DrivingAvailability.IsWithinAllowedHours(
            LocalTime(2026, 7, 14, 10), LocalTime(2026, 7, 14, 11, 30), 7, 19));

    [Fact]
    public void AllowedHours_LessonEndingExactlyAtLimit_Passes()
        => Assert.True(DrivingAvailability.IsWithinAllowedHours(
            LocalTime(2026, 7, 14, 18), LocalTime(2026, 7, 14, 19), 7, 19));

    [Fact]
    public void AllowedHours_EveningLesson_IsBlocked()
        => Assert.False(DrivingAvailability.IsWithinAllowedHours(
            LocalTime(2026, 7, 14, 19), LocalTime(2026, 7, 14, 20), 7, 19));

    [Fact]
    public void AllowedHours_EarlyMorningLesson_IsBlocked()
        => Assert.False(DrivingAvailability.IsWithinAllowedHours(
            LocalTime(2026, 7, 14, 6), LocalTime(2026, 7, 14, 7), 7, 19));

    [Fact]
    public void AllowedHours_DisabledWindow_MeansNoRestriction()
    {
        // Earliest >= Latest: kurum saat kısıtını bilerek kapatmıştır.
        Assert.True(DrivingAvailability.IsWithinAllowedHours(
            LocalTime(2026, 7, 14, 23), LocalTime(2026, 7, 14, 23, 45), 0, 0));
    }

    [Fact]
    public void AllowedHours_LessonCrossingMidnight_IsBlocked()
        => Assert.False(DrivingAvailability.IsWithinAllowedHours(
            LocalTime(2026, 7, 14, 23, 30), LocalTime(2026, 7, 15, 0, 30), 0, 24));

    // ─── MEB çalışma izni ────────────────────────────────────────────────────

    [Fact]
    public void WorkingPermit_NoDateEntered_MeansNoRestriction()
        => Assert.True(DrivingAvailability.IsWorkingPermitValid(null, LocalTime(2026, 7, 14, 10)));

    [Fact]
    public void WorkingPermitConfiguration_CompletelyUntracked_IsReady()
        => Assert.True(DrivingAvailability.IsWorkingPermitConfigurationReady(
            null, null, LocalTime(2026, 7, 14, 10)));

    [Theory]
    [InlineData("MEB-123", false)]
    [InlineData("", true)]
    public void WorkingPermitConfiguration_PartialData_IsNotReady(string permitNo, bool hasExpiry)
        => Assert.False(DrivingAvailability.IsWorkingPermitConfigurationReady(
            permitNo,
            hasExpiry ? LocalTime(2027, 7, 14, 10) : null,
            LocalTime(2026, 7, 14, 10)));

    [Fact]
    public void WorkingPermitConfiguration_CompleteFutureData_IsReady()
        => Assert.True(DrivingAvailability.IsWorkingPermitConfigurationReady(
            "MEB-123",
            LocalTime(2027, 7, 14, 10),
            LocalTime(2026, 7, 14, 10)));

    [Fact]
    public void WorkingPermit_ValidUntilAfterLesson_Passes()
        => Assert.True(DrivingAvailability.IsWorkingPermitValid(
            LocalTime(2026, 12, 31, 0), LocalTime(2026, 7, 14, 10)));

    [Fact]
    public void WorkingPermit_ExpiredBeforeLesson_Fails()
        => Assert.False(DrivingAvailability.IsWorkingPermitValid(
            LocalTime(2026, 7, 1, 0), LocalTime(2026, 7, 14, 10)));

    // ─── MTSK araç yaş sınırı ────────────────────────────────────────────────

    [Fact]
    public void VehicleAge_LimitDisabled_NeverBlocks()
        => Assert.False(DrivingAvailability.ExceedsVehicleAge(2005, 0, LocalTime(2026, 7, 14, 10)));

    [Fact]
    public void VehicleAge_UnknownModelYear_NeverBlocks()
        => Assert.False(DrivingAvailability.ExceedsVehicleAge(0, 10, LocalTime(2026, 7, 14, 10)));

    [Fact]
    public void VehicleAge_WithinLimit_Passes()
    {
        // 2026'da 2016 model = 10 yaş; sınır 10 → tam sınırda, aşmıyor.
        Assert.False(DrivingAvailability.ExceedsVehicleAge(2016, 10, LocalTime(2026, 7, 14, 10)));
    }

    [Fact]
    public void VehicleAge_OverLimit_Blocks()
        => Assert.True(DrivingAvailability.ExceedsVehicleAge(2015, 10, LocalTime(2026, 7, 14, 10)));
}
