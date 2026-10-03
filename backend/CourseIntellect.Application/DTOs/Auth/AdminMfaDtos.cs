using System.ComponentModel.DataAnnotations;

namespace CourseIntellect.Application.DTOs.Auth;

public sealed record AdminMfaStartResponse(string ChallengeToken, DateTime ExpiresAtUtc, string EmailHint);
public sealed record AdminMfaVerifyRequest(
    [Required, StringLength(64, MinimumLength = 64)] string ChallengeToken,
    [Required, RegularExpression("^[0-9]{6}$")] string Code);
public sealed record AdminMfaLoginResponse(LoginResponse Session);
