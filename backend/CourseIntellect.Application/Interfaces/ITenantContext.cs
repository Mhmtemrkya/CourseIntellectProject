namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// İstek başına aktif tenant (kurum) bağlamının TEK kaynağı.
/// Tüm iş sorguları tenant'ı buradan okumalı; <c>tenant_id</c> claim'ini
/// doğrudan okumamalı. Faz 2'de "aktif bağlam" (kurum sahibi / MEB drill-down)
/// yalnızca bu soyutlamanın arkasında değişecek — çağıran taraflar değişmeyecek.
/// </summary>
public interface ITenantContext
{
    /// <summary>Aktif kurum kimliği; kimlik/tenant yoksa <c>null</c>.</summary>
    Guid? CurrentTenantId { get; }

    /// <summary>Aktif bir tenant bağlamı var mı (presence guard'ları için).</summary>
    bool HasTenant { get; }
}
