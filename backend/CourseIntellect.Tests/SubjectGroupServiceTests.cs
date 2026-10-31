using System.Security.Claims;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.DTOs.SubjectGroups;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

public sealed class SubjectGroupServiceTests : IDisposable
{
    private readonly SqliteConnection connection = new("DataSource=:memory:");
    private readonly CourseIntellectDbContext admin;
    private const string Year = "2026-2027";

    public SubjectGroupServiceTests()
    {
        connection.Open();
        admin = NewContext(null);
        admin.Database.EnsureCreated();
    }

    public void Dispose()
    {
        admin.Dispose();
        connection.Dispose();
    }

    private CourseIntellectDbContext NewContext(ClaimsPrincipal? user)
    {
        var options = new DbContextOptionsBuilder<CourseIntellectDbContext>().UseSqlite(connection).Options;
        var accessor = user is null ? null : new HttpContextAccessor { HttpContext = new DefaultHttpContext { User = user } };
        return new CourseIntellectDbContext(options, accessor);
    }

    private static SubjectGroupService Service(CourseIntellectDbContext context) => new(context, new NoopAuditLog());

    private async Task<AppUser> TeacherAsync(string name, string branch, Guid? branchId = null, UserStatus status = UserStatus.Active)
    {
        var user = new AppUser
        {
            FullName = name,
            Username = $"t-{Guid.NewGuid():N}",
            PasswordHash = "x",
            PrimaryRole = UserRole.Teacher,
            DepartmentOrBranch = branch,
            BranchId = branchId,
            Status = status,
        };
        admin.Users.Add(user);
        await admin.SaveChangesAsync();
        return user;
    }

    private static ClaimsPrincipal BranchManager(Guid branchId) => new(new ClaimsIdentity(
    [
        new Claim(ClaimTypes.Role, "Admin"),
        new Claim(ClaimTypes.Role, "BranchManager"),
        new Claim("branch_id", branchId.ToString()),
    ], "test"));

    [Fact]
    public async Task Create_AddsHeadAsMember_AndNormalizesSubject()
    {
        var ayse = await TeacherAsync("Ayşe Kaya", "Matematik");
        var mehmet = await TeacherAsync("Mehmet Demir", "Matematik");

        var group = await Service(admin).CreateAsync(new SaveSubjectGroupRequest(
            "  matematik ", null, Year, ayse.Id, [mehmet.Id], "Haftalık toplantı Salı", "#16a34a"), null);

        Assert.Equal("Matematik", group.Subject);
        Assert.Equal("Matematik Zümresi", group.Name);
        Assert.Equal("#16A34A", group.Color);
        Assert.Equal(2, group.Members.Count);
        Assert.True(group.Members[0].IsHead);
        Assert.Equal(ayse.Id, group.Members[0].TeacherUserId);
    }

    [Fact]
    public async Task SameSubjectSameYear_IsRejected_ButNextYearIsAllowed()
    {
        var teacher = await TeacherAsync("Ayşe Kaya", "Fizik");
        var service = Service(admin);
        await service.CreateAsync(new SaveSubjectGroupRequest("Fizik", null, Year, teacher.Id, null, null, null), null);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CreateAsync(new SaveSubjectGroupRequest("FİZİK", null, Year, null, null, null, null), null));
        var next = await service.CreateAsync(new SaveSubjectGroupRequest("Fizik", null, "2027-2028", teacher.Id, null, null, null), null);
        Assert.Equal("2027-2028", next.AcademicYear);
    }

    [Theory]
    [InlineData("2026")]
    [InlineData("2026-2028")]
    [InlineData("26-27")]
    public async Task InvalidAcademicYear_IsRejected(string year)
    {
        await Assert.ThrowsAsync<ArgumentException>(() =>
            Service(admin).CreateAsync(new SaveSubjectGroupRequest("Kimya", null, year, null, null, null, null), null));
    }

    [Fact]
    public async Task PassiveOrNonTeacher_CannotBeMember()
    {
        var passive = await TeacherAsync("Pasif Öğretmen", "Kimya", status: UserStatus.Passive);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            Service(admin).CreateAsync(new SaveSubjectGroupRequest("Kimya", null, Year, passive.Id, null, null, null), null));
    }

    [Fact]
    public async Task Update_ChangesHead_AndRemovesDroppedMembers()
    {
        var a = await TeacherAsync("Ali", "Türkçe");
        var b = await TeacherAsync("Banu", "Türkçe");
        var c = await TeacherAsync("Cem", "Türkçe");
        var service = Service(admin);
        var group = await service.CreateAsync(new SaveSubjectGroupRequest("Türkçe", null, Year, a.Id, [b.Id, c.Id], null, null), null);

        var updated = await service.UpdateAsync(group.Id, new SaveSubjectGroupRequest("Türkçe", "Türk Dili Zümresi", Year, b.Id, [b.Id], null, null));

        Assert.Equal("Türk Dili Zümresi", updated.Name);
        Assert.Equal("Banu", updated.HeadTeacherName);
        Assert.Single(updated.Members);
        Assert.Equal(1, await admin.SubjectGroupMembers.CountAsync());
    }

    [Fact]
    public async Task Overview_ReportsTeachersWithoutGroup_AndSuggestsSubjects()
    {
        var a = await TeacherAsync("Ali", "Matematik");
        await TeacherAsync("Banu", "Matematik");
        await TeacherAsync("Cem", "Biyoloji");
        await Service(admin).CreateAsync(new SaveSubjectGroupRequest("Matematik", null, Year, a.Id, null, null, null), null);

        var overview = await Service(admin).GetOverviewAsync(Year);

        Assert.Equal(1, overview.GroupCount);
        Assert.Equal(3, overview.TeacherCount);
        Assert.Equal(2, overview.TeachersWithoutGroup);
        Assert.Equal("Biyoloji", overview.Suggestions[0].Subject);
        Assert.False(overview.Suggestions[0].HasGroup);
    }

    [Fact]
    public async Task Teacher_SeesOnlyOwnGroups()
    {
        var a = await TeacherAsync("Ali", "Matematik");
        var b = await TeacherAsync("Banu", "Fizik");
        var service = Service(admin);
        await service.CreateAsync(new SaveSubjectGroupRequest("Matematik", null, Year, a.Id, null, null, null), null);
        await service.CreateAsync(new SaveSubjectGroupRequest("Fizik", null, Year, b.Id, null, null, null), null);

        var mine = await service.GetForTeacherAsync(a.Id);

        Assert.Equal("Matematik", Assert.Single(mine).Subject);
    }

    [Fact]
    public async Task BranchManager_IsLockedToOwnBranch()
    {
        var branchA = Guid.NewGuid();
        var branchB = Guid.NewGuid();
        var teacherA = await TeacherAsync("Ali A", "Matematik", branchA);
        var teacherB = await TeacherAsync("Banu B", "Matematik", branchB);
        await using (var managerB = NewContext(BranchManager(branchB)))
        {
            await Service(managerB).CreateAsync(new SaveSubjectGroupRequest("Matematik", null, Year, teacherB.Id, null, null, null), null);
        }

        await using var managerA = NewContext(BranchManager(branchA));
        var serviceA = Service(managerA);
        // B şubesinin zümresi A'ya görünmez; A kendi Matematik zümresini kurabilir.
        Assert.Empty((await serviceA.GetOverviewAsync(Year)).Groups);
        await Assert.ThrowsAsync<ArgumentException>(() =>
            serviceA.CreateAsync(new SaveSubjectGroupRequest("Matematik", null, Year, teacherB.Id, null, null, null), null));
        var own = await serviceA.CreateAsync(new SaveSubjectGroupRequest("Matematik", null, Year, teacherA.Id, null, null, null), null);
        Assert.Equal(branchA, (await admin.SubjectGroups.AsNoTracking().SingleAsync(x => x.Id == own.Id)).BranchId);
    }

    [Fact]
    public void AcademicYear_StartsInSeptember()
    {
        Assert.Equal("2026-2027", SubjectGroupService.CurrentAcademicYear(new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc)));
        Assert.Equal("2025-2026", SubjectGroupService.CurrentAcademicYear(new DateTime(2026, 8, 31, 12, 0, 0, DateTimeKind.Utc)));
        Assert.Equal("2026-2027", SubjectGroupService.CurrentAcademicYear(new DateTime(2027, 3, 1, 0, 0, 0, DateTimeKind.Utc)));
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
