using System.Security.Claims;

namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Paket (entitlement) yetki kontrolü — backend tarafında zorlanır.
///
/// Frontend'deki FeatureGate/EntitlementGuard yalnızca arayüzü gizler; API'ye
/// doğrudan istek atan biri bu katmanla durdurulur. Semantik frontend
/// entitlements.js ile birebir aynıdır: kurumun paketi yoksa/tanımsızsa
/// kısıtsız; modül kapalıysa sayfa+işlem kapalı; aksiyon yalnızca açıkça
/// false ise kapalı.
/// </summary>
public interface IEntitlementService
{
    /// <summary>
    /// Oturum açan kullanıcının kurumuna atanmış paket, verilen modül (ve varsa
    /// aksiyon) için bu kullanıcıya izin veriyor mu?
    /// </summary>
    /// <param name="user">İstek sahibinin claims principal'ı (tenant_id + role).</param>
    /// <param name="module">packageCatalog modül anahtarı (ör. "students").</param>
    /// <param name="action">Sayfa içi işlem anahtarı (ör. "create"); yalnızca modül kontrolü için null.</param>
    Task<bool> IsAllowedAsync(ClaimsPrincipal user, string module, string? action, CancellationToken cancellationToken = default);
}
