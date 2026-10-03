using CourseIntellect.Application.DTOs.Auth;
using CourseIntellect.Domain.Entities;

namespace CourseIntellect.Application.Interfaces;

public interface IAdminMfaService
{
    Task<AdminMfaStartResponse?> StartAsync(AppUser user, CancellationToken cancellationToken = default);
    Task<AppUser?> VerifyAsync(AdminMfaVerifyRequest request, CancellationToken cancellationToken = default);
}
