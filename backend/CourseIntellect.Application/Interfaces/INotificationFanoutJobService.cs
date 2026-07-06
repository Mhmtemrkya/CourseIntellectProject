namespace CourseIntellect.Application.Interfaces;

/// <summary>İstek-yolundan çıkarılmış ağır bildirim fan-out işleri. Hangfire
/// kuyruğunda çalışır; HttpContext olmadığı için tenant'ı argümandan alıp
/// DbContext override'ı elle kurar. Kayıt (ödev/duyuru) senkron tamamlanır,
/// bildirimler bu işlerle arkada gönderilir.</summary>
public interface INotificationFanoutJobService
{
    /// <summary>Yeni ödev: sınıftaki öğrencilere + velilerine bildirim.</summary>
    Task HomeworkAssignedAsync(Guid tenantId, Guid assignmentId, CancellationToken cancellationToken = default);

    /// <summary>Yeni duyuru: hedef role telefon push'u.</summary>
    Task AnnouncementPublishedAsync(Guid tenantId, Guid announcementId, CancellationToken cancellationToken = default);
}
