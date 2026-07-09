namespace CourseIntellect.Domain.Enums;

/// <summary>
/// Bir erişim yetkisinin (grant) org hiyerarşisindeki seviyesi.
/// Yukarıdan aşağıya kapsam daralır: Platform (tüm kurumlar) → Group (bir markanın
/// kurumları) → Tenant (tek kurum, tüm şubeleri) → Branch (tek şube).
/// </summary>
public enum ScopeLevel
{
    Platform = 1,
    Group = 2,
    Tenant = 3,
    Branch = 4
}
