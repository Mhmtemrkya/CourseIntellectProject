namespace CourseIntellect.Application.DTOs.Auth;

public sealed record PkceTokenRequest(
    string Code,
    string CodeVerifier,
    string ClientId,
    string RedirectUri
);
