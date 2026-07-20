using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

/// <summary>
/// Asistanın kapsamı kurum türüne göre daralmalı: bir okul yöneticisine
/// "kursiyer ilerlemesi", bir sürücü kursuna "servis nerede" gösterilmemeli.
/// Bu testler o sınırı kilitler.
/// </summary>
public sealed class AssistantIntentCatalogTests
{
    // ─── Sürücü kursuna özgü niyetler okulda görünmemeli ──────────────────────
    [Theory]
    [InlineData(AssistantIntent.GetDrivingLessons)]
    [InlineData(AssistantIntent.GetDrivingProgress)]
    [InlineData(AssistantIntent.GetDrivingExamStatus)]
    [InlineData(AssistantIntent.GetDrivingDocuments)]
    [InlineData(AssistantIntent.GetDrivingAppointments)]
    [InlineData(AssistantIntent.GetDrivingGraduation)]
    public void DrivingIntents_AreHiddenFromAcademicInstitutions(AssistantIntent intent)
    {
        Assert.False(AssistantIntentCatalog.IsAvailableFor(intent, InstitutionType.PrivateSchool));
        Assert.False(AssistantIntentCatalog.IsAvailableFor(intent, InstitutionType.CourseCenter));
        Assert.False(AssistantIntentCatalog.IsAvailableFor(intent, InstitutionType.StudyCenter));
        Assert.True(AssistantIntentCatalog.IsAvailableFor(intent, InstitutionType.DrivingSchool));
    }

    // ─── Okula özgü niyetler sürücü kursunda görünmemeli ──────────────────────
    // Sürücü kursunun ödevi, ders programı, sınıf listesi veya öğrenci servisi yok.
    [Theory]
    [InlineData(AssistantIntent.GetHomework)]
    [InlineData(AssistantIntent.GetSchedule)]
    [InlineData(AssistantIntent.ListClassStudents)]
    [InlineData(AssistantIntent.GetTransportStatus)]
    [InlineData(AssistantIntent.GetAttendance)]
    [InlineData(AssistantIntent.GetLibraryLoans)]
    public void AcademicIntents_AreHiddenFromDrivingSchools(AssistantIntent intent)
    {
        Assert.False(AssistantIntentCatalog.IsAvailableFor(intent, InstitutionType.DrivingSchool));
        Assert.True(AssistantIntentCatalog.IsAvailableFor(intent, InstitutionType.PrivateSchool));
    }

    // ─── Ortak niyetler her kurumda açık kalmalı ──────────────────────────────
    [Theory]
    [InlineData(AssistantIntent.Greeting)]
    [InlineData(AssistantIntent.Help)]
    [InlineData(AssistantIntent.SearchStudent)]
    [InlineData(AssistantIntent.GetPaymentSummary)]
    [InlineData(AssistantIntent.GetAnnouncements)]
    public void SharedIntents_AreAvailableEverywhere(AssistantIntent intent)
    {
        foreach (var type in Enum.GetValues<InstitutionType>())
            Assert.True(AssistantIntentCatalog.IsAvailableFor(intent, type), $"{intent} / {type}");
    }

    // ─── Rol kapıları ─────────────────────────────────────────────────────────
    [Fact]
    public void Accounting_CannotReachAcademicIntents()
    {
        Assert.False(AssistantIntentCatalog.IsAllowedForRole(AssistantIntent.GetAttendance, "Accounting"));
        Assert.False(AssistantIntentCatalog.IsAllowedForRole(AssistantIntent.GetExamResults, "accounting"));
        // Muhasebe öğrenci arayabilmeli — tahsilat için gerekli.
        Assert.True(AssistantIntentCatalog.IsAllowedForRole(AssistantIntent.SearchStudent, "Accounting"));
        Assert.True(AssistantIntentCatalog.IsAllowedForRole(AssistantIntent.ListStudentsWithDebt, "Accounting"));
    }

    [Fact]
    public void Teacher_CannotReachFinanceIntents()
    {
        Assert.False(AssistantIntentCatalog.IsAllowedForRole(AssistantIntent.GetPaymentSummary, "Teacher"));
        Assert.False(AssistantIntentCatalog.IsAllowedForRole(AssistantIntent.ListStudentsWithDebt, "teacher"));
        Assert.True(AssistantIntentCatalog.IsAllowedForRole(AssistantIntent.GetAttendance, "Teacher"));
    }

    /// <summary>
    /// Modül anahtarları eski <c>RequiredModule</c> switch'inden taşındı;
    /// yanlış anahtar sessizce yetki kapısını atlatır, o yüzden kilitleniyor.
    /// </summary>
    [Theory]
    [InlineData(AssistantIntent.GetAttendance, "attendance")]
    [InlineData(AssistantIntent.GetExamResults, "exams")]
    [InlineData(AssistantIntent.GetHomework, "assignments")]
    [InlineData(AssistantIntent.GetPaymentSummary, "finance")]
    [InlineData(AssistantIntent.GetTransportStatus, "service")]
    [InlineData(AssistantIntent.SearchStudent, "students")]
    [InlineData(AssistantIntent.GetDrivingProgress, "students")]
    [InlineData(AssistantIntent.Greeting, null)]
    public void RequiredModule_MatchesLegacyMapping(AssistantIntent intent, string? expected)
        => Assert.Equal(expected, AssistantIntentCatalog.RequiredModule(intent));

    /// <summary>
    /// Kataloğa girmemiş bir niyet kazara "her kurumda açık" olmamalı diye
    /// enum'daki her değerin bilinçli olarak ele alındığını doğrularız.
    /// Yeni intent eklenince bu test hatırlatır.
    /// </summary>
    [Fact]
    public void EveryIntent_HasAnExplicitScope()
    {
        var unscoped = Enum.GetValues<AssistantIntent>()
            .Where(intent => AssistantIntentCatalog.ScopeOf(intent) is { InstitutionTypes.Count: 0, RequiredModule: null, DeniedRoles.Count: 0 }
                             && intent is not (AssistantIntent.Unknown or AssistantIntent.Help or AssistantIntent.Greeting))
            .ToList();

        Assert.True(unscoped.Count == 0,
            $"Kataloğa eklenmemiş niyetler: {string.Join(", ", unscoped)}");
    }
}
