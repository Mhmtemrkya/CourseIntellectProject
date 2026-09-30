using System.Reflection;
using CourseIntellect.Api.Controllers;
using Microsoft.AspNetCore.Authorization;

namespace CourseIntellect.Tests;

public sealed class CustomRoleMyEndpointAuthTests
{
    [Fact]
    public void MyEndpoint_IsOpenToEveryAuthenticatedRole_WhileManagementStaysAdminOnly()
    {
        // Sınıf düzeyindeki Roles="Admin", eylemdeki [Authorize] ile gevşetilemez;
        // /my bu yüzden rol kısıtı olmayan ayrı controller'da durmalı.
        var myRoles = typeof(MyCustomRoleController).GetCustomAttributes<AuthorizeAttribute>(inherit: true)
            .Concat(typeof(MyCustomRoleController).GetMethod(nameof(MyCustomRoleController.GetMy))!.GetCustomAttributes<AuthorizeAttribute>())
            .Select(attribute => attribute.Roles)
            .ToList();
        Assert.NotEmpty(myRoles);
        Assert.All(myRoles, roles => Assert.True(string.IsNullOrEmpty(roles)));

        var adminRoles = typeof(CustomRolesController).GetCustomAttribute<AuthorizeAttribute>()!.Roles;
        Assert.Equal("Admin", adminRoles);
        Assert.Null(typeof(CustomRolesController).GetMethod("GetMy"));
    }
}
