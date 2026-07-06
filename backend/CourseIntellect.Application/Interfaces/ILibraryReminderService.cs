namespace CourseIntellect.Application.Interfaces;

/// <summary>Kütüphane iade hatırlatmalarını üretir (uygulama içi + push).
/// Hem manuel uçtan (LibraryController) hem de zamanlanmış işten (Hangfire)
/// çağrılır. Tenant bağlamını DbContext'ten alır — çağıran taraf ayarlar.</summary>
public interface ILibraryReminderService
{
    Task<int> SendDueRemindersAsync(CancellationToken cancellationToken = default);
}
