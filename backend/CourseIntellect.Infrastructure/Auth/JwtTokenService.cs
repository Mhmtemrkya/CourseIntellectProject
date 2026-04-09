using System.Security.Claims;
using System.Text;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace CourseIntellect.Infrastructure.Auth;

public sealed class JwtTokenService(IOptions<JwtOptions> options) : IJwtTokenService
{
    private readonly JwtOptions _options = options.Value;

    // JWT standard kısa claim adları — mapping karmaşasını önler
    private const string RoleClaim = "role";
    private const string NameClaim = "name";
    private const string NameIdClaim = "nameid";

    // .NET 8+'da token OKUMA tarafında JsonWebTokenHandler kullanılır.
    // Token YAZMA tarafında da aynı handler'ı kullanmak tutarlılık sağlar
    // ve JwtSecurityTokenHandler'ın OutboundClaimTypeMap sorunlarını önler.
    private static readonly JsonWebTokenHandler s_handler = new()
    {
        MapInboundClaims = false,
        SetDefaultTimesOnTokenCreation = false
    };

    public string CreateToken(AppUser user)
    {
        var claims = new Dictionary<string, object>
        {
            [JwtRegisteredClaimNames.Sub] = user.Id.ToString(),
            [JwtRegisteredClaimNames.UniqueName] = user.Username,
            [NameIdClaim] = user.Id.ToString(),
            [NameClaim] = user.FullName,
        };

        // Rol claim'leri — tek rol varsa string, birden fazla varsa array olarak ekle
        var allRoles = new List<string> { user.PrimaryRole.ToString() };
        allRoles.AddRange(user.ExtraRoles.Select(r => r.ToString()));

        if (allRoles.Count == 1)
        {
            claims[RoleClaim] = allRoles[0];
        }
        else
        {
            claims[RoleClaim] = allRoles;
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key));

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            Expires = DateTime.UtcNow.AddMinutes(_options.AccessTokenMinutes),
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256),
            Claims = claims
        };

        return s_handler.CreateToken(descriptor);
    }

    public int AccessTokenMinutes => _options.AccessTokenMinutes;
    public int RefreshTokenDays => _options.RefreshTokenDays;
}
