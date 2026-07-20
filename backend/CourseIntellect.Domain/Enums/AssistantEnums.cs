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
    GetLibraryLoans
}

public enum AssistantSenderType { User = 1, Assistant = 2, System = 3 }
public enum AssistantMessageType { Text = 1, Structured = 2, Error = 3, PermissionDenied = 4 }
