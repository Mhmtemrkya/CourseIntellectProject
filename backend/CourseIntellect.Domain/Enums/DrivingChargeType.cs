namespace CourseIntellect.Domain.Enums;

/// <summary>Sürücü kursunun paket dışında çıkardığı ücret kalemleri.</summary>
public enum DrivingChargeType
{
    /// <summary>Ek direksiyon dersi — ders hakkına dakika da ekler.</summary>
    ExtraLesson = 1,

    /// <summary>Sınav ücreti (e-sınav, direksiyon sınavı).</summary>
    ExamFee = 2,

    /// <summary>Dosya/evrak masrafı.</summary>
    FileFee = 3,

    /// <summary>Ek hizmet (simülasyon, özel öğretmen, premium araç…).</summary>
    ExtraService = 4,

    /// <summary>Paket veya vites değişikliğinden doğan fiyat farkı.</summary>
    PackageDifference = 5,

    Other = 6,
}

public static class DrivingChargeTypes
{
    public static string Label(DrivingChargeType type) => type switch
    {
        DrivingChargeType.ExtraLesson => "Ek direksiyon dersi",
        DrivingChargeType.ExamFee => "Sınav ücreti",
        DrivingChargeType.FileFee => "Dosya masrafı",
        DrivingChargeType.ExtraService => "Ek hizmet",
        DrivingChargeType.PackageDifference => "Paket/vites farkı",
        _ => "Diğer ücret",
    };

    /// <summary>Ders hakkına dakika ekleyen kalemler — dakika alanı zorunludur.</summary>
    public static bool AddsLessonMinutes(DrivingChargeType type)
        => type is DrivingChargeType.ExtraLesson;
}
