using CourseIntellect.Application.DTOs.Auth;
using CourseIntellect.Application.DTOs.LoginAttempts;
using CourseIntellect.Application.Exceptions;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Auth;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Security.Claims;
using System.Text.Json;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AuthService(
    CourseIntellectDbContext dbContext,
    IJwtTokenService jwtTokenService,
    IPasswordHasher passwordHasher,
    ILoginAttemptService loginAttemptService,
    ISystemService systemService,
    IHttpContextAccessor httpContextAccessor,
    Microsoft.Extensions.Configuration.IConfiguration configuration) : IAuthService
{
    private const string PasswordResetPending = "Pending";
    private const string PasswordResetApproved = "Approved";
    private const string PasswordResetRejected = "Rejected";
    private const string PasswordResetUsed = "Used";
    private const string PasswordResetExpired = "Expired";

    // Hesap kilitleme: bir kullanıcı adı için pencere içinde eşik kadar başarısız
    // deneme olursa geçici olarak kilitlenir. Son başarılı girişten sonrası sayılır.
    private readonly int _lockoutMaxFailed =
        int.TryParse(configuration["Auth:Lockout:MaxFailedAttempts"], out var m) ? m : 5;
    private readonly int _lockoutWindowMinutes =
        int.TryParse(configuration["Auth:Lockout:WindowMinutes"], out var w) ? w : 15;

    public async Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var login = request.Username.Trim().ToLowerInvariant();

        // ── Hesap kilitleme kontrolü (parola doğrulamadan ÖNCE) ──────────────
        // Kilitliyse doğru parola bile reddedilir ve yeni başarısız kayıt EKLENMEZ
        // (aksi halde kilit süresi sonsuza kadar uzardı; pencere zamanla iyileşir).
        if (_lockoutMaxFailed > 0 && await IsLockedOutAsync(login, cancellationToken))
        {
            throw new AccountLockedException(_lockoutWindowMinutes);
        }

        var user = await dbContext.Users
            .FirstOrDefaultAsync(x => x.Username.ToLower() == login, cancellationToken);

        if (user is null && login.Contains('@'))
        {
            var staffUserId = await dbContext.Staff
                .Where(x => x.Email.ToLower() == login)
                .Select(x => (Guid?)x.UserId)
                .FirstOrDefaultAsync(cancellationToken);

            if (staffUserId.HasValue)
            {
                user = await dbContext.Users
                    .FirstOrDefaultAsync(x => x.Id == staffUserId.Value, cancellationToken);
            }
        }

        // Pasif hesap giriş yapamaz (durum /api/users/{username}/status ile yönetilir).
        if (user is not null && user.Status != UserStatus.Active)
        {
            user = null;
        }

        if (user is null || !passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            await RecordLoginAttemptAsync(login, user?.Id, user?.PrimaryRole.ToString() ?? string.Empty, false, user?.TenantId, cancellationToken);
            return null;
        }

        if (await ExpireApprovedPasswordResetIfNeededAsync(user, cancellationToken))
        {
            await RecordLoginAttemptAsync(login, user.Id, user.PrimaryRole.ToString(), false, user.TenantId, cancellationToken);
            return null;
        }

        // Bakım modu açıksa sadece platform admin (Developer + tenantId yok) login olabilir
        var isPlatformAdmin = user.PrimaryRole == UserRole.Developer && user.TenantId is null;
        if (!isPlatformAdmin)
        {
            var maintenanceActive = await systemService.IsMaintenanceActiveAsync(cancellationToken);
            if (maintenanceActive)
            {
                throw new MaintenanceModeException(
                    "Sistem şu anda bakımda. Lütfen daha sonra tekrar deneyin.");
            }
        }

        await RecordLoginAttemptAsync(login, user.Id, user.PrimaryRole.ToString(), true, user.TenantId, cancellationToken);

        user.LastLoginAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        var response = await CreateLoginResponseAsync(user, cancellationToken);
        return response;
    }

    // Kilit anahtarı: denenen (normalize edilmiş) kullanıcı adı/e-posta.
    // Politika: son pencere (dakika) içinde eşik kadar başarısız deneme olursa hesap
    // kilitlidir; en eski başarısız deneme pencereden düştükçe kilit kendiliğinden açılır.
    private async Task<bool> IsLockedOutAsync(string login, CancellationToken cancellationToken)
    {
        var windowStart = DateTimeOffset.UtcNow.AddMinutes(-_lockoutWindowMinutes);

        // Zaman penceresi karşılaştırması bellekte yapılır: DateTimeOffset SQL çevirisi
        // sağlayıcıya göre değişir (Postgres destekler, SQLite etmez). E-posta+başarısızlık
        // filtresi SQL'de kalır; tek hesabın başarısız denemeleri pratikte küçük bir kümedir.
        // IgnoreQueryFilters ŞART: kilitleme bir güvenlik kontrolüdür ve giriş anında
        // henüz oturum/kurum bağlamı yoktur. Tenant filtresine tabi bırakılırsa
        // başarısız denemeler görünmez olur ve kilit hiç devreye girmez.
        var failureTimes = await dbContext.LoginAttempts
            .IgnoreQueryFilters()
            .Where(x => x.Email.ToLower() == login && !x.Success)
            .Select(x => x.Timestamp)
            .ToListAsync(cancellationToken);

        var recentFailures = failureTimes.Count(ts => ts > windowStart);
        return recentFailures >= _lockoutMaxFailed;
    }

    private Task RecordLoginAttemptAsync(
        string login, Guid? userId, string role, bool success, Guid? tenantId, CancellationToken cancellationToken)
    {
        var context = httpContextAccessor.HttpContext;
        var ip = context?.Connection.RemoteIpAddress?.ToString() ?? string.Empty;
        var userAgent = context?.Request.Headers.UserAgent.ToString() ?? string.Empty;

        return loginAttemptService.CreateAsync(new CreateLoginAttemptRequest(
            userId,
            login,
            role,
            success,
            ip,
            userAgent,
            string.Empty,
            tenantId), cancellationToken);
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
        // Pasif kullanıcı refresh ile de yeni token alamaz — yoksa pasifleştirme
        // refresh token ömrü boyunca (günler) etkisiz kalırdı.
        if (user is null || user.Status != UserStatus.Active)
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

    public async Task<CurrentUserDto?> ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken cancellationToken = default)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null) return null;

        var newPassword = (request.NewPassword ?? string.Empty).Trim();
        if (newPassword.Length < 8)
        {
            throw new InvalidOperationException("Yeni şifre en az 8 karakter olmalıdır.");
        }

        var hasUpper = newPassword.Any(char.IsUpper);
        var hasLower = newPassword.Any(char.IsLower);
        var hasDigit = newPassword.Any(char.IsDigit);
        if (!(hasUpper && hasLower && hasDigit))
        {
            throw new InvalidOperationException("Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermelidir.");
        }

        // İlk-giriş zorunlu değişimde mevcut şifre alanı boş gelebilir; bu durumda atla.
        // Diğer durumlarda mevcut şifre doğrulaması yapılır.
        if (!user.MustChangePassword)
        {
            var currentPassword = (request.CurrentPassword ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(currentPassword) || !passwordHasher.Verify(currentPassword, user.PasswordHash))
            {
                throw new InvalidOperationException("Mevcut şifre hatalı.");
            }
        }

        user.PasswordHash = passwordHasher.Hash(newPassword);
        user.MustChangePassword = false;

        var approvedReset = await dbContext.PasswordResetRequests
            .IgnoreQueryFilters()
            .Where(x => x.UserId == user.Id && x.Status == PasswordResetApproved)
            .OrderByDescending(x => x.ReviewedAtUtc ?? x.RequestedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (approvedReset is not null)
        {
            approvedReset.Status = PasswordResetUsed;
            approvedReset.UsedAtUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return await CreateCurrentUserDtoAsync(user, cancellationToken);
    }

    public async Task RequestPasswordResetAsync(ForgotPasswordRequest request, CancellationToken cancellationToken = default)
    {
        var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email))
        {
            return;
        }

        var userIds = new List<Guid>();

        userIds.AddRange(await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.Username.ToLower() == email)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken));

        userIds.AddRange(await dbContext.Staff
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.Email.ToLower() == email)
            .Select(x => x.UserId)
            .ToListAsync(cancellationToken));

        userIds.AddRange(await dbContext.Students
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.ParentEmail.ToLower() == email && x.ParentUserId != null)
            .Select(x => x.ParentUserId!.Value)
            .ToListAsync(cancellationToken));

        userIds = userIds.Distinct().ToList();
        if (userIds.Count == 0)
        {
            return;
        }

        var users = await dbContext.Users
            .IgnoreQueryFilters()
            .Where(x => userIds.Contains(x.Id) && x.Status == UserStatus.Active)
            .ToListAsync(cancellationToken);

        foreach (var user in users)
        {
            var hasPendingRequest = await dbContext.PasswordResetRequests
                .IgnoreQueryFilters()
                .AnyAsync(x => x.UserId == user.Id && x.Status == PasswordResetPending, cancellationToken);

            if (hasPendingRequest)
            {
                continue;
            }

            dbContext.PasswordResetRequests.Add(new PasswordResetRequest
            {
                TenantId = user.TenantId,
                UserId = user.Id,
                RequestedEmail = email,
                FullName = user.FullName,
                Username = user.Username,
                PrimaryRole = user.PrimaryRole.ToString(),
                Status = PasswordResetPending,
                RequestedAtUtc = DateTime.UtcNow
            });

            AddPasswordResetNotification(user, "Admin");
            AddPasswordResetNotification(user, "Administrative");
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<PasswordResetRequestDto>> GetPasswordResetRequestsAsync(string? status, CancellationToken cancellationToken = default)
    {
        var query = dbContext.PasswordResetRequests
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(x => x.Status == status);
        }

        return await query
            .OrderByDescending(x => x.RequestedAtUtc)
            .Take(200)
            .Select(x => new PasswordResetRequestDto(
                x.Id,
                x.UserId,
                x.RequestedEmail,
                x.FullName,
                x.Username,
                x.PrimaryRole,
                x.Status,
                x.ReviewNote,
                x.ReviewedByName,
                x.RequestedAtUtc,
                x.ReviewedAtUtc,
                x.ExpiresAtUtc,
                x.UsedAtUtc))
            .ToListAsync(cancellationToken);
    }

    public async Task<PasswordResetReviewResponse> ReviewPasswordResetRequestAsync(Guid id, ReviewPasswordResetRequest request, CancellationToken cancellationToken = default)
    {
        var resetRequest = await dbContext.PasswordResetRequests
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (resetRequest is null)
        {
            throw new InvalidOperationException("Şifre talebi bulunamadı.");
        }

        if (resetRequest.Status != PasswordResetPending)
        {
            throw new InvalidOperationException("Bu şifre talebi daha önce sonuçlandırılmış.");
        }

        var reviewer = await ResolveCurrentUserAsync(cancellationToken);
        var now = DateTime.UtcNow;
        resetRequest.ReviewNote = (request.Note ?? string.Empty).Trim();
        resetRequest.ReviewedAtUtc = now;
        resetRequest.ReviewedByUserId = reviewer?.Id;
        resetRequest.ReviewedByName = reviewer?.FullName ?? "Yetkili";

        if (!request.Approved)
        {
            resetRequest.Status = PasswordResetRejected;
            await dbContext.SaveChangesAsync(cancellationToken);

            return new PasswordResetReviewResponse(
                resetRequest.Id,
                resetRequest.Status,
                "Şifre sıfırlama talebi reddedildi.",
                null,
                null);
        }

        var user = await dbContext.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == resetRequest.UserId, cancellationToken);

        if (user is null || user.Status != UserStatus.Active)
        {
            throw new InvalidOperationException("Aktif kullanıcı bulunamadı.");
        }

        var currentTenantId = dbContext.CurrentTenantId;
        if (currentTenantId.HasValue && user.TenantId != currentTenantId.Value)
        {
            throw new InvalidOperationException("Bu kullanıcı kurum kapsamınızda değil.");
        }

        var temporaryPassword = PasswordGenerator.Generate(10);
        user.PasswordHash = passwordHasher.Hash(temporaryPassword);
        user.MustChangePassword = true;

        resetRequest.Status = PasswordResetApproved;
        resetRequest.TemporaryPasswordCreatedAtUtc = now;
        resetRequest.ExpiresAtUtc = now.AddHours(24);

        await dbContext.SaveChangesAsync(cancellationToken);

        return new PasswordResetReviewResponse(
            resetRequest.Id,
            resetRequest.Status,
            "Geçici şifre üretildi. Kullanıcı ilk girişte yeni şifre belirleyecek.",
            temporaryPassword,
            resetRequest.ExpiresAtUtc);
    }

    private async Task<bool> ExpireApprovedPasswordResetIfNeededAsync(AppUser user, CancellationToken cancellationToken)
    {
        if (!user.MustChangePassword)
        {
            return false;
        }

        var approvedReset = await dbContext.PasswordResetRequests
            .IgnoreQueryFilters()
            .Where(x => x.UserId == user.Id && x.Status == PasswordResetApproved)
            .OrderByDescending(x => x.ReviewedAtUtc ?? x.RequestedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (approvedReset?.ExpiresAtUtc is null || approvedReset.ExpiresAtUtc > DateTime.UtcNow)
        {
            return false;
        }

        approvedReset.Status = PasswordResetExpired;
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private void AddPasswordResetNotification(AppUser user, string targetRole)
    {
        dbContext.Notifications.Add(new NotificationItem
        {
            TenantId = user.TenantId,
            Title = "Şifre sıfırlama talebi",
            Message = $"{user.FullName} hesabı için şifre sıfırlama talebi oluşturuldu.",
            TimeLabel = "Az önce",
            Audience = targetRole,
            TargetRole = targetRole,
            Category = "PasswordReset"
        });
    }

    private async Task<AppUser?> ResolveCurrentUserAsync(CancellationToken cancellationToken)
    {
        var raw = httpContextAccessor.HttpContext?.User?.FindFirstValue("nameid")
            ?? httpContextAccessor.HttpContext?.User?.FindFirstValue("sub");
        return Guid.TryParse(raw, out var userId)
            ? await dbContext.Users.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == userId, cancellationToken)
            : null;
    }

    private async Task<CurrentUserDto> CreateCurrentUserDtoAsync(AppUser user, CancellationToken cancellationToken)
    {
        var tenant = user.TenantId.HasValue
            ? await dbContext.TenantWorkspaces
                .AsNoTracking()
                .Where(x => x.Id == user.TenantId.Value)
                .Select(x => new
                {
                    x.Id,
                    x.Name,
                    x.Slug,
                    x.InstitutionType,
                    x.DrivingSchoolModuleEnabled,
                })
                .SingleOrDefaultAsync(cancellationToken)
            : null;

        var isPlatformAdmin = user.PrimaryRole == UserRole.Developer && user.TenantId is null;

        // Kurum üyesi mi? (platform admin değil ve tenant'a bağlı)
        // En az bir "paid" abonelik faturası yoksa SubscriptionRequired = true.
        var subscriptionRequired = false;
        if (!isPlatformAdmin && tenant?.Id is Guid tenantId)
        {
            var hasPaid = await dbContext.PlatformSubscriptionInvoices
                .AsNoTracking()
                .AnyAsync(i => i.TenantId == tenantId && i.Status == "paid", cancellationToken);
            subscriptionRequired = !hasPaid;
        }

        var rolePolicy = await LoadRoleManagementPolicyAsync(user.Id, user.Username, user.TenantId, cancellationToken);

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
            tenant?.InstitutionType.ToString(),
            tenant?.DrivingSchoolModuleEnabled ?? false,
            isPlatformAdmin,
            subscriptionRequired,
            user.MustChangePassword,
            rolePolicy.Modules,
            rolePolicy.Permissions,
            rolePolicy.HasPolicy);
    }

    private async Task<(IReadOnlyList<string> Modules, IReadOnlyList<string> Permissions, bool HasPolicy)> LoadRoleManagementPolicyAsync(
        Guid userId,
        string username,
        Guid? tenantId,
        CancellationToken cancellationToken)
    {
        var scopeKeys = new List<string> { userId.ToString() };
        if (!string.IsNullOrWhiteSpace(username))
        {
            scopeKeys.Add(username);
        }

        var profileScopeKeys = await dbContext.Students
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Select(x => x.Id.ToString())
            .Concat(dbContext.Staff
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(x => x.UserId == userId)
                .Select(x => x.Id.ToString()))
            .ToListAsync(cancellationToken);
        scopeKeys.AddRange(profileScopeKeys);
        scopeKeys = scopeKeys
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var query = dbContext.PlatformConfigurations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.ConfigurationType == "role-management" && scopeKeys.Contains(x.ScopeKey));

        query = tenantId.HasValue
            ? query.Where(x => x.TenantId == tenantId.Value || x.TenantId == null)
            : query.Where(x => x.TenantId == null);

        var payloadJson = await query
            .OrderByDescending(x => x.TenantId != null)
            .ThenByDescending(x => x.UpdatedAtUtc)
            .Select(x => x.PayloadJson)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return (Array.Empty<string>(), Array.Empty<string>(), false);
        }

        try
        {
            using var document = JsonDocument.Parse(payloadJson);
            var root = document.RootElement;
            var modules = ReadEnabledKeys(root, "modules");
            var permissions = ReadEnabledKeys(root, "actions");
            return (modules, permissions, true);
        }
        catch
        {
            return (Array.Empty<string>(), Array.Empty<string>(), false);
        }
    }

    private static IReadOnlyList<string> ReadEnabledKeys(JsonElement root, string propertyName)
    {
        if (!root.TryGetProperty(propertyName, out var section) || section.ValueKind != JsonValueKind.Object)
        {
            return Array.Empty<string>();
        }

        return section.EnumerateObject()
            .Where(item => item.Value.ValueKind == JsonValueKind.True)
            .Select(item => item.Name)
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
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
