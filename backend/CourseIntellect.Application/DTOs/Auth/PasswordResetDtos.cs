namespace CourseIntellect.Application.DTOs.Auth;

public sealed record ForgotPasswordRequest(string Email);

public sealed record PasswordResetRequestDto(
    Guid Id,
    Guid UserId,
    string RequestedEmail,
    string FullName,
    string Username,
    string PrimaryRole,
    string Status,
    string ReviewNote,
    string ReviewedByName,
    DateTime RequestedAtUtc,
    DateTime? ReviewedAtUtc,
    DateTime? ExpiresAtUtc,
    DateTime? UsedAtUtc
);

public sealed record ReviewPasswordResetRequest(
    bool Approved,
    string? Note
);

public sealed record PasswordResetReviewResponse(
    Guid Id,
    string Status,
    string Message,
    string? TemporaryPassword,
    DateTime? ExpiresAtUtc
);
