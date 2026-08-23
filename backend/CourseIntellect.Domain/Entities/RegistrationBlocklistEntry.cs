namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Halka açık kurum kaydı formunda engellenen e-posta alan adı ya da IP.
/// </summary>
/// <remarks>
/// Engellenen istek REDDEDİLDİĞİNİ BELLİ ETMEZ: çağırana kabul edilmiş gibi aynı 202
/// döner. Aksi hâlde saldırgan hangi alan adının/IP'nin engellendiğini deneyerek
/// öğrenir ve engeli dolanır.
/// </remarks>
public sealed class RegistrationBlocklistEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>domain | ip</summary>
    public string Kind { get; set; } = "domain";

    /// <summary>Küçük harfe çevrilmiş alan adı ("ornek.com") ya da IP ("203.0.113.7").</summary>
    public string Value { get; set; } = string.Empty;

    public string? Reason { get; set; }

    public Guid? CreatedByUserId { get; set; }
    public string CreatedByName { get; set; } = "Sistem";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
