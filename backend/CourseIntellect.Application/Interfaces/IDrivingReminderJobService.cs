namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Sürücü kursunun zamanlanmış hatırlatmaları. Hangfire tetikler ama servis
/// Hangfire'a bağımlı değildir — düz metotlar, elle de çağrılabilir.
///
/// <para><b>Tenant tuzağı:</b> arka planda HttpContext yoktur; her iş kurum kurum
/// <c>SetTenantOverride</c> kurar. Aksi hâlde sorgu filtresi tüm kurumları görür
/// ve üretilen bildirimler <c>TenantId=null</c> alıp hiçbir kurumda görünmez.</para>
///
/// <para><b>Idempotency:</b> her bildirim tarih/eşik içeren bir dedupe anahtarıyla
/// gönderilir; iş günde birkaç kez çalışsa da öğrenci bir kez rahatsız edilir.</para>
/// </summary>
public interface IDrivingReminderJobService
{
    /// <summary>Araç evrakı, muayene/sigorta süresi ve bakım kilometresi kontrolü.</summary>
    Task<int> RunVehicleComplianceRemindersAsync(CancellationToken cancellationToken = default);

    /// <summary>Yarınki direksiyon dersleri için öğrenci ve öğretmen hatırlatması.</summary>
    Task<int> RunAppointmentRemindersAsync(CancellationToken cancellationToken = default);

    /// <summary>Eksik/reddedilen evrak, azalan ders hakkı ve gecikmiş ödeme hatırlatmaları.</summary>
    Task<int> RunStudentRemindersAsync(CancellationToken cancellationToken = default);

    /// <summary>Yöneticiye günlük operasyon özeti (bugünkü ders, uyarı, tahsilat).</summary>
    Task<int> RunDailyOperationsSummaryAsync(CancellationToken cancellationToken = default);
}
