using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.DTOs.Students;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Auth;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

/// <summary>
/// Dönem sonu sınıf yükseltme (7-A → 8-A): öğrenci ve kullanıcı kaydındaki sınıf
/// birlikte değişmeli, başka kurumun/şubenin öğrencisi taşınamamalı, zaten hedef
/// sınıfta olan atlanmalı. Gerçek servis çalıştırılır.
/// </summary>
public sealed class StudentPromotionTests : IDisposable
{
    private readonly TestDb db = new();
    private static readonly Guid TenantA = Guid.NewGuid();
    private static readonly Guid TenantB = Guid.NewGuid();
    private static readonly Guid AliUserId = Guid.NewGuid();
    private static readonly Guid AyseUserId = Guid.NewGuid();
    private static readonly Guid OtherUserId = Guid.NewGuid();

    private sealed class NoopHasher : IPasswordHasher
    {
        public string Hash(string password) => password;
        public bool Verify(string password, string passwordHash) => password == passwordHash;
    }

    private sealed class NoopParentNotifier : IParentNotifier
    {
        public Task NotifyStudentParentAsync(string studentName, string title, string message, string category, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private sealed class RecordingAuditLog : IAuditLogService
    {
        public List<string> Entries { get; } = [];

        public Task LogAsync(Guid? actorUserId, string actorName, string action, string category, string entityType, string entityId, string detail, CancellationToken cancellationToken = default)
        {
            Entries.Add($"{action}|{detail}");
            return Task.CompletedTask;
        }

        public Task LogAsync(string action, string category, string entityType, string entityId, string detail, CancellationToken cancellationToken = default)
        {
            Entries.Add($"{action}|{detail}");
            return Task.CompletedTask;
        }

        public List<(object? Before, object? After)> Changes { get; } = [];

        public Task LogChangeAsync(string action, string category, string entityType, string entityId, string detail, object? before, object? after, CancellationToken cancellationToken = default)
        {
            Entries.Add($"{action}|{detail}");
            Changes.Add((before, after));
            return Task.CompletedTask;
        }

        // Okuma yolları bu testte kullanılmaz.
        public Task<IReadOnlyList<AuditLogDto>> GetAsync(string? category, int take, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<AuditLogPageDto> GetPagedAsync(AuditLogQuery query, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<IReadOnlyList<AuditBranchSummaryDto>> GetBranchSummaryAsync(CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
    }

    private sealed class FixedTenantContext(Guid? tenantId) : ITenantContext
    {
        public Guid? CurrentTenantId { get; } = tenantId;
        public bool HasTenant => CurrentTenantId.HasValue;
    }

    private readonly RecordingAuditLog audit = new();

    private AcademicQueryService CreateService(Guid tenantId)
    {
        db.Context.SetTenantOverride(tenantId);
        return new AcademicQueryService(
            db.Context,
            new NoopHasher(),
            new UsernameGenerator(db.Context),
            new FixedTenantContext(tenantId),
            new NoopParentNotifier(),
            audit);
    }

    private async Task SeedAsync()
    {
        db.Context.TenantWorkspaces.AddRange(
            new TenantWorkspace { Id = TenantA, Name = "Okul A", Slug = "okul-a" },
            new TenantWorkspace { Id = TenantB, Name = "Okul B", Slug = "okul-b" });
        db.Context.Users.AddRange(
            new AppUser { Id = AliUserId, TenantId = TenantA, Username = "ali", FullName = "Ali VELI", PrimaryRole = UserRole.Student, DepartmentOrBranch = "7-A" },
            new AppUser { Id = AyseUserId, TenantId = TenantA, Username = "ayse", FullName = "Ayse YILMAZ", PrimaryRole = UserRole.Student, DepartmentOrBranch = "8-A" },
            new AppUser { Id = OtherUserId, TenantId = TenantB, Username = "baska", FullName = "Baska OGRENCI", PrimaryRole = UserRole.Student, DepartmentOrBranch = "7-A" });
        db.Context.Students.AddRange(
            new StudentProfile { TenantId = TenantA, UserId = AliUserId, FullName = "Ali VELI", ClassName = "7-A" },
            new StudentProfile { TenantId = TenantA, UserId = AyseUserId, FullName = "Ayse YILMAZ", ClassName = "8-A" },
            new StudentProfile { TenantId = TenantB, UserId = OtherUserId, FullName = "Baska OGRENCI", ClassName = "7-A" });
        await db.Context.SaveChangesAsync();
    }

    [Fact]
    public async Task Promote_MovesStudentAndUserRecordTogether()
    {
        await SeedAsync();
        var service = CreateService(TenantA);

        var result = await service.PromoteStudentsAsync(new PromoteStudentsRequest([AliUserId], "8-A"));

        Assert.Equal(1, result.Promoted);
        var student = await db.Context.Students.FirstAsync(x => x.UserId == AliUserId);
        var user = await db.Context.Users.FirstAsync(x => x.Id == AliUserId);
        Assert.Equal("8-A", student.ClassName);
        // Kullanıcı kaydı ayrışırsa menü/rapor filtreleri eski sınıfı gösterir.
        Assert.Equal("8-A", user.DepartmentOrBranch);
        Assert.Contains(audit.Entries, entry => entry.StartsWith("Sınıf yükseltme"));
    }

    [Fact]
    public async Task Promote_SkipsStudentsAlreadyInTargetClass()
    {
        await SeedAsync();
        var service = CreateService(TenantA);

        var result = await service.PromoteStudentsAsync(
            new PromoteStudentsRequest([AliUserId, AyseUserId], "8-A"));

        Assert.Equal(1, result.Promoted);
        Assert.Contains("Ayse YILMAZ", result.AlreadyInClass);
    }

    [Fact]
    public async Task Promote_CannotTouchAnotherTenantsStudent()
    {
        await SeedAsync();
        var service = CreateService(TenantA);

        var result = await service.PromoteStudentsAsync(new PromoteStudentsRequest([OtherUserId], "8-A"));

        Assert.Equal(0, result.Promoted);
        Assert.Contains(OtherUserId, result.NotFound);

        db.Context.SetTenantOverride(TenantB);
        var untouched = await db.Context.Students.FirstAsync(x => x.UserId == OtherUserId);
        Assert.Equal("7-A", untouched.ClassName);
    }

    [Fact]
    public async Task Promote_RejectsEmptyTargetOrSelection()
    {
        await SeedAsync();
        var service = CreateService(TenantA);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.PromoteStudentsAsync(new PromoteStudentsRequest([AliUserId], "  ")));
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.PromoteStudentsAsync(new PromoteStudentsRequest([], "8-A")));
    }

    private static UpdateStudentRequest Edit(string fullName, string className = "7-A", string tcNo = "10000000146") =>
        new(fullName, tcNo, className, "", "", "2012-05-01", "Ortaokul", "Veli VELI", "", "", "", "");

    [Fact]
    public async Task Update_RenamesStudyPlan_AndAuditsChangedFieldsWithMaskedTc()
    {
        await SeedAsync();
        db.Context.StudyPlanStates.Add(new StudyPlanState { TenantId = TenantA, StudentUserId = AliUserId, StudentName = "Ali VELI", XpPoints = 120, StreakCount = 4 });
        await db.Context.SaveChangesAsync();
        var service = CreateService(TenantA);
        var id = (await db.Context.Students.FirstAsync(x => x.UserId == AliUserId)).Id;

        var result = await service.UpdateStudentAsync(id, Edit("Ali Veli Can"));

        Assert.Equal("Ali Veli CAN", result?.FullName);
        var plan = await db.Context.StudyPlanStates.SingleAsync();
        Assert.Equal("Ali Veli CAN", plan.StudentName);
        Assert.Equal(120, plan.XpPoints);
        var entry = Assert.Single(audit.Entries, item => item.StartsWith("Öğrenci bilgileri güncellendi"));
        Assert.Contains("Ad soyad: Ali VELI → Ali Veli CAN", entry);
        Assert.Contains("TC kimlik: (boş) → 100******46", entry);
        Assert.DoesNotContain("10000000146", entry);
        var after = Assert.IsType<Dictionary<string, string>>(audit.Changes.Single().After);
        Assert.Equal("100******46", after["TC kimlik"]);
        Assert.DoesNotContain("Sınıf", after.Keys);
    }

    /// <summary>Eski adı taşıyan başka öğrenci varsa program kimin olduğu belli değildir; yerinde bırakılır.</summary>
    [Fact]
    public async Task Update_RenamesLinkedAttendanceAndExamRows()
    {
        await SeedAsync();
        var service = CreateService(TenantA);
        var id = (await db.Context.Students.FirstAsync(x => x.UserId == AliUserId)).Id;
        db.Context.ExamResults.Add(new ExamResult { TenantId = TenantA, StudentId = id, StudentName = "Ali VELI", ClassName = "7-A", ExamTitle = "Deneme", Subject = "Fen", DateLabel = "01.06.2026", Score = 70 });
        db.Context.AttendanceEntries.AddRange(
            new AttendanceEntry { TenantId = TenantA, StudentId = id, StudentName = "Ali VELI", ClassName = "7-A", Lesson = "Fen", LessonDate = new DateTime(2026, 6, 1), Status = "Katildi" },
            new AttendanceEntry { TenantId = TenantA, StudentName = "Ali VELI", ClassName = "7-A", Lesson = "Fen", LessonDate = new DateTime(2026, 6, 2), Status = "Katildi" });
        await db.Context.SaveChangesAsync();

        await service.UpdateStudentAsync(id, Edit("Ali Can"));

        var rows = await db.Context.AttendanceEntries.IgnoreQueryFilters().AsNoTracking().ToListAsync();
        Assert.Equal("Ali CAN", rows.Single(x => x.StudentId == id).StudentName);
        var exam = await db.Context.ExamResults.IgnoreQueryFilters().AsNoTracking().SingleAsync();
        Assert.Equal("Ali CAN", exam.StudentName);
        // Kimliğe bağlanmamış eski kayıt (kime ait olduğu kesin değil) ellenmez.
        Assert.Equal("Ali VELI", rows.Single(x => x.StudentId == null).StudentName);
    }

    /// <summary>Program öğrenci kimliğiyle bağlı: ad değişince yalnız gösterim adı güncellenir; adaşın planı ellenmez.</summary>
    [Fact]
    public async Task Update_TouchesOnlyTheStudentsOwnStudyPlan()
    {
        await SeedAsync();
        var twinId = Guid.NewGuid();
        db.Context.Users.Add(new AppUser { Id = twinId, TenantId = TenantA, Username = "ali2", FullName = "Ali VELI", PrimaryRole = UserRole.Student });
        db.Context.Students.Add(new StudentProfile { TenantId = TenantA, UserId = twinId, FullName = "Ali VELI", ClassName = "7-B" });
        db.Context.StudyPlanStates.Add(new StudyPlanState { TenantId = TenantA, StudentUserId = twinId, StudentName = "Ali VELI" });
        await db.Context.SaveChangesAsync();
        var service = CreateService(TenantA);
        var id = (await db.Context.Students.FirstAsync(x => x.UserId == AliUserId)).Id;

        await service.UpdateStudentAsync(id, Edit("Ali Can"));

        Assert.Equal("Ali VELI", (await db.Context.StudyPlanStates.SingleAsync()).StudentName);
    }

    [Fact]
    public async Task Update_WithoutChanges_WritesNoAuditEntry()
    {
        await SeedAsync();
        var service = CreateService(TenantA);
        var id = (await db.Context.Students.FirstAsync(x => x.UserId == AliUserId)).Id;
        await service.UpdateStudentAsync(id, Edit("Ali VELI"));
        audit.Entries.Clear();

        await service.UpdateStudentAsync(id, Edit("Ali VELI"));

        Assert.DoesNotContain(audit.Entries, item => item.StartsWith("Öğrenci bilgileri güncellendi"));
    }

    public void Dispose() => db.Dispose();
}
