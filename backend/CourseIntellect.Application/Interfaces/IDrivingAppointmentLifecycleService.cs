namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Direksiyon randevularının otomatik yaşam döngüsü: bitiş saati geçmiş açık
/// randevuları "Tamamlandı" yapıp planlanan dakikayı pakete işler. Ofis daha
/// sonra "geldi/gelmedi" ile teyit eder; "gelmedi" dakikayı iade eder.
/// </summary>
public interface IDrivingAppointmentLifecycleService
{
    /// <summary>
    /// MEVCUT tenant kapsamındaki, bitiş saati geçmiş açık (Planlandı/Onaylandı/
    /// Buluşuldu) direksiyon randevularını otomatik tamamlar. İşlenen randevu
    /// sayısını döner. Hem arka plan işi (kurum kurum) hem de "bugün" listesi
    /// yüklenirken (tembel) çağrılır.
    /// </summary>
    Task<int> AutoCompletePastDueForCurrentTenantAsync(CancellationToken cancellationToken = default);
}
