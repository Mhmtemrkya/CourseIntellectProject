using CourseIntellect.Application.DTOs.Attendance;
using CourseIntellect.Application.DTOs.Students;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

public sealed class AttendanceServiceTests : IDisposable
{
    private readonly TestDb db = new();
    private AttendanceService Service => new(db.Context, new NoopParentNotifier());

    private sealed class NoopParentNotifier : IParentNotifier
    {
        public Task NotifyStudentParentAsync(string studentName, string title, string message, string category, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

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

    [Fact]
    public async Task SaveLessonAttendance_SingleStudent_KeepsClassmatesEntries()
    {
        var date = new DateTime(2026, 6, 11);
        await Service.SaveLessonAttendanceAsync(new SaveAttendanceRequest(
            "10-A", "Biyoloji", date,
            [
                new SaveAttendanceStudentRequest("Ali Kaya", "present"),
                new SaveAttendanceStudentRequest("Ayşe Demir", "present"),
            ]));

        // Masaüstünden tek öğrenciye devamsızlık eklemek sınıfın kalanını silmemeli.
        await Service.SaveLessonAttendanceAsync(new SaveAttendanceRequest(
            "10-A", "Biyoloji", date,
            [new SaveAttendanceStudentRequest("Ali Kaya", "absent")]));

        var all = await Service.GetAttendanceAsync(null, "10-A");
        Assert.Equal(2, all.Count);
        Assert.Equal("Devamsiz", all.Single(x => x.StudentName == "Ali Kaya").Status);
        Assert.Equal("Katildi", all.Single(x => x.StudentName == "Ayşe Demir").Status);
    }

    [Fact]
    public async Task GetAttendance_ReturnsCanonicalStatusForLegacyRows()
    {
        db.Context.AttendanceEntries.AddRange(
            new AttendanceEntry { StudentName = "Ali Kaya", ClassName = "10-A", Lesson = "Tarih", LessonDate = new DateTime(2026, 6, 11), Status = "Geldi" },
            new AttendanceEntry { StudentName = "Ali Kaya", ClassName = "10-A", Lesson = "Coğrafya", LessonDate = new DateTime(2026, 6, 11), Status = "Gelmedi" });
        await db.Context.SaveChangesAsync();

        var all = await Service.GetAttendanceAsync("Ali Kaya", null);

        Assert.Equal("Katildi", all.Single(x => x.Lesson == "Tarih").Status);
        Assert.Equal("Devamsiz", all.Single(x => x.Lesson == "Coğrafya").Status);
    }

    [Fact]
    public async Task SaveLessonAttendance_MapsTurkishSpellings()
    {
        var saved = await Service.SaveLessonAttendanceAsync(new SaveAttendanceRequest(
            "10-A", "Edebiyat", new DateTime(2026, 6, 11),
            [new SaveAttendanceStudentRequest("Ali Kaya", "Geldi")]));

        Assert.Equal("Katildi", Assert.Single(saved).Status);
    }

    private async Task<(Guid First, Guid Second)> SeedTwinsAsync()
    {
        var first = new StudentProfile { UserId = Guid.NewGuid(), FullName = "Ali Kaya", ClassName = "10-A" };
        var second = new StudentProfile { UserId = Guid.NewGuid(), FullName = "Ali Kaya", ClassName = "10-A" };
        db.Context.Students.AddRange(first, second);
        await db.Context.SaveChangesAsync();
        return (first.Id, second.Id);
    }

    [Fact]
    public async Task SaveLessonAttendance_SameNamedStudents_AreKeptApartById()
    {
        var (first, second) = await SeedTwinsAsync();
        var date = new DateTime(2026, 6, 12);
        await Service.SaveLessonAttendanceAsync(new SaveAttendanceRequest(
            "10-A", "Fizik", date,
            [
                new SaveAttendanceStudentRequest("Ali Kaya", "present", first),
                new SaveAttendanceStudentRequest("Ali Kaya", "present", second),
            ]));

        // İkinci Ali'ye devamsızlık: birinci Ali'nin kaydı değişmemeli.
        await Service.SaveLessonAttendanceAsync(new SaveAttendanceRequest(
            "10-A", "Fizik", date,
            [new SaveAttendanceStudentRequest("Ali Kaya", "absent", second)]));

        var firstRows = await Service.GetAttendanceAsync(studentId: first);
        var secondRows = await Service.GetAttendanceAsync(studentId: second);
        Assert.Equal("Katildi", Assert.Single(firstRows).Status);
        Assert.Equal("Devamsiz", Assert.Single(secondRows).Status);
        Assert.Equal(2, (await Service.GetAttendanceAsync(null, "10-A")).Count);
    }

    [Fact]
    public async Task SaveLessonAttendance_LinksUniqueNames_AndLeavesAmbiguousUnlinked()
    {
        await SeedTwinsAsync();
        var ayse = new StudentProfile { UserId = Guid.NewGuid(), FullName = "Ayşe Demir", ClassName = "10-A" };
        db.Context.Students.Add(ayse);
        await db.Context.SaveChangesAsync();

        var saved = await Service.SaveLessonAttendanceAsync(new SaveAttendanceRequest(
            "10-A", "Kimya", new DateTime(2026, 6, 12),
            [
                new SaveAttendanceStudentRequest("Ayşe Demir", "present"),
                new SaveAttendanceStudentRequest("Ali Kaya", "present"),
            ]));

        Assert.Equal(ayse.Id, saved.Single(x => x.StudentName.StartsWith("Ayşe")).StudentId);
        Assert.Null(saved.Single(x => x.StudentName.StartsWith("Ali")).StudentId);
    }

    [Fact]
    public async Task GetAttendance_Scope_HidesSameNamedOtherFamilyChild()
    {
        var (first, second) = await SeedTwinsAsync();
        var date = new DateTime(2026, 6, 12);
        await Service.SaveLessonAttendanceAsync(new SaveAttendanceRequest(
            "10-A", "Tarih", date,
            [
                new SaveAttendanceStudentRequest("Ali Kaya", "present", first),
                new SaveAttendanceStudentRequest("Ali Kaya", "absent", second),
            ]));

        var visible = await Service.GetAttendanceAsync(scope: new StudentRecordScope([first], ["Ali Kaya"]));

        var row = Assert.Single(visible);
        Assert.Equal(first, row.StudentId);
        Assert.Equal("Katildi", row.Status);
    }

    public void Dispose() => db.Dispose();
}
