using System.Security.Claims;
using CourseIntellect.Api.Controllers;
using CourseIntellect.Api.Hubs;
using Xunit;

namespace CourseIntellect.Tests;

public sealed class ExamSolvingHubAuthorizationTests
{
    [Fact]
    public void SameTenantStudent_CannotJoinAnotherStudentsSession()
    {
        var session = new ExamSessionSnapshot { Id = Guid.NewGuid(), StudentUsername = "owner", Status = "Active" };
        var stranger = User("Student", "stranger");

        Assert.False(ExamSolvingHub.CanJoinExamSession(stranger, session));
        Assert.True(ExamSolvingHub.CanJoinExamSession(User("Student", "owner"), session));
    }

    [Fact]
    public void WrongRoleAndCompletedSession_FailClosed()
    {
        var active = new ExamSessionSnapshot { Id = Guid.NewGuid(), StudentUsername = "owner", Status = "Active" };
        var completed = new ExamSessionSnapshot { Id = Guid.NewGuid(), StudentUsername = "owner", Status = "Completed" };

        Assert.False(ExamSolvingHub.CanJoinExamSession(User("Accounting", "accounting"), active));
        Assert.False(ExamSolvingHub.CanJoinExamSession(User("Student", "owner"), completed));
    }

    private static ClaimsPrincipal User(string role, string username) => new(new ClaimsIdentity([
        new Claim(ClaimTypes.Role, role),
        new Claim("unique_name", username),
    ], "test"));
}
