namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Yoklama durumları kanonik olarak "Katildi"/"Gec"/"Devamsiz"/"Izinli" saklanır
/// (bkz. <see cref="AttendanceService"/>). Asistan eskiden "Gelmedi"/"Geç" arıyordu;
/// bu değerler hiç yazılmadığı için her öğrenciye "0 devamsızlık" diyor ve veliye
/// devamsızlık bildirimi hiç gönderilmiyordu. Eski/serbest yazımlar ("Geldi",
/// "Gelmedi", "present"…) da tanınır; okuma uçları <see cref="Canonicalize"/> ile
/// istemcilere hep kanonik değeri döner.
/// </summary>
public static class AttendanceStatusMatcher
{
    public const string Present = "Katildi";
    public const string Late = "Gec";
    public const string Excused = "Izinli";
    public const string Absent = "Devamsiz";

    /// <summary>SQL'e çevrilebilen devamsız yazımları (<c>AbsentStatuses.Contains(x.Status)</c>).</summary>
    public static readonly string[] AbsentStatuses = [Absent, "Devamsız", "Gelmedi", "absent", "Absent"];

    /// <summary>Derse katılmış sayılan (gelen, geç gelen, izinli) yazımlar — SQL'e çevrilebilir.</summary>
    public static readonly string[] AttendedStatuses =
        [Present, "Katıldı", "Geldi", "present", "Present", Late, "Geç", "late", "Late", Excused, "İzinli", "excuse", "Excused"];

    /// <summary>Bilinen yazımı kanonik değere çevirir; tanınmayan değer olduğu gibi (kırpılmış) döner.</summary>
    public static string Canonicalize(string? status)
    {
        var key = Fold(status);
        return key switch
        {
            "katildi" or "geldi" or "present" => Present,
            "gec" or "gecgeldi" or "late" => Late,
            "izinli" or "izin" or "excuse" or "excused" => Excused,
            "devamsiz" or "gelmedi" or "absent" or "yok" => Absent,
            _ => status?.Trim() ?? string.Empty,
        };
    }

    public static bool IsAbsent(string? status) => Canonicalize(status) == Absent;

    public static bool IsLate(string? status) => Canonicalize(status) == Late;

    /// <summary>Gelen, geç gelen veya izinli — yoklamada "derse katıldı" sayılır.</summary>
    public static bool IsAttended(string? status) => Canonicalize(status) is Present or Late or Excused;

    private static string Fold(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var chars = value.Trim().ToLowerInvariant()
            .Replace('ı', 'i').Replace('İ', 'i').Replace("i̇", "i")
            .Replace('ç', 'c').Replace('ğ', 'g').Replace('ö', 'o').Replace('ş', 's').Replace('ü', 'u')
            .Where(char.IsLetter);
        return new string(chars.ToArray());
    }
}
