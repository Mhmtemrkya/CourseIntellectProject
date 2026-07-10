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

    /// <summary>İzinli modül anahtarları (JSON dizi). Boş = kısıt yok (tam taban rol).</summary>
    public string ModulesSerialized { get; set; } = "[]";

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    [NotMapped]
    public List<string> Modules
    {
        get => string.IsNullOrWhiteSpace(ModulesSerialized)
            ? []
            : JsonSerializer.Deserialize<List<string>>(ModulesSerialized) ?? [];
        set => ModulesSerialized = JsonSerializer.Serialize(value);
    }
}
