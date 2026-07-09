namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// İstek başına BİR KEZ çözülen aktif görüntüleme bağlamını taşıyan scoped holder.
/// Middleware auth'tan sonra doldurur; query filter (DbContext) ve <see cref="ITenantContext"/>
/// bunu okur. Amaç: grant doğrulaması (DB erişimi) her sorguda değil, istek başına tek
/// sefer yapılsın — query filter içinde DB sorgusu yapılamaz.
/// </summary>
public interface IActiveScope
{
    /// <summary>Middleware çözümlemeyi yaptı mı? False ise okuyanlar claim'e fallback eder.</summary>
    bool IsResolved { get; }

    /// <summary>Aktif kurum (drill-down'da ev kurumdan farklı olabilir).</summary>
    Guid? TenantId { get; }

    /// <summary>Aktif şube; <c>null</c> = tüm şubeler (kısıt yok).</summary>
    Guid? BranchId { get; }

    void Set(Guid? tenantId, Guid? branchId);
}
