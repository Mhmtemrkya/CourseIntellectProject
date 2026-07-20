namespace CourseIntellect.Application.DTOs.LoginAttempts;

public sealed record CreateLoginAttemptRequest(
    Guid? UserId,
    string Email,
    string Role,
    bool Success,
    string IpAddress,
    string UserAgent,
    string DeviceId,
    /// <summary>
    /// Denemenin ait olduğu kurum. Giriş anında oturum bağlamı henüz olmadığı için
    /// otomatik damgalama çalışmaz; çözülen kullanıcının kurumu açıkça verilmelidir.
    /// Kullanıcı çözülemediyse null bırakılır.
    /// </summary>
    Guid? TenantId = null
);
