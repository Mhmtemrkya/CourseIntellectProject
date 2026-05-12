namespace CourseIntellect.Application.Exceptions;

/// <summary>
/// Sistem bakımda olduğu için reddedilen istekler için fırlatılır.
/// Controller bunu yakalayıp 503 + özel kod döndürür.
/// </summary>
public sealed class MaintenanceModeException : Exception
{
    public MaintenanceModeException(string message) : base(message) { }
}
