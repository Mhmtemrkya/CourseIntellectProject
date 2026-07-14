using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace CourseIntellect.Tests;

/// <summary>
/// Bildirim sözleşmesi: aynı olay iki kez bildirilmez, bildirim doğru kişiye gider
/// ve gönderim hatası asıl işlemi patlatmaz.
/// </summary>
public sealed class DrivingNotifierTests : IDisposable
{
    private readonly TestDb db = new();
    private readonly RecordingPushService push = new();

    private DrivingNotifier Notifier => new(db.Context, push, NullLogger<DrivingNotifier>.Instance);

    /// <summary>Gönderilen push'ları sayan test yerine geçeni.</summary>
    private sealed class RecordingPushService : IPushNotificationService
    {
        public List<(Guid UserId, string Title)> Sent { get; } = [];
        public List<string> SentToRoles { get; } = [];
        public bool ShouldThrow { get; set; }

        public bool IsConfigured => true;

        public Task SendToUserAsync(Guid userId, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default)
        {
            if (ShouldThrow) throw new InvalidOperationException("FCM erişilemiyor");
            Sent.Add((userId, title));
            return Task.CompletedTask;
        }

        public Task SendToUserByNameAsync(string fullName, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task SendToRoleAsync(string role, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default)
        {
            SentToRoles.Add(role);
            return Task.CompletedTask;
        }
    }

    private async Task<Guid> CreateStudentProfileAsync()
    {
        var userId = Guid.NewGuid();
        db.Context.Users.Add(new AppUser
        {
            Id = userId,
            FullName = "Sürücü Adayı",
            Username = "aday",
            PasswordHash = "x",
            PrimaryRole = UserRole.Student,
        });

        var student = new StudentProfile { UserId = userId, FullName = "Sürücü Adayı" };
        db.Context.Students.Add(student);

        var package = new DrivingPackage { Name = "B", DrivingLessonMinutes = 600 };
        db.Context.DrivingPackages.Add(package);

        var profile = new StudentDrivingProfile { StudentId = student.Id, PackageId = package.Id };
        db.Context.StudentDrivingProfiles.Add(profile);

        await db.Context.SaveChangesAsync();
        return profile.Id;
    }

    [Fact]
    public async Task NotifyStudent_WritesInAppNotification_AndSendsPushToThatUser()
    {
        var profileId = await CreateStudentProfileAsync();

        await Notifier.NotifyStudentAsync(profileId, "Randevunuz onaylandı", "Yarın 10:00", "DrivingAppointment");

        var notification = await db.Context.Notifications.SingleAsync();
        Assert.Equal("Randevunuz onaylandı", notification.Title);
        Assert.NotNull(notification.TargetUserId);
        Assert.Single(push.Sent);
        Assert.Equal(notification.TargetUserId, push.Sent[0].UserId);
    }

    [Fact]
    public async Task SameDedupeKey_IsNotNotifiedTwice()
    {
        var profileId = await CreateStudentProfileAsync();

        await Notifier.NotifyStudentAsync(profileId, "Ders hatırlatması", "Yarın dersiniz var", "DrivingAppointment", dedupeKey: "reminder:42");
        await Notifier.NotifyStudentAsync(profileId, "Ders hatırlatması", "Yarın dersiniz var", "DrivingAppointment", dedupeKey: "reminder:42");

        // Hatırlatma işi tekrar tekrar çalışsa bile öğrenci bir kez rahatsız edilir.
        Assert.Equal(1, await db.Context.Notifications.CountAsync());
        Assert.Single(push.Sent);
    }

    [Fact]
    public async Task DifferentDedupeKeys_AreNotifiedSeparately()
    {
        var profileId = await CreateStudentProfileAsync();

        await Notifier.NotifyStudentAsync(profileId, "Ders 1", "…", "DrivingLesson", dedupeKey: "lesson-completed:1");
        await Notifier.NotifyStudentAsync(profileId, "Ders 2", "…", "DrivingLesson", dedupeKey: "lesson-completed:2");

        Assert.Equal(2, await db.Context.Notifications.CountAsync());
    }

    [Fact]
    public async Task WithoutDedupeKey_EveryCallNotifies()
    {
        var profileId = await CreateStudentProfileAsync();

        await Notifier.NotifyStudentAsync(profileId, "Bilgi", "…", "DrivingFinance");
        await Notifier.NotifyStudentAsync(profileId, "Bilgi", "…", "DrivingFinance");

        Assert.Equal(2, await db.Context.Notifications.CountAsync());
    }

    [Fact]
    public async Task PushFailure_DoesNotThrow_AndKeepsTheInAppNotification()
    {
        var profileId = await CreateStudentProfileAsync();
        push.ShouldThrow = true;

        // Push sağlayıcısı çökse bile randevu/tahsilat işlemi geri alınmamalı.
        await Notifier.NotifyStudentAsync(profileId, "Randevunuz iptal edildi", "…", "DrivingAppointment");

        Assert.Equal(1, await db.Context.Notifications.CountAsync());
        Assert.Empty(push.Sent);
    }

    [Fact]
    public async Task NotifyStudent_ForUnknownProfile_DoesNothing()
    {
        await Notifier.NotifyStudentAsync(Guid.NewGuid(), "Başlık", "…", "DrivingAppointment");

        Assert.Equal(0, await db.Context.Notifications.CountAsync());
        Assert.Empty(push.Sent);
    }

    [Fact]
    public async Task NotifyManagers_IsABroadcast_WithoutATargetUser()
    {
        await Notifier.NotifyManagersAsync("34 ABC 123 kullanım dışı", "Arıza bildirildi", "DrivingFleet");

        var notification = await db.Context.Notifications.SingleAsync();
        Assert.Null(notification.TargetUserId);
        Assert.Equal("Admin", notification.TargetRole);
        Assert.Contains("Admin", push.SentToRoles);
    }

    public void Dispose() => db.Dispose();
}
