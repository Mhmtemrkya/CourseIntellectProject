using CourseIntellect.Application.DTOs.Auth;

namespace CourseIntellect.Application.Interfaces;

public interface IAuthService
{
    Task<AdminMfaStartResponse?> BeginAdminLoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
        => throw new NotSupportedException();
    Task<AdminMfaLoginResponse?> CompleteAdminLoginAsync(AdminMfaVerifyRequest request, CancellationToken cancellationToken = default)
        => throw new NotSupportedException();
    Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<LoginResponse?> RefreshAsync(RefreshTokenRequest request, CancellationToken cancellationToken = default);
    Task<CurrentUserDto?> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<CurrentUserDto?> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken cancellationToken = default);
    Task<CurrentUserDto?> ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken cancellationToken = default);
    Task RequestPasswordResetAsync(ForgotPasswordRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PasswordResetRequestDto>> GetPasswordResetRequestsAsync(string? status, CancellationToken cancellationToken = default);
    Task<PasswordResetReviewResponse> ReviewPasswordResetRequestAsync(Guid id, ReviewPasswordResetRequest request, CancellationToken cancellationToken = default);
    Task LogoutAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task<PkceAuthorizeResponse?> PkceAuthorizeAsync(PkceAuthorizeRequest request, CancellationToken cancellationToken = default);
    Task<LoginResponse?> PkceTokenExchangeAsync(PkceTokenRequest request, CancellationToken cancellationToken = default);
}
