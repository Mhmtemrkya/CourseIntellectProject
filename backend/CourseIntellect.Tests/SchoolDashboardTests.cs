using System.Security.Claims;
using System.Text.Json;
using CourseIntellect.Api.Controllers;
using CourseIntellect.Application.DTOs.Messages;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Tests;

/// <summary>
/// Okul kurum sahibi panosu (/api/admin/dashboard): sayaçlar kurum kapsamında
/// kalmalı, pasif hesaplar hiçbir sayıma girmemeli ve kapalı modülün sayacı
/// hiç dönmemeli (istemci null geleni çizmez — panoda yetkisiz veri olmaz).
/// </summary>
public sealed class SchoolDashboardTests : IDisposable
{
    private readonly TestDb db = new();
    private static readonly Guid TenantA = Guid.NewGuid();
    private static readonly Guid TenantB = Guid.NewGuid();

    private sealed class StubEntitlements(HashSet<string> allowed) : IEntitlementService
    {
        public Task<bool> IsAllowedAsync(ClaimsPrincipal user, string module, string? action, CancellationToken cancellationToken = default)
            => Task.FromResult(allowed.Contains(module));
    }

    private sealed class StubMessages : IMessageService
    {
        public Task<IReadOnlyList<MessageThreadDto>> GetThreadsAsync(Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<MessageThreadDto>>(
                [new MessageThreadDto(Guid.NewGuid(), "Veli", "parent", "merhaba", DateTime.UtcNow, 3, false, "delivered")]);

        public Task<IReadOnlyList<MessageItemDto>> GetMessagesAsync(Guid currentUserId, string currentUserName, Guid threadId, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<MessageThreadDto> CreateOrGetThreadAsync(Guid currentUserId, string currentUserName, string currentUserRole, CreateThreadRequest request, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<MessageItemDto> SendMessageAsync(Guid currentUserId, string currentUserName, string currentUserRole, Guid threadId, SendMessageRequest request, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task JoinRealtimeAsync(Guid currentUserId, string currentUserName, Guid threadId, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private sealed class StubTenantContext(Guid? tenantId) : ITenantContext
    {
        public Guid? CurrentTenantId { get; } = tenantId;
        public bool HasTenant => CurrentTenantId.HasValue;
    }

    private async Task SeedAsync()
    {
        db.Context.TenantWorkspaces.AddRange(
            new TenantWorkspace { Id = TenantA, Name = "Okul A", Slug = "okul-a" },
            new TenantWorkspace { Id = TenantB, Name = "Okul B", Slug = "okul-b" });

        // A kurumu: 2 aktif + 1 pasif öğrenci, 1 öğretmen.
        var activeOne = Guid.NewGuid();
        var activeTwo = Guid.NewGuid();
        var passiveOne = Guid.NewGuid();
        var teacherUser = Guid.NewGuid();
        db.Context.Users.AddRange(
            new AppUser { Id = activeOne, TenantId = TenantA, Username = "a1", FullName = "Ali VELI", PrimaryRole = UserRole.Student, Status = UserStatus.Active },
            new AppUser { Id = activeTwo, TenantId = TenantA, Username = "a2", FullName = "Ayse YILMAZ", PrimaryRole = UserRole.Student, Status = UserStatus.Active },
            new AppUser { Id = passiveOne, TenantId = TenantA, Username = "a3", FullName = "Pasif OGRENCI", PrimaryRole = UserRole.Student, Status = UserStatus.Passive },
            new AppUser { Id = teacherUser, TenantId = TenantA, Username = "t1", FullName = "Ogretmen BIR", PrimaryRole = UserRole.Teacher, Status = UserStatus.Active });
        db.Context.Students.AddRange(
            new StudentProfile { TenantId = TenantA, UserId = activeOne, FullName = "Ali VELI", ClassName = "9-A" },
            new StudentProfile { TenantId = TenantA, UserId = activeTwo, FullName = "Ayse YILMAZ", ClassName = "9-B" },
            new StudentProfile { TenantId = TenantA, UserId = passiveOne, FullName = "Pasif OGRENCI", ClassName = "9-A" });
        db.Context.Staff.Add(new StaffProfile { TenantId = TenantA, UserId = teacherUser, FullName = "Ogretmen BIR", Role = UserRole.Teacher });

        // B kurumu: A'nın panosunda ASLA görünmemeli.
        var otherUser = Guid.NewGuid();
        db.Context.Users.Add(new AppUser { Id = otherUser, TenantId = TenantB, Username = "b1", FullName = "Baska OGRENCI", PrimaryRole = UserRole.Student, Status = UserStatus.Active });
        db.Context.Students.Add(new StudentProfile { TenantId = TenantB, UserId = otherUser, FullName = "Baska OGRENCI", ClassName = "10-A" });

        // Finans + kütüphane verisi (modül kapısını doğrulamak için).
        db.Context.FinancePayments.Add(new FinancePayment
        {
            TenantId = TenantA,
            StudentName = "Ali VELI",
            Amount = 1500m,
            PaidAtUtc = DateTime.UtcNow,
        });
        db.Context.LibraryLoans.Add(new LibraryLoan
        {
            TenantId = TenantA,
            BookTitle = "Kitap",
            StudentName = "Ali VELI",
            LoanedAtUtc = DateTime.UtcNow.AddDays(-30),
            DueAtUtc = DateTime.UtcNow.AddDays(-5),
        });

        await db.Context.SaveChangesAsync();
    }

    private SchoolDashboardController CreateController(Guid tenantId, params string[] allowedModules)
    {
        db.Context.SetTenantOverride(tenantId);
        return new SchoolDashboardController(
            db.Context,
            new StubEntitlements([.. allowedModules]),
            new StubMessages(),
            new StubTenantContext(tenantId))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        [new Claim("nameid", Guid.NewGuid().ToString()), new Claim("name", "Kurum Sahibi")], "test")),
                },
            },
        };
    }

    private static JsonElement KpisOf(IActionResult result)
    {
        var ok = Assert.IsType<OkObjectResult>(result);
        var json = JsonSerializer.Serialize(ok.Value);
        return JsonDocument.Parse(json).RootElement.GetProperty("kpis");
    }

    [Fact]
    public async Task Kpis_CountOnlyOwnTenant_AndSkipPassiveAccounts()
    {
        await SeedAsync();
        var controller = CreateController(TenantA);

        var kpis = KpisOf(await controller.Get(null, null, CancellationToken.None));

        // Pasif öğrenci sayıma girmez; başka kurumun öğrencisi hiç görünmez.
        Assert.Equal(2, kpis.GetProperty("activeStudents").GetInt32());
        Assert.Equal(1, kpis.GetProperty("passiveAccounts").GetInt32());
        Assert.Equal(1, kpis.GetProperty("activeTeachers").GetInt32());
        Assert.Equal(2, kpis.GetProperty("activeClasses").GetInt32());
    }

    [Fact]
    public async Task Kpis_AreNull_WhenModuleIsNotEntitled()
    {
        await SeedAsync();
        var controller = CreateController(TenantA); // hiçbir modül açık değil

        var kpis = KpisOf(await controller.Get(null, null, CancellationToken.None));

        Assert.Equal(JsonValueKind.Null, kpis.GetProperty("collections").ValueKind);
        Assert.Equal(JsonValueKind.Null, kpis.GetProperty("overdueLoans").ValueKind);
        Assert.Equal(JsonValueKind.Null, kpis.GetProperty("unreadMessages").ValueKind);
        Assert.Equal(JsonValueKind.Null, kpis.GetProperty("attendanceRate").ValueKind);
    }

    [Fact]
    public async Task Kpis_AreComputed_WhenModuleIsEntitled()
    {
        await SeedAsync();
        var controller = CreateController(TenantA, "finance", "library", "chat");

        var kpis = KpisOf(await controller.Get(null, null, CancellationToken.None));

        Assert.Equal(1500m, kpis.GetProperty("collections").GetDecimal());
        Assert.Equal(1, kpis.GetProperty("overdueLoans").GetInt32());
        Assert.Equal(3, kpis.GetProperty("unreadMessages").GetInt32());
    }

    [Fact]
    public async Task InvalidRange_IsRejected()
    {
        await SeedAsync();
        var controller = CreateController(TenantA);

        var result = await controller.Get(DateTime.UtcNow, DateTime.UtcNow.AddDays(-1), CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    public void Dispose() => db.Dispose();
}
