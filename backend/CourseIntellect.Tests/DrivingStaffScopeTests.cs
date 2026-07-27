using System.Security.Claims;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

public sealed class DrivingStaffScopeTests : IDisposable
{
    private readonly SqliteConnection connection = new("DataSource=:memory:");
    private readonly HttpContextAccessor accessor = new();
    private readonly CourseIntellectDbContext db;

    public DrivingStaffScopeTests()
    {
        connection.Open();
        var options = new DbContextOptionsBuilder<CourseIntellectDbContext>()
            .UseSqlite(connection)
            .Options;
        db = new CourseIntellectDbContext(options, accessor);
        db.Database.EnsureCreated();
    }

    [Fact]
    public async Task BranchAccount_SeesOwnBranchAndSharedStaff_WithoutCrossTenantLeak()
    {
        var tenantId = Guid.NewGuid();
        var otherTenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var otherBranchId = Guid.NewGuid();

        db.TenantWorkspaces.AddRange(
            new TenantWorkspace { Id = tenantId, Name = "Kurum", Slug = $"kurum-{Guid.NewGuid():N}", Status = "active" },
            new TenantWorkspace { Id = otherTenantId, Name = "Başka Kurum", Slug = $"baska-{Guid.NewGuid():N}", Status = "active" });

        db.Staff.AddRange(
            Staff("Aynı Şube", tenantId, branchId),
            Staff("Ortak Eğitmen", tenantId, null),
            Staff("Başka Şube", tenantId, otherBranchId),
            Staff("Başka Kurum", otherTenantId, null));
        await db.SaveChangesAsync();

        accessor.HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
            [
                new Claim("tenant_id", tenantId.ToString()),
                new Claim("branch_id", branchId.ToString()),
                new Claim(ClaimTypes.Role, "BranchManager"),
            ], "test")),
        };

        var names = await db.VisibleDrivingStaff()
            .OrderBy(x => x.FullName)
            .Select(x => x.FullName)
            .ToListAsync();

        Assert.Equal(["Aynı ŞUBE", "Ortak EĞİTMEN"], names);
    }

    private static StaffProfile Staff(string name, Guid tenantId, Guid? branchId) => new()
    {
        TenantId = tenantId,
        BranchId = branchId,
        UserId = Guid.NewGuid(),
        FullName = name,
        TcNo = string.Empty,
        DepartmentOrBranch = "Direksiyon",
        Role = UserRole.Teacher,
    };

    public void Dispose()
    {
        db.Dispose();
        connection.Dispose();
    }
}
