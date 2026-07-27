using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

/// <summary>
/// Kişi adı biçiminin sözleşmesi: ad(lar) baş harfi büyük, SOYAD tamamen büyük.
///
/// Kural tek tek servislerde uygulanmaya çalışıldığında sürekli atlanıyordu
/// (aday adayı kaydı canlıda "ahmet mehmet yildirim" olarak yazılmıştı). Artık
/// DbContext.SaveChanges sınırında zorlanıyor; bu testler yazma yolu ne olursa
/// olsun biçimin bozulmadığını doğrular.
/// </summary>
public sealed class PersonNamePersistenceTests
{
    [Theory]
    [InlineData("ahmet mehmet yıldırım", "Ahmet Mehmet YILDIRIM")]
    // Türkçe büyütme: ASCII "i" harfi "İ" olur (İsmail → İSMAİL). Kullanıcı "ı"
    // yerine "i" yazdıysa sonuç "İ" çıkar; biçimlendirici harf tahmini yapmaz.
    [InlineData("ismail yilmaz", "İsmail YİLMAZ")]
    [InlineData("AHMET YILMAZ", "Ahmet YILMAZ")]
    [InlineData("  deniz   yılmaz  ", "Deniz YILMAZ")]
    [InlineData("ömer faruk çağatay", "Ömer Faruk ÇAĞATAY")]
    [InlineData("ışıl ışık", "Işıl IŞIK")]
    [InlineData("mehmet ali şen-kaya", "Mehmet Ali ŞEN-KAYA")]
    [InlineData("ayşe", "Ayşe")]
    public void Formatter_NormalizesNames(string input, string expected) =>
        Assert.Equal(expected, PersonNameFormatter.FormatFullName(input));

    [Fact]
    public void SaveChanges_FormatsNewLeadName()
    {
        using var db = new TestDb();
        db.Context.DrivingLeads.Add(new DrivingLead
        {
            FullName = "ahmet mehmet yıldırım",
            Phone = "05321119988",
            LicenseClass = "B",
        });
        db.Context.SaveChanges();

        var saved = db.Context.DrivingLeads.Single();
        Assert.Equal("Ahmet Mehmet YILDIRIM", saved.FullName);
    }

    [Fact]
    public void SaveChanges_FormatsUserAndStudentNames()
    {
        using var db = new TestDb();
        db.Context.Users.Add(new AppUser { FullName = "elif nur kaya", Username = "elif", PasswordHash = "x" });
        db.Context.Students.Add(new StudentProfile { FullName = "burak aslan", ParentName = "hatice aslan" });
        db.Context.SaveChanges();

        Assert.Equal("Elif Nur KAYA", db.Context.Users.Single().FullName);
        var student = db.Context.Students.Single();
        Assert.Equal("Burak ASLAN", student.FullName);
        Assert.Equal("Hatice ASLAN", student.ParentName);
    }

    [Fact]
    public void SaveChanges_FormatsOnUpdateToo()
    {
        using var db = new TestDb();
        db.Context.Users.Add(new AppUser { FullName = "Test KULLANICI", Username = "t", PasswordHash = "x" });
        db.Context.SaveChanges();

        var user = db.Context.Users.Single();
        user.FullName = "yeni ad soyadı";
        db.Context.SaveChanges();

        Assert.Equal("Yeni Ad SOYADI", db.Context.Users.Single().FullName);
    }

    [Fact]
    public void SaveChanges_DoesNotTouchNonPersonNames()
    {
        using var db = new TestDb();
        // Paket adı kişi adı değildir; "B Sınıfı Standart PAKET" olmamalı.
        db.Context.DrivingPackages.Add(new DrivingPackage
        {
            Name = "B Sınıfı Standart Paket",
            LicenseClass = "B",
            IsActive = true,
        });
        db.Context.SaveChanges();

        Assert.Equal("B Sınıfı Standart Paket", db.Context.DrivingPackages.Single().Name);
    }

    [Fact]
    public void SaveChanges_LeavesAuditActorNameUntouched()
    {
        using var db = new TestDb();
        // Denetim kaydı geçmişi yansıtır; sonradan biçimlendirilmez.
        db.Context.AuditLogEntries.Add(new AuditLogEntry
        {
            ActorName = "kayit anindaki hali",
            Action = "Test",
            EntityType = "Test",
            EntityId = "1",
        });
        db.Context.SaveChanges();

        Assert.Equal("kayit anindaki hali", db.Context.AuditLogEntries.Single().ActorName);
    }
}
