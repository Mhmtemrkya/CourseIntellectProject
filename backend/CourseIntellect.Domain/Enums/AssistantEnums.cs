namespace CourseIntellect.Domain.Enums;

public enum AssistantIntent
{
    Unknown = 0,
    Help,
    Greeting,
    SearchStudent,
    GetStudentSummary,
    GetAttendance,
    GetExamResults,
    GetExamAverage,
    GetHomework,
    GetSchedule,
    GetUpcomingExams,
    GetAnnouncements,
    GetUnreadMessages,
    GetPaymentSummary,
    GetTransportStatus,
    ListClassStudents,
    ListAbsentStudents,
    ListLowScoreStudents,
    ListStudentsWithDebt,
    OpenStudentDetail,
    GetDrivingLessons,
    GetDrivingExamStatus,
    GetDrivingProgress,

    // ─── Faz 2: modül kapsamı ─────────────────────────────────────────────
    /// <summary>Kursiyerin evrak dosyası: eksik, onay bekleyen ve süresi geçen belgeler.</summary>
    GetDrivingDocuments,
    /// <summary>Yaklaşan direksiyon randevuları (tarih, eğitmen, araç).</summary>
    GetDrivingAppointments,
    /// <summary>Mezuniyet ve sertifika durumu.</summary>
    GetDrivingGraduation,
    /// <summary>Öğrencinin üzerindeki kütüphane kitapları ve gecikmeler.</summary>
    GetLibraryLoans,

    // ─── Faz 4: yazma eylemleri ───────────────────────────────────────────
    // DİKKAT: Bu niyetler VERİ DEĞİŞTİRİR. Asla ilk turda çalıştırılmazlar;
    // asistan önce bir onay kartı üretir, kullanıcı onaylarsa yürütülür.
    // Yeni bir yazma niyeti eklerken AssistantIntentCatalog.IsWriteAction
    // listesine de eklenmelidir, aksi hâlde onay kapısı atlanır.
    /// <summary>Kursiyere eksik evrakları için hatırlatma bildirimi gönderir.</summary>
    SendDocumentReminder,
    /// <summary>Öğrencinin velisine devamsızlık bilgilendirmesi gönderir.</summary>
    NotifyParentAboutAbsence
}

public enum AssistantSenderType { User = 1, Assistant = 2, System = 3 }
public enum AssistantMessageType { Text = 1, Structured = 2, Error = 3, PermissionDenied = 4 }
