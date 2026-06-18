namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Bir öğrenciye bağlı veliye anlık bildirim (uygulama içi + push) gönderir.
/// Devamsızlık, sınav sonucu gibi olay-tetikli akışlarda kullanılır.
/// </summary>
public interface IParentNotifier
{
    Task NotifyStudentParentAsync(
        string studentName,
        string title,
        string message,
        string category,
        CancellationToken cancellationToken = default);
}
