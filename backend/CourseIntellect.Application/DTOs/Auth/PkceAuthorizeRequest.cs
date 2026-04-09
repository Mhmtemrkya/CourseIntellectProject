namespace CourseIntellect.Application.DTOs.Auth;

public sealed record PkceAuthorizeRequest(
    string Username,
    string Password,
    string ClientId,
    string RedirectUri,
    string CodeChallenge,
    string CodeChallengeMethod
);
