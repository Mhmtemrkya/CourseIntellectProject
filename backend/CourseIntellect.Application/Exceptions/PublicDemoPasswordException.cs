namespace CourseIntellect.Application.Exceptions;

/// <summary>
/// Parola doğru ama kaynak kodunda/herkese açık belgelerde yazılı bir demo
/// parolası. Bu parolalarla canlıda giriş yapılamaz; hesap sahibi parolasını
/// sıfırlatmalıdır (depo herkese açık olduğundan bu parolalar herkesçe bilinir).
/// </summary>
public sealed class PublicDemoPasswordException()
    : Exception("Bu parola herkese açık bir demo parolasıdır ve güvenlik nedeniyle kullanılamaz. \"Şifremi unuttum\" ile parolanızı sıfırlatın.");
