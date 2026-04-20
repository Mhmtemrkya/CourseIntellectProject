using CourseIntellect.Application.DTOs.Auth;
using CourseIntellect.Application.DTOs.LoginAttempts;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AuthService(
    CourseIntellectDbContext dbContext,
    IJwtTokenService jwtTokenService,
    IPasswordHasher passwordHasher,
    ILoginAttemptService loginAttemptService) : IAuthService
{
    public async Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var user = await dbContext.Users
            .FirstOrDefaultAsync(x => x.Username.ToLower() == request.Username.ToLower(), cancellationToken);

        if (user is null || !passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            await loginAttemptService.CreateAsync(new CreateLoginAttemptRequest(
                user?.Id,
                request.Username,
                user?.PrimaryRole.ToString() ?? string.Empty,
                false,
                string.Empty,
                string.Empty,
                string.Empty), cancellationToken);

            return null;
        }

        await loginAttemptService.CreateAsync(new CreateLoginAttemptRequest(
            user.Id,
            user.Username,
            user.PrimaryRole.ToString(),
            true,
            string.Empty,
            string.Empty,
            string.Empty), cancellationToken);

        user.LastLoginAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        var response = await CreateLoginResponseAsync(user, cancellationToken);
        return response;
    }

    public async Task<LoginResponse?> RefreshAsync(RefreshTokenRequest request, CancellationToken cancellationToken = default)
    {
        var tokenHash = HashRefreshToken(request.RefreshToken);
        var session = await dbContext.RefreshTokenSessions
            .FirstOrDefaultAsync(x => x.TokenHash == tokenHash && x.RevokedAtUtc == null, cancellationToken);

        if (session is null || session.ExpiresAtUtc <= DateTime.UtcNow)
        {
            return null;
        }

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == session.UserId, cancellationToken);
        if (user is null)
        {
            return null;
        }

        session.RevokedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return await CreateLoginResponseAsync(user, cancellationToken);
    }

    private async Task<LoginResponse> CreateLoginResponseAsync(AppUser user, CancellationToken cancellationToken)
    {
        var accessToken = jwtTokenService.CreateToken(user);
        var expiresAtUtc = DateTime.UtcNow.AddMinutes(jwtTokenService.AccessTokenMinutes);
        var refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        var refreshTokenExpiresAtUtc = DateTime.UtcNow.AddDays(jwtTokenService.RefreshTokenDays);

        dbContext.RefreshTokenSessions.Add(new RefreshTokenSession
        {
            UserId = user.Id,
            TokenHash = HashRefreshToken(refreshToken),
            ExpiresAtUtc = refreshTokenExpiresAtUtc,
            CreatedAtUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        var currentUser = await CreateCurrentUserDtoAsync(user, cancellationToken);

        return new LoginResponse(
            accessToken,
            expiresAtUtc,
            refreshToken,
            refreshTokenExpiresAtUtc,
            currentUser);
    }

    public async Task<LoginResponse?> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
    {
        var exists = await dbContext.Users
            .AnyAsync(x => x.Username.ToLower() == request.Username.ToLower(), cancellationToken);

        if (exists) return null;

        if (!Enum.TryParse<Domain.Enums.UserRole>(request.Role, true, out var role))
            role = Domain.Enums.UserRole.Student;
        if (role == Domain.Enums.UserRole.Developer)
            role = Domain.Enums.UserRole.Student;

        var user = new AppUser
        {
            FullName = request.FullName,
            Username = request.Username,
            PasswordHash = passwordHasher.Hash(request.Password),
            PrimaryRole = role,
            Campus = request.Campus,
            Status = Domain.Enums.UserStatus.Active,
            IsEmailVerified = false,
            CreatedAtUtc = DateTime.UtcNow
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        return await CreateLoginResponseAsync(user, cancellationToken);
    }

    public async Task<CurrentUserDto?> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null) return null;

        return await CreateCurrentUserDtoAsync(user, cancellationToken);
    }

    public async Task<CurrentUserDto?> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken cancellationToken = default)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null) return null;

        var fullName = request.FullName.Trim();
        if (string.IsNullOrEmpty(fullName)) return null;

        user.FullName = fullName;
        user.Campus = request.Campus.Trim();
        user.DepartmentOrBranch = request.DepartmentOrBranch.Trim();

        await dbContext.SaveChangesAsync(cancellationToken);
        return await CreateCurrentUserDtoAsync(user, cancellationToken);
    }

    private async Task<CurrentUserDto> CreateCurrentUserDtoAsync(AppUser user, CancellationToken cancellationToken)
    {
        var tenant = user.TenantId.HasValue
            ? await dbContext.TenantWorkspaces
                .AsNoTracking()
                .Where(x => x.Id == user.TenantId.Value)
                .Select(x => new { x.Id, x.Name, x.Slug })
                .SingleOrDefaultAsync(cancellationToken)
            : null;

        var isPlatformAdmin = user.PrimaryRole == UserRole.Developer && user.TenantId is null;

        return new CurrentUserDto(
            user.Id,
            user.FullName,
            user.Username,
            user.PrimaryRole.ToString(),
            user.ExtraRoles.Select(x => x.ToString()).ToList(),
            user.Status.ToString(),
            user.Campus,
            user.DepartmentOrBranch,
            tenant?.Id,
            tenant?.Name,
            tenant?.Slug,
            isPlatformAdmin);
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var tokenHash = HashRefreshToken(refreshToken);
        var session = await dbContext.RefreshTokenSessions
            .FirstOrDefaultAsync(x => x.TokenHash == tokenHash && x.RevokedAtUtc == null, cancellationToken);

        if (session is not null)
        {
            session.RevokedAtUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<PkceAuthorizeResponse?> PkceAuthorizeAsync(PkceAuthorizeRequest request, CancellationToken cancellationToken = default)
    {
        var allowedClients = new[] { "desktop", "mobile" };
        if (!allowedClients.Contains(request.ClientId, StringComparer.OrdinalIgnoreCase))
            return null;

        if (request.CodeChallengeMethod != "S256")
            return null;

        var user = await dbContext.Users
            .FirstOrDefaultAsync(x => x.Username.ToLower() == request.Username.ToLower(), cancellationToken);

        if (user is null || !passwordHasher.Verify(request.Password, user.PasswordHash))
            return null;

        var code = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

        dbContext.AuthorizationCodes.Add(new AuthorizationCode
        {
            Code = code,
            UserId = user.Id,
            ClientId = request.ClientId,
            RedirectUri = request.RedirectUri,
            CodeChallengeHash = request.CodeChallenge,
            CreatedAtUtc = DateTime.UtcNow,
            ExpiresAtUtc = DateTime.UtcNow.AddMinutes(5)
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        return new PkceAuthorizeResponse(code, request.RedirectUri);
    }

    public async Task<LoginResponse?> PkceTokenExchangeAsync(PkceTokenRequest request, CancellationToken cancellationToken = default)
    {
        var authCode = await dbContext.AuthorizationCodes
            .FirstOrDefaultAsync(x => x.Code == request.Code && !x.IsUsed, cancellationToken);

        if (authCode is null || authCode.ExpiresAtUtc <= DateTime.UtcNow)
            return null;

        if (authCode.ClientId != request.ClientId || authCode.RedirectUri != request.RedirectUri)
            return null;

        // Verify PKCE: SHA256(code_verifier) must match stored code_challenge
        var computedChallenge = Base64UrlEncode(SHA256.HashData(System.Text.Encoding.ASCII.GetBytes(request.CodeVerifier)));
        if (computedChallenge != authCode.CodeChallengeHash)
            return null;

        authCode.IsUsed = true;
        await dbContext.SaveChangesAsync(cancellationToken);

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == authCode.UserId, cancellationToken);
        if (user is null)
            return null;

        return await CreateLoginResponseAsync(user, cancellationToken);
    }

    private static string HashRefreshToken(string token)
    {
        var bytes = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token));
        return Convert.ToBase64String(bytes);
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}
