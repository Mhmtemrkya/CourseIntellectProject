namespace CourseIntellect.Application.DTOs.Auth;

public sealed record PkceAuthorizeResponse(string Code, string RedirectUri);
