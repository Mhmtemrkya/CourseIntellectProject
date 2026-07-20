using System.Globalization;
using System.Text;
using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Services;

public static class DrivingMebbisReconciliationRules
{
    public static bool SameText(string? left, string? right) => Normalize(left ?? "") == Normalize(right ?? "");
    public static bool SamePhone(string? left, string? right) => NormalizePhone(left) == NormalizePhone(right);

    public static bool SameExamResult(DrivingExamCandidateStatus? local, string external)
    {
        var value = Normalize(external);
        var parsed = value is "gecti" or "basarili" or "passed" ? DrivingExamCandidateStatus.Passed
            : value is "kaldi" or "basarisiz" or "failed" ? DrivingExamCandidateStatus.Failed : (DrivingExamCandidateStatus?)null;
        return parsed.HasValue && local == parsed;
    }

    public static bool SameStudentStatus(DrivingStudentStatus local, string external)
    {
        var parsed = Normalize(external) switch
        {
            "aktif" or "active" => DrivingStudentStatus.Active,
            "teorikegitimde" or "theoryongoing" => DrivingStudentStatus.TheoryOngoing,
            "direksiyonda" or "practiceongoing" => DrivingStudentStatus.PracticeOngoing,
            "sinavbekliyor" or "exampending" => DrivingStudentStatus.ExamPending,
            "mezun" or "graduated" => DrivingStudentStatus.Graduated,
            "askida" or "suspended" => DrivingStudentStatus.Suspended,
            "iptal" or "cancelled" => DrivingStudentStatus.Cancelled,
            _ => (DrivingStudentStatus?)null,
        };
        return parsed.HasValue && local == parsed;
    }

    public static string Digits(string value) => new(value.Where(char.IsDigit).ToArray());
    private static string NormalizePhone(string? value)
    {
        var digits = Digits(value ?? "");
        if (digits.Length == 12 && digits.StartsWith("90", StringComparison.Ordinal)) digits = $"0{digits[2..]}";
        else if (digits.Length == 10) digits = $"0{digits}";
        return digits;
    }
    public static string Normalize(string value) => new(value.Replace('ı', 'i').Replace('İ', 'I').Normalize(NormalizationForm.FormD)
        .Where(x => CharUnicodeInfo.GetUnicodeCategory(x) != UnicodeCategory.NonSpacingMark && char.IsLetterOrDigit(x))
        .Select(char.ToLowerInvariant).ToArray());
}
