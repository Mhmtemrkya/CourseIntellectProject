namespace CourseIntellect.Application.Interfaces;

/// <summary>Zamanlanmış hatırlatma işleri. Hangfire tarafından tetiklenir ama
/// Hangfire'a bağımlı değildir — düz servis metotları. Her kurum (tenant) için
/// DbContext tenant override'ı ayarlayıp mevcut hatırlatma mantığını çağırır.</summary>
public interface IReminderJobService
{
    /// <summary>Tüm kurumlar için ödeme (taksit) hatırlatmalarını gönderir.</summary>
    Task RunFinanceRemindersAsync(CancellationToken cancellationToken = default);

    /// <summary>Tüm kurumlar için kütüphane iade hatırlatmalarını gönderir.</summary>
    Task RunLibraryRemindersAsync(CancellationToken cancellationToken = default);

    /// <summary>Uzun süredir görülmeyen (ölü) push cihaz kayıtlarını pasifler.</summary>
    Task CleanupStalePushTokensAsync(CancellationToken cancellationToken = default);
}
