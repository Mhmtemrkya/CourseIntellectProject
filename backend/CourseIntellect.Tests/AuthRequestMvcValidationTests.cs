using CourseIntellect.Application.DTOs.Auth;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace CourseIntellect.Tests;

public sealed class AuthRequestMvcValidationTests
{
    [Theory]
    [InlineData("", "password", false)]
    [InlineData("admin@example.invalid", "", false)]
    [InlineData("admin@example.invalid", "password", true)]
    public void LoginUsesMvcRecordValidation(string username, string password, bool valid)
        => Assert.Equal(valid, Validate(new LoginRequest(username, password)).IsValid);

    [Fact]
    public void LoginRejectsOversizedCredentials()
    {
        Assert.False(Validate(new LoginRequest(new string('a', 255), "password")).IsValid);
        Assert.False(Validate(new LoginRequest("admin@example.invalid", new string('a', 1025))).IsValid);
    }

    [Theory]
    [InlineData(64, "123456", true)]
    [InlineData(63, "123456", false)]
    [InlineData(65, "123456", false)]
    [InlineData(64, "12345", false)]
    [InlineData(64, "abcdef", false)]
    [InlineData(64, "", false)]
    public void CodeVerificationUsesMvcRecordValidation(int tokenLength, string code, bool valid)
        => Assert.Equal(valid, Validate(new AdminMfaVerifyRequest(new string('A', tokenLength), code)).IsValid);

    private static ModelStateDictionary Validate(object request)
    {
        // Exercise MVC's validator rather than direct service calls: property-targeted
        // annotations on positional records otherwise throw before the controller runs.
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddControllers();
        using var provider = services.BuildServiceProvider();
        var context = new ActionContext(new DefaultHttpContext { RequestServices = provider },
            new RouteData(), new ActionDescriptor(), new ModelStateDictionary());
        provider.GetRequiredService<IObjectModelValidator>().Validate(context, null, "", request);
        return context.ModelState;
    }
}
