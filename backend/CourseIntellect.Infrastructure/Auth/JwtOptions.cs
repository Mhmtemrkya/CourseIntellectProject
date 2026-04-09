namespace CourseIntellect.Infrastructure.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; init; } = "CourseIntellect";
    public string Audience { get; init; } = "CourseIntellectClients";
    public string Key { get; init; } = "CourseIntellect-Super-Secret-Key-Change-In-Production-2026";
    public int AccessTokenMinutes { get; init; } = 480;
    public int RefreshTokenDays { get; init; } = 14;
}
