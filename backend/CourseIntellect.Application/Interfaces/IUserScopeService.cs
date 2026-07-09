using CourseIntellect.Application.DTOs.Scope;
using CourseIntellect.Domain.Entities;

namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Kullanıcının erişim yetkilerini (<see cref="UserScopeGrant"/>) okur ve "bu kurumu/şubeyi
/// görebilir mi" doğrulamalarını yapar. Middleware, header ile istenen aktif bağlamı
/// buradan geçirerek doğrular — böylece kimse yetkisi olmayan bir kuruma geçemez.
/// </summary>
public interface IUserScopeService
{
    Task<IReadOnlyList<UserScopeGrant>> GetGrantsAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Kullanıcı bu kurumu görebilir mi? (Platform | ilgili Group | tam Tenant |
    /// o kuruma ait bir Branch grant'ı üzerinden.)</summary>
    Task<bool> CanAccessTenantAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>Kullanıcı bu kurum içinde tüm şubeleri mi görür (tenant+ seviye), yoksa
    /// yalnız belirli şube(ler)e mi kilitli? Şubeye kilitliyse izinli şube kimlikleri döner
    /// (<c>null</c> = kısıt yok, tüm şubeler).</summary>
    Task<IReadOnlyCollection<Guid>?> ResolveAllowedBranchesAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>Verilen şube (OrgUnit) bu kuruma mı ait? Unrestricted kullanıcının
    /// X-Branch-Filter ile başka kurumun şubesine odaklanmasını engellemek için.</summary>
    Task<bool> BranchBelongsToTenantAsync(Guid branchId, Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>Context switcher için: kullanıcının grant'larını somut kurum + şube
    /// ağacına açar. <see cref="UserScopeOptions.ReadOnly"/> tüm grant'lar salt-okunursa true.</summary>
    Task<UserScopeOptions> GetScopeOptionsAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Konsolide roll-up: erişilebilir kurumların özet metrikleri + genel toplam.
    /// Kurum sahibi/MEB'in tüm kurumlarını tek ekranda göstermek için.</summary>
    Task<ScopeRollupResponse> GetRollupAsync(Guid userId, CancellationToken cancellationToken = default);
}
