using CourseIntellect.Domain.Entities;

namespace CourseIntellect.Application.Interfaces;

public interface IJwtTokenService
{
    string CreateToken(AppUser user);
    int AccessTokenMinutes { get; }
    int RefreshTokenDays { get; }
}
