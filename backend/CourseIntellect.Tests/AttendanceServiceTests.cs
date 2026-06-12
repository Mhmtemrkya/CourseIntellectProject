using CourseIntellect.Application.DTOs.Attendance;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

public sealed class AttendanceServiceTests : IDisposable
{
    private readonly TestDb db = new();
    private AttendanceService Service => new(db.Context);

    [Fact]
    public async Task SaveLessonAttendance_MapsUiStatusesToTurkishLabels()
    {
        var saved = await Service.SaveLessonAttendanceAsync(new SaveAttendanceRequest(
            "10-A",
            "Matematik",
            new DateTime(2026, 6, 11),
            [
                new SaveAttendanceStudentRequest("Ali Kaya", "present"),
                new SaveAttendanceStudentRequest("Ayşe Demir", "late"),
                new SaveAttendanceStudentRequest("Can Yıldız", "excuse"),
            ]));

        Assert.Equal("Katildi", saved.Single(x => x.StudentName == "Ali Kaya").Status);
        Assert.Equal("Gec", saved.Single(x => x.StudentName == "Ayşe Demir").Status);
        Assert.Equal("Izinli", saved.Single(x => x.StudentName == "Can Yıldız").Status);
    }

    [Fact]
    public async Task SaveLessonAttendance_ReplacesSameDaySameLessonEntries()
    {
        var date = new DateTime(2026, 6, 11);
        await Service.SaveLessonAttendanceAsync(new SaveAttendanceRequest(
            "10-A", "Fizik", date,
            [new SaveAttendanceStudentRequest("Ali Kaya", "present")]));

        // Aynı gün aynı ders ikinci kez kaydedilirse eski kayıtların yerine geçer.
        await Service.SaveLessonAttendanceAsync(new SaveAttendanceRequest(
            "10-A", "Fizik", date,
            [new SaveAttendanceStudentRequest("Ali Kaya", "absent")]));

        var all = await Service.GetAttendanceAsync("Ali Kaya", "10-A");
        var entry = Assert.Single(all);
        Assert.NotEqual("Katildi", entry.Status);
    }

    [Fact]
    public async Task GetAttendance_FiltersByStudentAndClass()
    {
        var date = new DateTime(2026, 6, 11);
        await Service.SaveLessonAttendanceAsync(new SaveAttendanceRequest(
            "10-A", "Kimya", date,
            [
                new SaveAttendanceStudentRequest("Ali Kaya", "present"),
                new SaveAttendanceStudentRequest("Ayşe Demir", "present"),
            ]));

        var onlyAli = await Service.GetAttendanceAsync("Ali Kaya", null);
        Assert.All(onlyAli, item => Assert.Equal("Ali Kaya", item.StudentName));

        var wrongClass = await Service.GetAttendanceAsync(null, "11-B");
        Assert.Empty(wrongClass);
    }

    public void Dispose() => db.Dispose();
}
