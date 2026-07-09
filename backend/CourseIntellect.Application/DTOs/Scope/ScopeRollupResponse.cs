namespace CourseIntellect.Application.DTOs.Scope;

/// <summary>Konsolide roll-up: kurum sahibi/MEB'in erişebildiği tüm kurumların özet
/// metrikleri + genel toplam. Tek-kurumlu kullanıcıda anlamsız (controller boş döner).</summary>
public sealed record ScopeRollupResponse(
    bool ReadOnly,
    int TenantCount,
    ScopeRollupTotals Totals,
    IReadOnlyList<ScopeRollupTenant> Tenants);

public sealed record ScopeRollupTotals(
    int Students,
    int Staff,
    int Branches,
    decimal Collected,
    decimal MonthlyFee);

public sealed record ScopeRollupTenant(
    Guid Id,
    string Name,
    int Students,
    int Staff,
    int Branches,
    decimal Collected,
    decimal MonthlyFee);
