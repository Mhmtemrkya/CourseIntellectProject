using System.ComponentModel.DataAnnotations;
using CourseIntellect.Api.Controllers;
using CourseIntellect.Application.DTOs.ContactMessages;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CourseIntellect.Tests;
public sealed class ContactFormSecurityTests : IDisposable
{
    private readonly TestDb db = new();
    private sealed class Captcha(bool success) : ICaptchaVerificationService
    {
        public Task<CaptchaVerificationResult> VerifyAsync(string? token, string? remoteIp, CancellationToken ct = default)
            => Task.FromResult(new CaptchaVerificationResult(success ? CaptchaVerificationStatus.Success : CaptchaVerificationStatus.Failed));
    }
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Contact_submission_requires_server_side_captcha(bool allowed)
    {
        var controller = new ContactMessagesController(new ContactMessageService(db.Context), new Captcha(allowed))
            { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
        var result = await controller.Create(new CreateContactMessageRequest("Demo User", "demo@example.test",
            "Platform sorusu", "Kurum kaydı hakkında bilgi istiyorum.", "captcha"), CancellationToken.None);
        if (allowed) { Assert.IsType<OkObjectResult>(result); Assert.Single(db.Context.ContactMessages); }
        else { Assert.IsType<BadRequestObjectResult>(result); Assert.Empty(db.Context.ContactMessages); }
    }
    [Theory]
    [InlineData("not-email", 50)]
    [InlineData("demo@example.test", 2001)]
    public void Invalid_email_or_oversized_message_is_rejected_by_api_validation(string email, int size)
    {
        var request = new CreateContactMessageRequest("Demo", email, "Destek", new string('x', size));
        Assert.False(Validator.TryValidateObject(request, new ValidationContext(request), [], true));
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddControllers();
        using var provider = services.BuildServiceProvider();
        var context = new ActionContext(new DefaultHttpContext { RequestServices = provider }, new RouteData(), new ActionDescriptor());
        provider.GetRequiredService<IObjectModelValidator>().Validate(context, null, "", request);
        Assert.False(context.ModelState.IsValid);
    }
    public void Dispose() => db.Dispose();
}
