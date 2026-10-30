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

    /// <summary>
    /// Öğrenci kimliği biliniyorsa veli onunla bulunur (aynı adlı iki öğrencide
    /// yanlış veliye gitmez). <paramref name="dedupeKey"/> doluysa aynı anahtarla
    /// ikinci bildirim yazılmaz.
    /// </summary>
    Task NotifyStudentParentAsync(
        Guid? studentUserId,
        string studentName,
        string title,
        string message,
        string category,
        string? dedupeKey,
        CancellationToken cancellationToken = default)
        => NotifyStudentParentAsync(studentName, title, message, category, cancellationToken);
}
