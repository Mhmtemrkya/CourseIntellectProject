using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Bir kullanıcının org hiyerarşisindeki erişim yetkisi. Çoka-çok: bir kullanıcının
/// birden çok grant'ı olabilir — bu tek tablo dört senaryoyu birden çözer:
/// çok-kurumlu sahip (birden çok Tenant/Group satırı), çok-şubeli müdür (birden çok
/// Branch satırı), MEB (Platform + ReadOnly), şube müdürü (tek Branch + Manage).
/// <see cref="AppUser"/>'ın TenantId/BranchId alanları "ev/varsayılan" bağlam olarak
/// kalır; bu tablo onların üstüne genişletilmiş erişimi tanımlar.
/// Kasıtlı olarak tenant query filter'ına TABİ DEĞİLDİR: Platform/Group grant'ları
/// birden çok kuruma yayıldığı için filtrelenmemelidir.
/// </summary>
public sealed class UserScopeGrant
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    /// <summary>Grant'ın hiyerarşi seviyesi.</summary>
    public ScopeLevel Level { get; set; }

    /// <summary>
    /// Kapsamın hedefi. Level'e göre: Platform=<c>null</c>, Group=TenantGroup.Id,
    /// Tenant=TenantWorkspace.Id, Branch=OrgUnit.Id.
    /// </summary>
    public Guid? TargetId { get; set; }

    public ScopeAccessMode AccessMode { get; set; } = ScopeAccessMode.Manage;

    /// <summary>Kullanıcının varsayılan/ev kapsamı mı (girişte otomatik seçilen bağlam).</summary>
    public bool IsHome { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Bir kullanıcı için varsayılan "ev" grant'ını üretir. Eşleme bugünkü
    /// EffectiveBranchId davranışını birebir yansıtır — böylece grant tabanlı resolver
    /// mevcut kullanıcıları hiç etkilemez. Tüm kullanıcı oluşturma yolları ve backfill
    /// bu tek metodu kullanır.
    /// </summary>
    public static UserScopeGrant CreateHome(AppUser user)
    {
        var (level, target) = ResolveHomeScope(user);
        return new UserScopeGrant
        {
            UserId = user.Id,
            Level = level,
            TargetId = target,
            AccessMode = ScopeAccessMode.Manage,
            IsHome = true
        };
    }

    // Tenant yoksa Platform; unrestricted rol (Admin/Developer) tüm şubeleri gördüğü için
    // Tenant; şube kilidi varsa Branch; aksi halde şubesiz Tenant.
    private static (ScopeLevel Level, Guid? Target) ResolveHomeScope(AppUser user)
    {
        if (user.TenantId is null) return (ScopeLevel.Platform, null);

        var unrestricted = IsUnrestrictedRole(user.PrimaryRole) || user.ExtraRoles.Any(IsUnrestrictedRole);
        if (unrestricted) return (ScopeLevel.Tenant, user.TenantId);
        if (user.BranchId is not null) return (ScopeLevel.Branch, user.BranchId);
        return (ScopeLevel.Tenant, user.TenantId);
    }

    private static bool IsUnrestrictedRole(UserRole role) => role is UserRole.Admin or UserRole.Developer;
}
