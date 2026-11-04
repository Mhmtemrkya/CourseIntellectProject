using CourseIntellect.Api.Security;
using CourseIntellect.Application.DTOs.ExamResults;
using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

public sealed class ExecutableUrlFilterTests
{
    private sealed record Nested(string Title, string? MeetingLink);
    private sealed record Payload(string Name, string? PhotoUrl, IReadOnlyList<Nested> Items);

    [Theory]
    [InlineData("javascript:alert(1)", true)]
    [InlineData(" JavaScript:alert(1)", true)]
    [InlineData("java\tscript:alert(1)", true)]
    [InlineData("vbscript:msgbox", true)]
    [InlineData("data:text/html,<script>alert(1)</script>", true)]
    [InlineData("data:image/svg+xml,<svg onload=alert(1)>", true)]
    [InlineData("data:image/png;base64,AAAA", false)]
    [InlineData("/uploads/student-photos/a.jpg", false)]
    [InlineData("https://meet.example.com/x", false)]
    [InlineData("courseintellect://callback", false)]
    [InlineData("", false)]
    public void IsExecutable_flags_script_capable_urls(string url, bool expected) =>
        Assert.Equal(expected, SafeUrlRules.IsExecutable(url));

    [Fact]
    public void Finds_nested_link_fields_but_ignores_ordinary_text()
    {
        // Tip adları CourseIntellect ad alanında olduğundan taranır.
        var clean = new Payload("javascript: metin, bağlantı değil", "/uploads/a.png", [new Nested("x", "https://ok")]);
        Assert.Null(ExecutableUrlFilter.FindExecutableUrl(clean, "", 0));

        var dirty = new Payload("Ali", null, [new Nested("x", "https://ok"), new Nested("y", "javascript:alert(1)")]);
        Assert.Equal("Items[1].MeetingLink", ExecutableUrlFilter.FindExecutableUrl(dirty, "", 0));
    }

    [Fact]
    public void Real_request_dto_without_links_passes()
    {
        var request = new CreateExamResultRequest("Deneme", "MockExam", "Matematik", "01.11.2026", "Ali", "10-A", 80, 0m);
        Assert.Null(ExecutableUrlFilter.FindExecutableUrl(request, "", 0));
    }
}
