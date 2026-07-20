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
    GetDrivingProgress
}

public enum AssistantSenderType { User = 1, Assistant = 2, System = 3 }
public enum AssistantMessageType { Text = 1, Structured = 2, Error = 3, PermissionDenied = 4 }
