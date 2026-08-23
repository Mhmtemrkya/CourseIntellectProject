namespace CourseIntellect.Application.Exceptions;

/// <summary>
/// Parola DOĞRU ama geçici parolanın ömrü dolmuş.
/// </summary>
/// <remarks>
/// Ayrı bir mesaj vermek burada bilgi sızdırmaz: çağıran parolayı zaten doğru bildiğini
/// kanıtladı. Genel "kullanıcı adı veya şifre hatalı" demek, kurumu bulunmayan bir
/// sorunun peşine düşürürdü.
/// </remarks>
public sealed class TemporaryPasswordExpiredException(int validDays)
    : Exception($"Geçici parolanızın süresi doldu ({validDays} gün). Kurumunuzun kurulum belgesini yenilemek için platform yöneticisiyle iletişime geçin.")
{
    public int ValidDays { get; } = validDays;
}
