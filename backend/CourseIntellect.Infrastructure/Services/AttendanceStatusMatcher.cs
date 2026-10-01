namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Yoklama durumları kanonik olarak "Katildi"/"Gec"/"Devamsiz"/"Izinli" saklanır
/// (bkz. <see cref="AttendanceService"/>). Asistan eskiden "Gelmedi"/"Geç" arıyordu;
/// bu değerler hiç yazılmadığı için her öğrenciye "0 devamsızlık" diyor ve veliye
/// devamsızlık bildirimi hiç gönderilmiyordu. Eski/serbest yazımlar da tanınır.
/// </summary>
public static class AttendanceStatusMatcher
{
    public static bool IsAbsent(string? status) =>
        status?.Trim() is "Devamsiz" or "Devamsız" or "Gelmedi" or "absent";

    public static bool IsLate(string? status) =>
        status?.Trim() is "Gec" or "Geç" or "late";
}
