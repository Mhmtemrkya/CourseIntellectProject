using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

public sealed class AssistantIntentResolverTests
{
    private readonly RuleBasedAssistantIntentResolver resolver = new();

    [Theory]
    [InlineData("Zeynep Kaya'nın devamsızlığını göster", AssistantIntent.GetAttendance)]
    [InlineData("Bekleyen ödevlerimi göster", AssistantIntent.GetHomework)]
    [InlineData("Bugünkü derslerim", AssistantIntent.GetSchedule)]
    [InlineData("Kalan direksiyon ders hakkım", AssistantIntent.GetDrivingProgress)]
    [InlineData("Direksiyon sınav durumum", AssistantIntent.GetDrivingExamStatus)]
    [InlineData("Borcu olan öğrencileri listele", AssistantIntent.ListStudentsWithDebt)]
    public void ResolvesExpectedIntent(string message, AssistantIntent expected)
    {
        Assert.Equal(expected, resolver.Resolve(message).Intent);
    }

    [Theory]
    [InlineData("Ahmet Yılmaz 10-A", 10, "A")]
    [InlineData("Ahmet Yılmaz 10/A", 10, "A")]
    [InlineData("10. sınıf A şubesi öğrencileri", 10, "A")]
    [InlineData("8B sınıfını listele", 8, "B")]
    public void ParsesClassFormats(string message, int grade, string section)
    {
        var result = resolver.Resolve(message);
        Assert.Equal(grade, result.GradeLevel);
        Assert.Equal(section, result.SectionName);
    }

    [Fact]
    public void PreservesAndValidatesTurkishIdentityNumber()
    {
        var result = resolver.Resolve("10000000146 TC'li öğrenciyi getir");
        Assert.Equal("10000000146", result.TcNo);
        Assert.True(RuleBasedAssistantIntentResolver.IsValidTurkishIdentityNumber(result.TcNo));
        Assert.False(RuleBasedAssistantIntentResolver.IsValidTurkishIdentityNumber("12345678901"));
    }

    [Fact]
    public void NormalizationIsTurkishAware()
    {
        var result = resolver.Resolve("  İPEK   ŞEN'in ÖDEVLERİNİ göster  ");
        Assert.Equal(AssistantIntent.GetHomework, result.Intent);
        Assert.Contains("ipek", result.SearchText);
    }

    // ─── Faz 2 niyetleri ──────────────────────────────────────────────────────
    // Kural motoru sıraya duyarlı: önce eşleşen kural kazanır. Faz 2 kuralları
    // daha genel olanların ÖNÜNE eklendi, o yüzden hem yeni eşleşmeler hem de
    // bozulmaması gereken eskiler burada kilitleniyor.
    [Theory]
    [InlineData("Ali'nin evrak durumu ne", AssistantIntent.GetDrivingDocuments)]
    [InlineData("eksik belge var mı", AssistantIntent.GetDrivingDocuments)]
    [InlineData("sağlık raporu yüklendi mi", AssistantIntent.GetDrivingDocuments)]
    [InlineData("yaklaşan randevuları göster", AssistantIntent.GetDrivingAppointments)]
    [InlineData("mezun oldu mu", AssistantIntent.GetDrivingGraduation)]
    [InlineData("sertifika numarası ne", AssistantIntent.GetDrivingGraduation)]
    [InlineData("üzerinde kitap var mı", AssistantIntent.GetLibraryLoans)]
    [InlineData("kütüphaneden aldıkları", AssistantIntent.GetLibraryLoans)]
    public void ResolvesPhase2Intents(string message, AssistantIntent expected)
        => Assert.Equal(expected, resolver.Resolve(message).Intent);

    /// <summary>
    /// "randevu" kelimesi eskiden GetDrivingLessons'a düşüyordu; ayrıştırdıktan
    /// sonra direksiyon dersi sorgusunun hâlâ kendi niyetine gittiğini doğrular.
    /// </summary>
    [Theory]
    [InlineData("direksiyon dersleri", AssistantIntent.GetDrivingLessons)]
    [InlineData("sürüş dersi geçmişi", AssistantIntent.GetDrivingLessons)]
    public void DrivingLessonsStillResolve_AfterAppointmentSplit(string message, AssistantIntent expected)
        => Assert.Equal(expected, resolver.Resolve(message).Intent);

    // ─── Faz 4: yazma eylemleri ───────────────────────────────────────────────
    [Theory]
    [InlineData("Ali'ye evrak hatırlatması gönder", AssistantIntent.SendDocumentReminder)]
    [InlineData("eksik belge için hatırlat", AssistantIntent.SendDocumentReminder)]
    [InlineData("veliyi bilgilendir", AssistantIntent.NotifyParentAboutAbsence)]
    [InlineData("veliye haber ver", AssistantIntent.NotifyParentAboutAbsence)]
    public void ResolvesWriteActions(string message, AssistantIntent expected)
        => Assert.Equal(expected, resolver.Resolve(message).Intent);

    /// <summary>
    /// "evrak durumu" (sorgu) ile "evrak hatırlatması gönder" (yazma) ayrışmalı.
    /// Yazma kuralı en önde olduğu için sorgunun yutulmadığını doğrularız.
    /// </summary>
    [Fact]
    public void DocumentQuery_IsNotMistakenForWriteAction()
    {
        Assert.Equal(AssistantIntent.GetDrivingDocuments, resolver.Resolve("evrak durumu ne").Intent);
        Assert.Equal(AssistantIntent.GetDrivingDocuments, resolver.Resolve("eksik belge var mı").Intent);
        Assert.Equal(AssistantIntent.SendDocumentReminder, resolver.Resolve("eksik belge için hatırlatma gönder").Intent);
    }

    // ─── Faz 5: analitik özetler ──────────────────────────────────────────────
    [Theory]
    [InlineData("bu ay tahsilat ne kadar", AssistantIntent.GetFinanceOverview)]
    [InlineData("toplam borç ne kadar", AssistantIntent.GetFinanceOverview)]
    [InlineData("kasa durumu", AssistantIntent.GetFinanceOverview)]
    [InlineData("kaç kursiyer var", AssistantIntent.GetInstitutionSummary)]
    [InlineData("bu ay kaç mezun oldu", AssistantIntent.GetInstitutionSummary)]
    [InlineData("kurum özeti ver", AssistantIntent.GetInstitutionSummary)]
    public void ResolvesAnalyticsIntents(string message, AssistantIntent expected)
        => Assert.Equal(expected, resolver.Resolve(message).Intent);

    /// <summary>
    /// "toplam borç ne kadar" (özet) ile "borcu olan öğrenciler" (liste) ayrışmalı.
    /// Özet kuralı listenin önünde olduğu için niceleyicili soru özete gider.
    /// </summary>
    [Fact]
    public void DebtSummary_IsNotMistakenForDebtList()
    {
        Assert.Equal(AssistantIntent.GetFinanceOverview, resolver.Resolve("toplam borç ne kadar").Intent);
        Assert.Equal(AssistantIntent.ListStudentsWithDebt, resolver.Resolve("borcu olan öğrencileri listele").Intent);
    }
}
