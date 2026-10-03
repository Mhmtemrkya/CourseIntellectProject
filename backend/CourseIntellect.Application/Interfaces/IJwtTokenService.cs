using CourseIntellect.Domain.Entities;

namespace CourseIntellect.Application.Interfaces;

public interface IJwtTokenService
{
    string CreateToken(AppUser user);
    string CreateAdminMfaToken(AppUser user, Guid sessionId) => throw new NotSupportedException("MFA token issuance is not available.");
    int AccessTokenMinutes { get; }
    int RefreshTokenDays { get; }
}
