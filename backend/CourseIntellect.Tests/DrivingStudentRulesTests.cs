using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

/// <summary>
/// Kurs dosyası kurallarının sözleşmesi: kimin hangi belgesi zorunlu, süresi dolan
/// belge ne olur, TC doğrulaması gerçekten çalışıyor mu.
/// </summary>
public sealed class DrivingStudentRulesTests
{
    private static readonly DateTime Now = new(2026, 7, 14, 12, 0, 0, DateTimeKind.Utc);

    [Theory]
    // Gerçek algoritmaya göre üretilmiş geçerli numaralar.
    [InlineData("10000000146", true)]
    [InlineData("12345678950", true)]
    // Kontrol basamağı tutmuyor.
    [InlineData("12345678901", false)]
    [InlineData("11111111111", false)]
    // Biçim hataları.
    [InlineData("01234567890", false)]
    [InlineData("123456789", false)]
    [InlineData("1234567890A", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsValidTurkishId_ChecksOfficialAlgorithm(string? value, bool expected)
        => Assert.Equal(expected, DrivingStudentRules.IsValidTurkishId(value));

    [Fact]
    public void RequiredDocuments_AddParentalConsent_OnlyForMinors()
    {
        var minor = DrivingStudentRules.RequiredDocumentsFor("2010-01-01", Now);
        var adult = DrivingStudentRules.RequiredDocumentsFor("1990-01-01", Now);

        Assert.Contains(StudentDocumentType.ParentalConsent, minor);
        Assert.DoesNotContain(StudentDocumentType.ParentalConsent, adult);
        Assert.Equal(DrivingStudentRules.BaseRequiredDocuments.Count, adult.Count);
    }

    [Fact]
    public void ExpiredDocument_IsNotApproved_EvenIfItWasApprovedBefore()
    {
        var expired = Now.AddDays(-1);

        Assert.Equal(
            StudentDocumentStatus.Expired,
            DrivingStudentRules.EffectiveStatus(StudentDocumentStatus.Approved, expired, Now));
        Assert.False(DrivingStudentRules.CountsAsSatisfied(StudentDocumentStatus.Approved, expired, Now));

        // Geçerlilik sürerken onaylı belge sayılır.
        Assert.True(DrivingStudentRules.CountsAsSatisfied(StudentDocumentStatus.Approved, Now.AddDays(30), Now));
        // Süresiz belgeler (kimlik, diploma) de sayılır.
        Assert.True(DrivingStudentRules.CountsAsSatisfied(StudentDocumentStatus.Approved, null, Now));
    }

    [Fact]
    public void PendingOrRejectedDocument_NeverCountsAsSatisfied()
    {
        Assert.False(DrivingStudentRules.CountsAsSatisfied(StudentDocumentStatus.PendingApproval, null, Now));
        Assert.False(DrivingStudentRules.CountsAsSatisfied(StudentDocumentStatus.Rejected, null, Now));
    }

    [Fact]
    public void MissingDocuments_ListsRequiredButUnsatisfied()
    {
        var required = DrivingStudentRules.RequiredDocumentsFor("1990-01-01", Now);
        var satisfied = new HashSet<StudentDocumentType>
        {
            StudentDocumentType.Identity,
            StudentDocumentType.Diploma,
            StudentDocumentType.BiometricPhoto,
        };

        var missing = DrivingStudentRules.MissingDocuments(required, satisfied);

        Assert.Contains(StudentDocumentType.HealthReport, missing);
        Assert.Contains(StudentDocumentType.CriminalRecord, missing);
        Assert.Contains(StudentDocumentType.Residence, missing);
        Assert.DoesNotContain(StudentDocumentType.Identity, missing);
    }

    [Fact]
    public void HealthReportAndCriminalRecord_AreTreatedAsExpiringDocuments()
    {
        Assert.Contains(StudentDocumentType.HealthReport, DrivingStudentRules.ExpiringDocuments);
        Assert.Contains(StudentDocumentType.CriminalRecord, DrivingStudentRules.ExpiringDocuments);
        // Kimlik ve diploma süresizdir; tarih zorunluluğu aranmaz.
        Assert.DoesNotContain(StudentDocumentType.Identity, DrivingStudentRules.ExpiringDocuments);
        Assert.DoesNotContain(StudentDocumentType.Diploma, DrivingStudentRules.ExpiringDocuments);
    }

    [Fact]
    public void SchedulableStatuses_ExcludeIncompleteAndClosedFiles()
    {
        Assert.Contains(DrivingStudentStatus.Active, DrivingStudentStatuses.Schedulable);
        Assert.Contains(DrivingStudentStatus.PracticeOngoing, DrivingStudentStatuses.Schedulable);

        // Evrakı eksik, askıdaki veya ayrılmış aday randevu alamaz.
        Assert.DoesNotContain(DrivingStudentStatus.DocumentsPending, DrivingStudentStatuses.Schedulable);
        Assert.DoesNotContain(DrivingStudentStatus.PreRegistered, DrivingStudentStatuses.Schedulable);
        Assert.DoesNotContain(DrivingStudentStatus.Suspended, DrivingStudentStatuses.Schedulable);
        Assert.DoesNotContain(DrivingStudentStatus.Cancelled, DrivingStudentStatuses.Schedulable);
        Assert.DoesNotContain(DrivingStudentStatus.Graduated, DrivingStudentStatuses.Schedulable);
    }

    [Fact]
    public void OpenStatuses_CountEnrolledButNotGraduatedOrCancelled()
    {
        Assert.Contains(DrivingStudentStatus.DocumentsPending, DrivingStudentStatuses.Open);
        Assert.DoesNotContain(DrivingStudentStatus.Graduated, DrivingStudentStatuses.Open);
        Assert.DoesNotContain(DrivingStudentStatus.Cancelled, DrivingStudentStatuses.Open);
        Assert.DoesNotContain(DrivingStudentStatus.Suspended, DrivingStudentStatuses.Open);
    }

    // ─── MEBBİS eksik alan kuralı ────────────────────────────────────────────

    private static DrivingStudentRules.MebbisCandidate CompleteCandidate() => new(
        HasValidNationalId: true,
        BirthDate: "2000-01-01",
        FatherName: "Ahmet",
        MotherName: "Ayşe",
        BirthPlace: "Ankara",
        EducationLevel: "Lise",
        IdentitySerialNo: "A12345678",
        Phone: "05321112233",
        HasPhoto: true,
        HealthReportApproved: true,
        HealthReportDetailsComplete: true,
        DiplomaApproved: true,
        CriminalRecordApproved: true);

    [Fact]
    public void MebbisMissingFields_CompleteCandidate_ReturnsEmpty()
        => Assert.Empty(DrivingStudentRules.MebbisMissingFields(CompleteCandidate()));

    [Fact]
    public void MebbisMissingFields_ListsEveryMissingItem()
    {
        var missing = DrivingStudentRules.MebbisMissingFields(CompleteCandidate() with
        {
            FatherName = "",
            MotherName = "  ",
            BirthPlace = null,
            IdentitySerialNo = null,
        });
        Assert.Equal(["Baba adı", "Anne adı", "Doğum yeri", "Kimlik seri no"], missing);
    }

    [Fact]
    public void MebbisMissingFields_HealthReportDetails_OnlyAskedWhenReportApproved()
    {
        // Rapor hiç yoksa detay istenmez — önce raporun kendisi eksiktir.
        var withoutReport = DrivingStudentRules.MebbisMissingFields(CompleteCandidate() with
        {
            HealthReportApproved = false,
            HealthReportDetailsComplete = false,
        });
        Assert.Contains("Onaylı sağlık raporu", withoutReport);
        Assert.DoesNotContain("Sağlık raporu no / veren kurum / tarih", withoutReport);

        // Rapor onaylı ama no/kurum/tarih girilmemişse detay eksiği çıkar.
        var withReport = DrivingStudentRules.MebbisMissingFields(CompleteCandidate() with
        {
            HealthReportDetailsComplete = false,
        });
        Assert.Equal(["Sağlık raporu no / veren kurum / tarih"], withReport);
    }

    // ─── Resmî teorik müfredat ───────────────────────────────────────────────

    [Fact]
    public void Curriculum_TotalIs34LessonHours()
        => Assert.Equal(34, DrivingCurriculum.TotalRequiredHours);

    [Theory]
    [InlineData("Trafik ve Çevre Bilgisi", "trafik")]
    [InlineData("TRAFİK", "trafik")]
    [InlineData("İlk Yardım", "ilkyardim")]
    [InlineData("ilkyardim", "ilkyardim")]
    [InlineData("Motor ve Araç Tekniği", "motor")]
    [InlineData("Araç Tekniği", "motor")]
    [InlineData("Trafik Adabı", "adab")]
    [InlineData("trafik adabi", "adab")]
    public void Curriculum_MatchesFreeTextSubjects(string subject, string expectedKey)
        => Assert.Equal(expectedKey, DrivingCurriculum.MatchSubject(subject)?.Key);

    [Fact]
    public void Curriculum_UnknownSubject_DoesNotMatch()
        => Assert.Null(DrivingCurriculum.MatchSubject("Satranç"));

    [Fact]
    public void Curriculum_MinutesToLessonHours_TruncatesPartialHours()
    {
        Assert.Equal(0, DrivingCurriculum.MinutesToLessonHours(44));
        Assert.Equal(1, DrivingCurriculum.MinutesToLessonHours(45));
        Assert.Equal(1, DrivingCurriculum.MinutesToLessonHours(89));
        Assert.Equal(16, DrivingCurriculum.MinutesToLessonHours(16 * 45));
    }
}
