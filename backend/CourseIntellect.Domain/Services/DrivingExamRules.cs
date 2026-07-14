using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Services;

public static class DrivingExamRules
{
    public static DrivingStudentStatus StudentStatusAfterResult(DrivingExamType examType, bool passed)
    {
        if (!passed) return DrivingStudentStatus.ExamPending;

        return examType == DrivingExamType.TheoryEExam
            ? DrivingStudentStatus.PracticeOngoing
            : DrivingStudentStatus.GraduationPending;
    }

    public static bool CanScheduleRetry(DrivingExamCandidateStatus status)
        => status == DrivingExamCandidateStatus.Failed;
}
