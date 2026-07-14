using System.Security.Claims;

namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Sürücü kursu ince taneli yetki çözümleyicisi. Rol "hangi paneli görür"ü,
/// bu servis "hangi işlemi yapabilir"i belirler.
/// </summary>
public interface IDrivingPermissionService
{
    /// <summary>Kullanıcının etkin izin kodları (özel rol daraltması uygulanmış).</summary>
    Task<IReadOnlySet<string>> GetPermissionsAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default);

    Task<bool> HasAsync(ClaimsPrincipal user, string permission, CancellationToken cancellationToken = default);

    /// <summary>UI'ın menü/buton göstermesi için kullanılan özet: rol anahtarı + izinler.</summary>
    Task<DrivingPermissionSnapshot> GetSnapshotAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default);
}

public sealed record DrivingPermissionSnapshot(
    string RoleKey,
    IReadOnlyList<string> Permissions,
    bool IsOwner,
    bool IsBranchScoped);
