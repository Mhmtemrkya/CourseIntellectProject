using System.Security.Claims;
using CourseIntellect.Api.Controllers;
using CourseIntellect.Domain.Entities;
using Xunit;

namespace CourseIntellect.Tests;

public sealed class BranchFinanceAuthorizationTests
{
    [Fact]
    public void BranchManager_CannotAttributePaymentToAnotherBranch()
    {
        var own = Guid.NewGuid();
        var other = new OrgUnit { Id = Guid.NewGuid(), IsActive = true, UnitType = "Şube" };
        var actor = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.Role, "BranchManager"), new Claim("branch_id", own.ToString())], "test"));

        Assert.False(DrivingFinanceController.CanAttributePaymentToBranch(actor, other));
    }

    [Theory]
    [InlineData(false, "Şube")]
    [InlineData(true, "Departman")]
    public void InactiveOrNonBranchOrgUnit_IsRejected(bool active, string type)
    {
        var branch = new OrgUnit { Id = Guid.NewGuid(), IsActive = active, UnitType = type };
        var admin = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Role, "Admin")], "test"));
        Assert.False(DrivingFinanceController.CanAttributePaymentToBranch(admin, branch));
    }
}
