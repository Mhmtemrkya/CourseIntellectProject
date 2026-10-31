using System.Security.Claims;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.DTOs.Clubs;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

public sealed class ClubServiceTests : IDisposable
{
    private readonly SqliteConnection connection = new("DataSource=:memory:");
    private readonly CourseIntellectDbContext db;
    private const string Year = "2026-2027";
    private static readonly ClubViewer Manager = new(ClubViewerKind.Manager, Guid.NewGuid(), []);

    public ClubServiceTests()
    {
        connection.Open();
        db = NewContext(null);
        db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        db.Dispose();
        connection.Dispose();
    }

    private CourseIntellectDbContext NewContext(ClaimsPrincipal? user)
    {
        var options = new DbContextOptionsBuilder<CourseIntellectDbContext>().UseSqlite(connection).Options;
        var accessor = user is null ? null : new HttpContextAccessor { HttpContext = new DefaultHttpContext { User = user } };
        return new CourseIntellectDbContext(options, accessor);
    }

    private ClubService Service(CourseIntellectDbContext? context = null) => new(context ?? db, new NoopAuditLog());

    private async Task<AppUser> UserAsync(string name, UserRole role, Guid? branchId = null)
    {
        var user = new AppUser { FullName = name, Username = $"u-{Guid.NewGuid():N}", PasswordHash = "x", PrimaryRole = role, BranchId = branchId };
        db.Users.Add(user);
        if (role == UserRole.Student)
        {
            db.Students.Add(new StudentProfile { UserId = user.Id, FullName = name, ClassName = "9-A", BranchId = branchId });
        }
        await db.SaveChangesAsync();
        return user;
    }

    private static ClubViewer Teacher(AppUser user) => new(ClubViewerKind.Teacher, user.Id, []);
    private static ClubViewer Student(AppUser user) => new(ClubViewerKind.Student, user.Id, []);

    private Task<ClubSummaryDto> CreateClubAsync(string name, Guid? advisorId = null, int capacity = 0, bool acceptsRequests = true)
        => Service().CreateAsync(Manager, new SaveClubRequest(name, "Science", "Deneyler", Year, advisorId, capacity, "Çarşamba 15:30", "Lab 2", "#0891b2", acceptsRequests, null));

    [Fact]
    public async Task Manager_CreatesClub_WithAdvisor_AndDuplicateNameIsRejected()
    {
        var teacher = await UserAsync("Ayşe Hoca", UserRole.Teacher);

        var club = await CreateClubAsync("Bilim Kulübü", teacher.Id);

        Assert.Equal(teacher.FullName, club.AdvisorTeacherName);
        Assert.Equal("#0891B2", club.Color);
        await Assert.ThrowsAsync<InvalidOperationException>(() => CreateClubAsync("bilim kulübü"));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => Service().CreateAsync(Teacher(teacher),
            new SaveClubRequest("Satranç", null, null, Year, null, null, null, null, null, null, null)));
    }

    [Fact]
    public async Task Student_RequestsJoin_AdvisorApproves_AndStudentIsNotified()
    {
        var teacher = await UserAsync("Ayşe Hoca", UserRole.Teacher);
        var student = await UserAsync("Ali Can", UserRole.Student);
        var club = await CreateClubAsync("Robotik", teacher.Id);

        var request = await Service().RequestJoinAsync(Student(student), club.Id, new JoinClubRequest("Arduino biliyorum"));
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service().RequestJoinAsync(Student(student), club.Id, new JoinClubRequest(null)));
        var approved = await Service().UpdateMemberAsync(Teacher(teacher), club.Id, request.Id, new UpdateClubMemberRequest("approve", "Member", null));

        Assert.Equal("Active", approved!.Status);
        var mine = await Service().GetMineAsync(Student(student));
        Assert.Equal("Active", Assert.Single(mine).MyStatus);
        Assert.Contains(await db.Notifications.ToListAsync(), item => item.TargetUserId == student.Id && item.Title.Contains("onaylandı"));
        Assert.Contains(await db.Notifications.ToListAsync(), item => item.TargetUserId == teacher.Id);
    }

    [Fact]
    public async Task OtherTeacher_CannotManageClub()
    {
        var advisor = await UserAsync("Danışman", UserRole.Teacher);
        var other = await UserAsync("Başka Öğretmen", UserRole.Teacher);
        var student = await UserAsync("Ali Can", UserRole.Student);
        var club = await CreateClubAsync("Drama", advisor.Id);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            Service().AddMemberAsync(Teacher(other), club.Id, new AddClubMemberRequest(student.Id, null)));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            Service().SaveActivityAsync(Teacher(other), club.Id, null, new SaveClubActivityRequest("Prova", null, DateTime.UtcNow.AddDays(2), null, null, null, null)));
    }

    [Fact]
    public async Task Capacity_IsEnforced_OnAddAndApprove()
    {
        var s1 = await UserAsync("Ali", UserRole.Student);
        var s2 = await UserAsync("Banu", UserRole.Student);
        var club = await CreateClubAsync("Satranç", capacity: 1);

        await Service().AddMemberAsync(Manager, club.Id, new AddClubMemberRequest(s1.Id, null));

        await Assert.ThrowsAsync<InvalidOperationException>(() => Service().AddMemberAsync(Manager, club.Id, new AddClubMemberRequest(s2.Id, null)));
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service().RequestJoinAsync(Student(s2), club.Id, new JoinClubRequest(null)));
        // Kontenjanı mevcut aktif üye sayısının altına indirmek reddedilir.
        var wide = await CreateClubAsync("Briç", capacity: 5);
        await Service().AddMemberAsync(Manager, wide.Id, new AddClubMemberRequest(s1.Id, null));
        await Service().AddMemberAsync(Manager, wide.Id, new AddClubMemberRequest(s2.Id, null));
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service().UpdateAsync(Manager, wide.Id,
            new SaveClubRequest("Briç", "Science", null, Year, null, 1, null, null, null, null, null)));
    }

    [Fact]
    public async Task OnlyOnePresident_PerClub()
    {
        var s1 = await UserAsync("Ali", UserRole.Student);
        var s2 = await UserAsync("Banu", UserRole.Student);
        var club = await CreateClubAsync("Münazara");
        await Service().AddMemberAsync(Manager, club.Id, new AddClubMemberRequest(s1.Id, "President"));
        var banu = await Service().AddMemberAsync(Manager, club.Id, new AddClubMemberRequest(s2.Id, null));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Service().UpdateMemberAsync(Manager, club.Id, banu.Id, new UpdateClubMemberRequest("setRole", "President", null)));
        var secretary = await Service().UpdateMemberAsync(Manager, club.Id, banu.Id, new UpdateClubMemberRequest("setRole", "Secretary", null));
        Assert.Equal("Secretary", secretary!.Role);
    }

    [Fact]
    public async Task ClosedClub_RejectsJoinRequests()
    {
        var student = await UserAsync("Ali", UserRole.Student);
        var club = await CreateClubAsync("Okul Takımı", acceptsRequests: false);

        await Assert.ThrowsAsync<InvalidOperationException>(() => Service().RequestJoinAsync(Student(student), club.Id, new JoinClubRequest(null)));
    }

    [Fact]
    public async Task Student_SeesOnlyActiveMembers_WithoutPrivateNotes()
    {
        var s1 = await UserAsync("Ali", UserRole.Student);
        var s2 = await UserAsync("Banu", UserRole.Student);
        var club = await CreateClubAsync("Fotoğraf");
        await Service().AddMemberAsync(Manager, club.Id, new AddClubMemberRequest(s1.Id, null));
        await Service().RequestJoinAsync(Student(s2), club.Id, new JoinClubRequest("Gizli not"));

        var asStudent = await Service().GetDetailAsync(Student(s1), club.Id);
        var asManager = await Service().GetDetailAsync(Manager, club.Id);

        Assert.Equal("Ali", Assert.Single(asStudent.Members).StudentName);
        Assert.Equal(0, asStudent.Club.PendingCount);
        Assert.Equal(2, asManager.Members.Count);
        Assert.Equal(1, asManager.Club.PendingCount);
    }

    [Fact]
    public async Task Parent_SeesChildClubs_AndUpcomingActivities()
    {
        var child = await UserAsync("Ali", UserRole.Student);
        var club = await CreateClubAsync("Bilim");
        await Service().AddMemberAsync(Manager, club.Id, new AddClubMemberRequest(child.Id, null));
        await Service().SaveActivityAsync(Manager, club.Id, null, new SaveClubActivityRequest("Bilim Fuarı", null, DateTime.UtcNow.AddDays(5), "Spor salonu", null, null, null));
        var parent = new ClubViewer(ClubViewerKind.Parent, Guid.NewGuid(), [child.Id]);

        var clubs = await Service().GetMineAsync(parent);
        var activities = await Service().GetUpcomingActivitiesAsync(parent);

        Assert.Equal("Bilim", Assert.Single(clubs).Name);
        Assert.Equal("Bilim Fuarı", Assert.Single(activities).Title);
        Assert.Contains(await db.Notifications.ToListAsync(), item => item.TargetUserId == child.Id && item.Title.Contains("yeni etkinlik"));
    }

    [Fact]
    public async Task Student_CanWithdrawRequest_AndLeave()
    {
        var student = await UserAsync("Ali", UserRole.Student);
        var club = await CreateClubAsync("Müzik");
        await Service().RequestJoinAsync(Student(student), club.Id, new JoinClubRequest(null));

        await Service().LeaveAsync(Student(student), club.Id);
        Assert.Empty(await db.ClubMembers.ToListAsync());

        await Service().AddMemberAsync(Manager, club.Id, new AddClubMemberRequest(student.Id, "President"));
        await Service().LeaveAsync(Student(student), club.Id);
        var member = await db.ClubMembers.SingleAsync();
        Assert.Equal("Left", member.Status);
        Assert.Equal("Member", member.Role);
    }

    [Fact]
    public async Task BranchManager_DoesNotSeeOtherBranchClubs()
    {
        var branchA = Guid.NewGuid();
        var branchB = Guid.NewGuid();
        await using (var managerB = NewContext(BranchManager(branchB)))
        {
            await Service(managerB).CreateAsync(Manager, new SaveClubRequest("B Kulübü", null, null, Year, null, null, null, null, null, null, null));
        }
        var studentA = await UserAsync("A Öğrenci", UserRole.Student, branchA);

        await using var managerA = NewContext(BranchManager(branchA));
        Assert.Empty((await Service(managerA).GetOverviewAsync(Manager, Year)).Clubs);
        var own = await Service(managerA).CreateAsync(Manager, new SaveClubRequest("A Kulübü", null, null, Year, null, null, null, null, null, null, null));
        await Service(managerA).AddMemberAsync(Manager, own.Id, new AddClubMemberRequest(studentA.Id, null));
        Assert.Equal(branchA, (await db.ClubMembers.AsNoTracking().SingleAsync()).BranchId);
    }

    private static ClaimsPrincipal BranchManager(Guid branchId) => new(new ClaimsIdentity(
    [
        new Claim(ClaimTypes.Role, "Admin"),
        new Claim(ClaimTypes.Role, "BranchManager"),
        new Claim("branch_id", branchId.ToString()),
    ], "test"));

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
