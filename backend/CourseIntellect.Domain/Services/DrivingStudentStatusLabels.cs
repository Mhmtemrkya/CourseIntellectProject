using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Services;

/// <summary>
/// Sürücü kursu kursiyer durumlarının Türkçe etiketleri için TEK kaynak. Daha önce aynı
/// eşleme <c>DrivingSchoolController</c> içinde satır arası bir sözlük olarak duruyordu;
/// yeni durum eklendiğinde bir yerde güncellenip diğerinde unutulma riski vardı.
/// </summary>
public static class DrivingStudentStatusLabels
{
    private static readonly IReadOnlyDictionary<DrivingStudentStatus, string> Labels =
        new Dictionary<DrivingStudentStatus, string>
        {
            [DrivingStudentStatus.PreRegistered] = "Ön kayıt",
            [DrivingStudentStatus.DocumentsPending] = "Evrak bekliyor",
            [DrivingStudentStatus.Active] = "Aktif",
            [DrivingStudentStatus.TheoryOngoing] = "Teorik eğitimde",
            [DrivingStudentStatus.PracticeOngoing] = "Direksiyonda",
            [DrivingStudentStatus.ExamPending] = "Sınav bekliyor",
            [DrivingStudentStatus.GraduationPending] = "Mezuniyet onayı",
            [DrivingStudentStatus.Graduated] = "Mezun",
            [DrivingStudentStatus.Suspended] = "Askıda",
            [DrivingStudentStatus.Cancelled] = "İptal",
        };

    /// <summary>Duruma karşılık gelen Türkçe etiketi verir; tanımsızsa enum adını döndürür.</summary>
    public static string Of(DrivingStudentStatus status) =>
        Labels.TryGetValue(status, out var label) ? label : status.ToString();
}
