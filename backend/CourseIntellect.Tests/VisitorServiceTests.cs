using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.DTOs.Visitors;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

public sealed class VisitorServiceTests : IDisposable
{
    private readonly TestDb db = new();

    public void Dispose() => db.Dispose();

    private VisitorService Service => new(db.Context, new NoopAuditLog());

    private async Task<AppUser> StaffAsync(string name, UserRole role = UserRole.Teacher)
    {
        var user = new AppUser { FullName = name, Username = $"u-{Guid.NewGuid():N}", PasswordHash = "x", PrimaryRole = role };
        db.Context.Users.Add(user);
        await db.Context.SaveChangesAsync();
        return user;
    }

    private static CheckInVisitorRequest Request(string name = "Ahmet Yılmaz", Guid? hostId = null, string? host = "Müdür Yardımcısı",
        string? identity = null, string? badge = null, bool privacy = true) =>
        new(name, "0532 111 22 33", identity, "Parent", "Veli görüşmesi", hostId, host, null, badge, "34 abc 123", 1, null, privacy);

    [Theory]
    [InlineData("12345678901", "8901")]
    [InlineData("123 456 789 01", "8901")]
    [InlineData("U1234", "1234")]
    [InlineData("12", "")]
    [InlineData(null, "")]
    public void Identity_IsReducedToLastFourDigits(string? identity, string expected)
        => Assert.Equal(expected, VisitorService.MaskIdentity(identity));

    [Fact]
    public async Task CheckIn_StoresOnlyLastFour_AndNotifiesHost()
    {
        var host = await StaffAsync("Ayşe Hoca");

        var visitor = await Service.CheckInAsync(Request(hostId: host.Id, identity: "12345678901"), null, "Sekreter");

        var stored = await db.Context.Visitors.SingleAsync();
        Assert.Equal("8901", stored.IdentityLast4);
        Assert.DoesNotContain("1234567", stored.Note + stored.FullName + stored.Purpose);
        Assert.Equal(host.FullName, visitor.HostName);
        Assert.Equal("34 ABC 123", visitor.VehiclePlate);
        var notification = await db.Context.Notifications.SingleAsync();
        Assert.Equal(host.Id, notification.TargetUserId);
    }

    [Fact]
    public async Task CheckIn_RequiresPrivacyNotice()
    {
        await Assert.ThrowsAsync<ArgumentException>(() => Service.CheckInAsync(Request(privacy: false), null, "Sekreter"));
        Assert.Empty(await db.Context.Visitors.ToListAsync());
    }

    [Fact]
    public async Task StudentOrParent_CannotBeHost()
    {
        var student = await StaffAsync("Öğrenci", UserRole.Student);
        await Assert.ThrowsAsync<ArgumentException>(() => Service.CheckInAsync(Request(hostId: student.Id, host: null), null, "Sekreter"));
    }

    [Fact]
    public async Task Badge_CannotBeGivenTwiceWhileInside_AndCheckoutFreesIt()
    {
        var first = await Service.CheckInAsync(Request(badge: "z-07"), null, "Sekreter");
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.CheckInAsync(Request("Mehmet Kaya", badge: "Z-07"), null, "Sekreter"));

        await Service.CheckOutAsync(first.Id, null);
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.CheckOutAsync(first.Id, null));
        var second = await Service.CheckInAsync(Request("Mehmet Kaya", badge: "Z-07"), null, "Sekreter");
        Assert.Equal("Z-07", second.BadgeNo);
    }

    [Fact]
    public async Task List_ShowsVisitorsStillInside_FromEarlierDays()
    {
        db.Context.Visitors.Add(new VisitorEntry
        {
            FullName = "Dünden Kalan", Purpose = "Toplantı", HostName = "Müdür", VisitorType = "Guest",
            CheckInAtUtc = DateTime.UtcNow.AddDays(-1).AddHours(-5),
        });
        await db.Context.SaveChangesAsync();
        await Service.CheckInAsync(Request(), null, "Sekreter");

        var inside = await Service.ListAsync(null, null, null, "inside");

        Assert.Equal(2, inside.Items.Count);
        Assert.Equal(2, inside.Summary.InsideCount);
        Assert.Equal(1, inside.Summary.TodayCount);
        Assert.Equal(1, inside.Summary.OverstayCount);
    }

    [Fact]
    public async Task Lookup_GroupsPreviousVisits_WithoutIdentity()
    {
        await Service.CheckInAsync(Request(identity: "12345678901"), null, "Sekreter");
        await Service.CheckInAsync(Request(identity: "12345678901"), null, "Sekreter");

        var match = Assert.Single(await Service.LookupAsync("ahmet"));

        Assert.Equal(2, match.VisitCount);
        Assert.Equal("Veli görüşmesi", match.LastPurpose);
    }

    [Fact]
    public async Task Purge_RemovesRecordsOlderThanRetention()
    {
        db.Context.Visitors.AddRange(
            new VisitorEntry { FullName = "Eski", Purpose = "x", HostName = "y", CheckInAtUtc = DateTime.UtcNow.AddDays(-VisitorService.RetentionDays - 1), CheckOutAtUtc = DateTime.UtcNow.AddDays(-VisitorService.RetentionDays - 1) },
            new VisitorEntry { FullName = "Yeni", Purpose = "x", HostName = "y", CheckInAtUtc = DateTime.UtcNow.AddDays(-10) });
        await db.Context.SaveChangesAsync();

        var removed = await Service.PurgeExpiredAsync(DateTime.UtcNow);

        Assert.Equal(1, removed);
        Assert.Equal("Yeni", (await db.Context.Visitors.SingleAsync()).FullName);
    }

    [Theory]
    [InlineData("A", "Görüşme")]
    [InlineData("Ali Veli", "")]
    public async Task InvalidInput_IsRejected(string name, string purpose)
    {
        await Assert.ThrowsAsync<ArgumentException>(() => Service.CheckInAsync(
            new CheckInVisitorRequest(name, null, null, "Guest", purpose, null, "Müdür", null, null, null, null, null, true), null, "Sekreter"));
    }

    private sealed class NoopAuditLog : IAuditLogService
    {
        public Task LogAsync(Guid? actorUserId, string actorName, string action, string category, string entityType, string entityId, string detail, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LogAsync(string action, string category, string entityType, string entityId, string detail, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LogChangeAsync(string action, string category, string entityType, string entityId, string detail, object? before, object? after, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<AuditLogDto>> GetAsync(string? category, int take, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<AuditLogDto>>([]);
        public Task<AuditLogPageDto> GetPagedAsync(AuditLogQuery query, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<AuditBranchSummaryDto>> GetBranchSummaryAsync(CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<AuditBranchSummaryDto>>([]);
    }
}
