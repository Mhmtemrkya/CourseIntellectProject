namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Haftalık proaktif özet: öğretmene, ders verdiği sınıflar için sınıf önerisi varsa uygulama içi
/// bildirim + push gönderir. Varsayılan KAPALI ("Assistant:WeeklyDigest:Enabled" = true ile açılır).
/// </summary>
public interface IWeeklyDigestJob
{
    /// <summary>Gönderilen bildirim sayısı (kapalıysa 0).</summary>
    Task<int> RunAsync(CancellationToken cancellationToken = default);
}
