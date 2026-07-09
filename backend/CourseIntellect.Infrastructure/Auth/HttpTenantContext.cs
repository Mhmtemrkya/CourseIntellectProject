using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace CourseIntellect.Infrastructure.Auth;

/// <summary>
/// <see cref="ITenantContext"/>'in HTTP tabanlı implementasyonu. Aktif kurumu önce
/// istek başına çözülen <see cref="IActiveScope"/> holder'ından okur (drill-down bağlamı);
/// holder henüz doldurulmamışsa (middleware öncesi / HTTP dışı akış) <c>tenant_id</c>
/// claim'ine — yani çağıranın EV kurumuna — fallback eder.
/// </summary>
public sealed class HttpTenantContext(
    IHttpContextAccessor httpContextAccessor,
    IActiveScope activeScope) : ITenantContext
{
    public Guid? CurrentTenantId => activeScope.IsResolved ? activeScope.TenantId : HomeTenantId;

    public bool HasTenant => CurrentTenantId is not null;

    private Guid? HomeTenantId
    {
        get
        {
            var raw = httpContextAccessor.HttpContext?.User?.FindFirstValue("tenant_id");
            return Guid.TryParse(raw, out var tenantId) ? tenantId : null;
        }
    }
}
