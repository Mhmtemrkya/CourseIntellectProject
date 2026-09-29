namespace CourseIntellect.Application.Exceptions;

/// <summary>
/// Parola DOĞRU ama kullanıcının kurumu artık bu üründe değil (sürücü kursları
/// DrivingAsist'e taşındı).
/// </summary>
/// <remarks>
/// Ayrı mesaj bilgi sızdırmaz: çağıran parolayı zaten doğru bildiğini kanıtladı.
/// Genel "kullanıcı adı veya şifre hatalı" demek kurumu yanlış yöne gönderirdi.
/// </remarks>
public sealed class InstitutionMovedException(string targetProduct)
    : Exception($"Kurumunuz artık {targetProduct} uygulamasını kullanıyor. Lütfen {targetProduct} üzerinden giriş yapın.")
{
    public string TargetProduct { get; } = targetProduct;
}
