namespace CourseIntellect.Application.Exceptions;

/// <summary>
/// Yüklenen dosya reddedildi (içerik uzantıyla uyuşmuyor, boş, geçersiz klasör).
/// İstemci hatasıdır: ara katman 400 ve bu mesajla döner.
/// </summary>
public sealed class UploadRejectedException(string message) : InvalidOperationException(message);
