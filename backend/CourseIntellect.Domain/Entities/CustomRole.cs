using CourseIntellect.Domain.Enums;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Kurum yöneticisinin tanımladığı özel rol (ör. "Kayıt Sorumlusu"). Sabit
/// <see cref="UserRole"/> enum'unun üstünde bir katmandır: kullanıcı panel/yetki tabanı
/// olarak <see cref="BaseRole"/>'ü kullanır, ancak modül erişimi <see cref="Modules"/>
/// listesiyle SINIRLANIR (API seviyesinde EntitlementService zorlar).
/// </summary>
public sealed class CustomRole : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>Panel ve temel yetki tabanı (Administrative/Teacher/Cafeteria...).</summary>
    public UserRole BaseRole { get; set; } = UserRole.Administrative;

    /// <summary>
    /// İzinli modül anahtarları (JSON dizi).
    ///
    /// <para><b>Boş listenin anlamı <see cref="ModulesRestricted"/>'a bağlıdır</b> —
    /// bu ayrım güvenlik açısından kritiktir:</para>
    /// <list type="bullet">
    ///   <item><c>ModulesRestricted=false</c> (eski kayıtlar): boş liste "kısıt
    ///   tanımlanmamış" demektir, taban rolün tamamı geçerlidir.</item>
    ///   <item><c>ModulesRestricted=true</c> (yetki matrisinden kurulan roller):
    ///   liste BAĞLAYICIDIR; boş liste "hiçbir sayfaya erişim yok" demektir.</item>
    /// </list>
    /// Bayrak olmadan "hiçbir sayfa seçme" isteği sessizce "tam yetki"ye
    /// dönüşürdü.
    /// </summary>
    public string ModulesSerialized { get; set; } = "[]";

    /// <summary>
    /// Modül listesi bağlayıcı mı? Yetki matrisinden oluşturulan rollerde daima
    /// true. Eski roller false kalır ve davranışları değişmez.
    /// </summary>
    public bool ModulesRestricted { get; set; }

    /// <summary>
    /// İnce taneli izin kodları (JSON dizi, ör. <c>driving.vehicle.update</c>). Boş = taban
    /// rolün varsayılan seti geçerli. Doluysa liste, taban rolün tavanıyla kesiştirilerek
    /// uygulanır — kurum admini bir role tavanının üstünde yetki veremez.
    /// </summary>
    public string PermissionsSerialized { get; set; } = "[]";

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    [NotMapped]
    public List<string> Modules
    {
        get => Deserialize(ModulesSerialized);
        set => ModulesSerialized = JsonSerializer.Serialize(value);
    }

    [NotMapped]
    public List<string> Permissions
    {
        get => Deserialize(PermissionsSerialized);
        set => PermissionsSerialized = JsonSerializer.Serialize(value);
    }

    private static List<string> Deserialize(string? serialized) =>
        string.IsNullOrWhiteSpace(serialized) ? [] : JsonSerializer.Deserialize<List<string>>(serialized) ?? [];
}
