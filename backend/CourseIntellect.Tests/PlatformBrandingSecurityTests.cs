using System.Security.Claims;
using CourseIntellect.Application.DTOs.PlatformConfigurations;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Http;

namespace CourseIntellect.Tests;

public sealed class PlatformBrandingSecurityTests : IDisposable
{
    private readonly TestDb db = new();

    [Fact]
    public async Task TenantAdmin_CannotWriteAnotherTenantsBranding()
    {
        var ownTenantId = Guid.NewGuid();
        var otherTenantId = Guid.NewGuid();
        db.Context.TenantWorkspaces.AddRange(Workspace(ownTenantId), Workspace(otherTenantId));
        var user = new AppUser
        {
            TenantId = ownTenantId,
            FullName = "Kurum Yöneticisi",
            Username = $"owner-{Guid.NewGuid():N}",
        };
        db.Context.Users.Add(user);
        await db.Context.SaveChangesAsync();
        var service = CreateService(user.Id, "Admin");

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.UpsertAsync(Request(otherTenantId)));
    }

    [Fact]
    public async Task TenantAdmin_CanWriteOwnBranding()
    {
        var tenantId = Guid.NewGuid();
        db.Context.TenantWorkspaces.Add(Workspace(tenantId));
        var user = new AppUser
        {
            TenantId = tenantId,
            FullName = "Kurum Yöneticisi",
            Username = $"owner-{Guid.NewGuid():N}",
        };
        db.Context.Users.Add(user);
        await db.Context.SaveChangesAsync();
        var service = CreateService(user.Id, "Admin");

        var saved = await service.UpsertAsync(Request(tenantId));

        Assert.Equal(tenantId.ToString(), saved.ScopeKey);
        Assert.Single(db.Context.Set<PlatformConfiguration>());
    }

    [Fact]
    public async Task PlatformAdmin_CanWriteSelectedTenantsBranding()
    {
        var targetTenantId = Guid.NewGuid();
        db.Context.TenantWorkspaces.Add(Workspace(targetTenantId));
        await db.Context.SaveChangesAsync();
        var accessor = new HttpContextAccessor
        {
            HttpContext = Context(Guid.NewGuid(), "Developer", platformAdmin: true),
        };
        var service = new PlatformConfigurationService(db.Context, accessor);

        var saved = await service.UpsertAsync(Request(targetTenantId));

        Assert.Equal(targetTenantId.ToString(), saved.ScopeKey);
    }

    private PlatformConfigurationService CreateService(Guid userId, string role)
    {
        var accessor = new HttpContextAccessor
        {
            HttpContext = Context(userId, role, platformAdmin: false),
        };
        return new PlatformConfigurationService(db.Context, accessor);
    }

    private static DefaultHttpContext Context(Guid userId, string role, bool platformAdmin)
    {
        var context = new DefaultHttpContext();
        context.User = new ClaimsPrincipal(new ClaimsIdentity(
            new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim("role", role),
                new Claim("platform_admin", platformAdmin ? "true" : "false"),
            },
            "test",
            ClaimTypes.Name,
            "role"));
        return context;
    }

    private static UpsertPlatformConfigurationRequest Request(Guid tenantId) =>
        new(
            "tenant-customization",
            tenantId.ToString(),
            $"SA_TENANT_CUSTOMIZATION::{tenantId}",
            """{"logoUrl":"/uploads/tenant-branding/test/logo.png"}""");

    private static TenantWorkspace Workspace(Guid id) => new()
    {
        Id = id,
        Name = $"Kurum {id:N}",
        Slug = $"kurum-{id:N}",
        ContactEmail = "owner@example.test",
        ContactName = "Kurum Sahibi",
        Plan = "Standard",
        Status = "Active",
    };
    // Dispose pattern to clean up the test database context
    public void Dispose() => db.Dispose();
}
