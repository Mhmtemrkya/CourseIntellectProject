namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Sürücü kursu olaylarını bildirime çeviren tek kapı. Uygulama içi bildirimi
/// yazar ve aynı içeriği push olarak gönderir.
///
/// <para><b>Bildirim asıl işlemi bloklamaz:</b> gönderim başarısız olsa bile
/// randevu/tahsilat işlemi geri alınmaz — hata yutulur.</para>
///
/// <para><b>Tekrar engeli:</b> aynı <c>dedupeKey</c> ile ikinci çağrı bildirim
/// üretmez. Hatırlatma işleri bu sayede güvenle tekrar tekrar çalışabilir.</para>
/// </summary>
public interface IDrivingNotifier
{
    /// <summary>Belirli bir kullanıcıya bildirim gönderir.</summary>
    Task NotifyUserAsync(
        Guid userId,
        string title,
        string message,
        string category,
        string? dedupeKey = null,
        string? relatedEntityType = null,
        string? relatedEntityId = null,
        CancellationToken cancellationToken = default);

    /// <summary>Sürücü kursu profilinin sahibi olan öğrenciye bildirim gönderir.</summary>
    Task NotifyStudentAsync(
        Guid studentDrivingProfileId,
        string title,
        string message,
        string category,
        string? dedupeKey = null,
        string? relatedEntityType = null,
        string? relatedEntityId = null,
        CancellationToken cancellationToken = default);

    /// <summary>Direksiyon öğretmenine bildirim gönderir.</summary>
    Task NotifyInstructorAsync(
        Guid instructorProfileId,
        string title,
        string message,
        string category,
        string? dedupeKey = null,
        string? relatedEntityType = null,
        string? relatedEntityId = null,
        CancellationToken cancellationToken = default);

    /// <summary>Kurum yönetimine (rol yayını) bildirim gönderir — filo/operasyon uyarıları.</summary>
    Task NotifyManagersAsync(
        string title,
        string message,
        string category,
        string? dedupeKey = null,
        string? relatedEntityType = null,
        string? relatedEntityId = null,
        CancellationToken cancellationToken = default);
}

/// <summary>Bildirim kategorileri — mobil/desktop bildirim merkezi bunlara göre gruplar.</summary>
public static class DrivingNotificationCategories
{
    public const string Appointment = "DrivingAppointment";
    public const string Lesson = "DrivingLesson";
    public const string Document = "DrivingDocument";
    public const string Finance = "DrivingFinance";
    public const string Fleet = "DrivingFleet";
    public const string Exam = "DrivingExam";
}
