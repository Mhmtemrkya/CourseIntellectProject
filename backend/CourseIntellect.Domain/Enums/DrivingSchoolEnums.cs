namespace CourseIntellect.Domain.Enums;

public enum TransmissionType { Manual = 1, Automatic = 2 }

/// <summary>
/// Kurumun işletme gider kalemleri (personel maaş/prim HARİÇ — onlar bordro tarafında).
/// Yakıt ve bakım araca bağlanabildiği için filo maliyet analizini besler.
/// </summary>
public enum DrivingExpenseCategory
{
    Fuel = 1,          // Mazot / yakıt
    Maintenance = 2,   // Bakım / onarım / lastik
    Insurance = 3,     // Sigorta / kasko
    Rent = 4,          // Kira
    Utilities = 5,     // Elektrik / su / doğalgaz / internet / telefon
    TaxFee = 6,        // Vergi / harç / resmî ödeme
    Office = 7,        // Kırtasiye / ofis / temizlik
    Marketing = 8,     // Reklam / tanıtım
    Other = 9,         // Diğer
}

/// <summary>
/// Randevunun yaşam döngüsü. İlk beş değer eski kayıtlarla uyum için korunur
/// (veritabanında adıyla saklanır); <see cref="Cancelled"/> artık yalnızca eski
/// veridir — yeni iptaller kimin iptal ettiğini yazan değerleri kullanır.
/// Geçiş kuralları <see cref="DrivingAppointmentStatuses"/>'te.
/// </summary>
public enum DrivingAppointmentStatus
{
    Planned = 1,
    Approved = 2,
    InProgress = 3,
    Completed = 4,
    Cancelled = 5,

    Draft = 6,
    Requested = 7,
    WaitingApproval = 8,
    CheckedIn = 9,
    CancelledByStudent = 10,
    CancelledByInstructor = 11,
    CancelledByInstitution = 12,
    NoShow = 13,
    Rescheduled = 14,
    Suspended = 15,
}
