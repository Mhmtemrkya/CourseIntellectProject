namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Tercih robotunun ulusal referans verisi: bir yılın yerleştirme sonucundaki bir
/// program/okul. KURUMA AİT DEĞİLDİR (tenant filtresi yok) — tüm kurumlar aynı
/// resmî veriyi kullanır. Her satır kaynağını (yayımlayan kurum ve adres) taşır.
/// </summary>
public sealed class PreferenceProgram
{
    public Guid Id { get; set; } = Guid.NewGuid();
    /// <summary>YKS ya da LGS.</summary>
    public string Exam { get; set; } = "YKS";
    public int Year { get; set; }
    /// <summary>ÖSYM program kodu ya da MEB kurum kodu.</summary>
    public string Code { get; set; } = string.Empty;
    /// <summary>Lisans, Önlisans ya da Lise.</summary>
    public string Level { get; set; } = string.Empty;
    /// <summary>DEVLET, VAKIF, KKTC, YURTDIŞI ya da LGS'de okul türü (Fen Lisesi, Anadolu Lisesi...).</summary>
    public string InstitutionType { get; set; } = string.Empty;
    public string InstitutionName { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    /// <summary>Fakülte/yüksekokul ya da LGS'de ilçe.</summary>
    public string Unit { get; set; } = string.Empty;
    public string ProgramName { get; set; } = string.Empty;
    /// <summary>SAY, EA, SÖZ, DİL, TYT ya da LGS.</summary>
    public string ScoreType { get; set; } = string.Empty;
    public int? Quota { get; set; }
    public int? Placed { get; set; }
    /// <summary>Yerleşen en düşük puan (taban puan); kontenjan dolmadıysa null.</summary>
    public decimal? MinScore { get; set; }
    public decimal? MaxScore { get; set; }
    /// <summary>LGS yüzdelik dilimi (ör. 0,35).</summary>
    public decimal? Percentile { get; set; }
    public string Source { get; set; } = string.Empty;
    public string SourceUrl { get; set; } = string.Empty;
    public DateTime ImportedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>Öğrencinin tercih listesi (YKS en fazla 24, LGS en fazla 5).</summary>
public sealed class StudentPreferenceChoice : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid StudentUserId { get; set; }
    public string Exam { get; set; } = "YKS";
    public string ProgramCode { get; set; } = string.Empty;
    public int Order { get; set; }
    public string Note { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
