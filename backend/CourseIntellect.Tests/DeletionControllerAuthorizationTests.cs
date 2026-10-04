using System.Reflection;
using CourseIntellect.Api.Controllers;
using Microsoft.AspNetCore.Authorization;

namespace CourseIntellect.Tests;

/// <summary>
/// Silme controller'larının yetki attribute'leri (görev: yetkilendirmeyi doğrula).
/// Attribute kayması güvenlik açığıdır; bu test sapmayı yakalar.
/// </summary>
public sealed class DeletionControllerAuthorizationTests
{
    [Fact]
    public void AccountDeletionController_RequiresAuth_AndRoleGatedQueues()
    {
        // Sınıf düzeyinde [Authorize] (her kimliği doğrulanmış kullanıcı kendi talebini açar).
        Assert.NotNull(typeof(AccountDeletionController).GetCustomAttribute<AuthorizeAttribute>());

        // successor-candidates yalnız Admin.
        Assert.Equal("Admin", MethodAuthorize(typeof(AccountDeletionController), "GetSuccessorCandidates").Roles);
        // Kurum kuyruğu yalnız Admin/Administrative (yalnız görüntüleme).
        Assert.Equal("Admin,Administrative", MethodAuthorize(typeof(AccountDeletionController), "GetTenantQueue").Roles);
    }

    [Fact]
    public void InstitutionDeletionController_IsAdminOnly()
    {
        var attr = typeof(InstitutionDeletionController).GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(attr);
        Assert.Equal("Admin", attr!.Roles);
    }

    [Fact]
    public void PlatformDeletionController_RequiresPlatformAdminPolicy()
    {
        var attr = typeof(PlatformDeletionController).GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(attr);
        Assert.Equal("PlatformAdmin", attr!.Policy);
    }

    private static AuthorizeAttribute MethodAuthorize(Type controller, string method)
    {
        var attr = controller.GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(attr);
        return attr!;
    }
}
