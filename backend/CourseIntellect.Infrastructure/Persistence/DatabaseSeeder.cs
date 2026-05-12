using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Application.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace CourseIntellect.Infrastructure.Persistence;

public sealed class DatabaseSeeder(CourseIntellectDbContext dbContext, IPasswordHasher passwordHasher)
{
    private const string DeveloperAdminUsername = "admin@courseintlecct.com";
    private const string DeveloperAdminPassword = "Admin2026!";
    private const string LegacyPlatformAdminUsername = "admin.ece";

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        var demoTenant = await EnsureDemoTenantAsync(cancellationToken);
        if (dbContext.Entry(demoTenant).State == EntityState.Added)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        if (dbContext.Users.Any())
        {
            await EnsurePlatformAndTenantAdminsAsync(demoTenant, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            await AssignLegacyUsersToDemoTenantAsync(demoTenant, cancellationToken);
            await AssignLegacyTenantDataToDemoTenantAsync(demoTenant, cancellationToken);

            if (!dbContext.Users.Any(x => x.PrimaryRole == UserRole.Accounting && x.Username == "muhasebe.selim"))
            {
                var seededAccountingUser = new AppUser
                {
                    TenantId = demoTenant.Id,
                    FullName = "Selim Kara",
                    Username = "muhasebe.selim",
                    PasswordHash = passwordHasher.Hash("MHS2026A"),
                    PrimaryRole = UserRole.Accounting,
                    Campus = "Merkez Kampus",
                    DepartmentOrBranch = "Muhasebe"
                };

                await dbContext.Users.AddAsync(seededAccountingUser, cancellationToken);
                await dbContext.Staff.AddAsync(new StaffProfile
                {
                    UserId = seededAccountingUser.Id,
                    FullName = "Selim Kara",
                    TcNo = "67890123456",
                    Phone = "+90 555 777 30 30",
                    Email = "selim.kara@example.com",
                    Education = "Marmara Universitesi",
                    StartDate = "01.02.2025",
                    Campus = "Merkez Kampus",
                    DepartmentOrBranch = "Muhasebe",
                    HomeroomClass = "Sinif ogretmenligi yok",
                    AssignedClasses = [],
                    MaritalStatus = "Evli",
                    ChildCount = 1,
                    Note = "Tahsilat ve fatura operasyonlarindan sorumlu.",
                    TenantId = demoTenant.Id,
                    Role = UserRole.Accounting
                }, cancellationToken);
            }

            if (!dbContext.RolePolicies.Any())
            {
                await dbContext.RolePolicies.AddRangeAsync(
                [
                    new RolePolicy
                    {
                        RoleName = UserRole.Developer.ToString(),
                        IsActive = true,
                        LoginEnabled = true,
                        RequiresCriticalApproval = false,
                        MessagingScope = "Platform",
                        ModuleAccessSerialized = JsonSerializer.Serialize(new[] { "Platform", "Kurumlar", "Icerik", "Ayarlar" })
                    },
                    new RolePolicy
                    {
                        RoleName = UserRole.Admin.ToString(),
                        IsActive = true,
                        LoginEnabled = true,
                        RequiresCriticalApproval = false,
                        MessagingScope = "Tum roller",
                        ModuleAccessSerialized = JsonSerializer.Serialize(new[] { "Akademik", "Finans", "Operasyon", "Onaylar" })
                    },
                    new RolePolicy
                    {
                        RoleName = UserRole.Teacher.ToString(),
                        IsActive = true,
                        LoginEnabled = true,
                        RequiresCriticalApproval = false,
                        MessagingScope = "Ogrenci, veli, yonetici",
                        ModuleAccessSerialized = JsonSerializer.Serialize(new[] { "Akademik", "Icerik", "Sinavlar" })
                    },
                    new RolePolicy
                    {
                        RoleName = UserRole.Accounting.ToString(),
                        IsActive = true,
                        LoginEnabled = true,
                        RequiresCriticalApproval = true,
                        MessagingScope = "Veli, yonetici",
                        ModuleAccessSerialized = JsonSerializer.Serialize(new[] { "Finans", "Tahsilatlar", "Taksitler" })
                    },
                    new RolePolicy
                    {
                        RoleName = UserRole.Administrative.ToString(),
                        IsActive = true,
                        LoginEnabled = true,
                        RequiresCriticalApproval = false,
                        MessagingScope = "Veli, yonetici, muhasebe",
                        ModuleAccessSerialized = JsonSerializer.Serialize(new[] { "Kayit", "Evrak", "Duyurular" })
                    },
                    new RolePolicy
                    {
                        RoleName = UserRole.Parent.ToString(),
                        IsActive = true,
                        LoginEnabled = true,
                        RequiresCriticalApproval = false,
                        MessagingScope = "Ogretmen, yonetici",
                        ModuleAccessSerialized = JsonSerializer.Serialize(new[] { "Ogrenci", "Odeme", "Raporlar" })
                    },
                    new RolePolicy
                    {
                        RoleName = UserRole.Student.ToString(),
                        IsActive = true,
                        LoginEnabled = true,
                        RequiresCriticalApproval = false,
                        MessagingScope = "Ogretmen",
                        ModuleAccessSerialized = JsonSerializer.Serialize(new[] { "Sinavlar", "Icerikler", "Odevler" })
                    }
                ], cancellationToken);
            }

            if (!dbContext.Notifications.Any())
            {
                await dbContext.Notifications.AddRangeAsync(
                [
                    new NotificationItem
                    {
                        Title = "Kritik finans uyarisı",
                        Message = "3 ogrenci odemesi 7 gunu gecti, muhasebe aksiyon bekliyor.",
                        TimeLabel = "Bugun 14:20",
                        Audience = "Yonetici",
                        TargetRole = UserRole.Admin.ToString(),
                        Category = "Finans",
                        IsRead = false
                    },
                    new NotificationItem
                    {
                        Title = "Ogretmen yaniti geldi",
                        Message = "Matematik soruna cozum yollandi.",
                        TimeLabel = "2 dk once",
                        Audience = "Ogrenci",
                        TargetRole = UserRole.Student.ToString(),
                        Category = "Akademik",
                        IsRead = false
                    },
                    new NotificationItem
                    {
                        Title = "Yeni kayit tamamlandi",
                        Message = "Ali Yilmaz icin veli hos geldiniz bilgilendirmesi gonderildi.",
                        TimeLabel = "Bugun 11:15",
                        Audience = "Idari",
                        TargetRole = UserRole.Administrative.ToString(),
                        Category = "Kayit",
                        IsRead = false
                    }
                ], cancellationToken);
            }

            AssignTrackedTenantScopedEntitiesToDemoTenant(demoTenant.Id);
            await dbContext.SaveChangesAsync(cancellationToken);
            await AssignLegacyUsersToDemoTenantAsync(demoTenant, cancellationToken);
            await AssignLegacyTenantDataToDemoTenantAsync(demoTenant, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            return;
        }

        var developerUser = new AppUser
        {
            FullName = "CourseIntellect Developer Admin",
            Username = DeveloperAdminUsername,
            PasswordHash = passwordHasher.Hash(DeveloperAdminPassword),
            PrimaryRole = UserRole.Developer,
            Campus = "Platform",
            DepartmentOrBranch = "Development"
        };
        var tenantAdminUser = new AppUser
        {
            TenantId = demoTenant.Id,
            FullName = "Demo Kurum Yonetici",
            Username = "kurum.admin",
            PasswordHash = passwordHasher.Hash("KRM2026A"),
            PrimaryRole = UserRole.Admin,
            Campus = demoTenant.Name,
            DepartmentOrBranch = "Yonetim"
        };
        var teacherUser = new AppUser
        {
            TenantId = demoTenant.Id,
            FullName = "Hasan Yildiz",
            Username = "ogrt.hasan",
            PasswordHash = passwordHasher.Hash("HYN2026A"),
            PrimaryRole = UserRole.Teacher,
            Campus = "Merkez Kampus",
            DepartmentOrBranch = "Matematik"
        };
        var administrativeUser = new AppUser
        {
            TenantId = demoTenant.Id,
            FullName = "Ceren Aksoy",
            Username = "idari.ceren",
            PasswordHash = passwordHasher.Hash("CRN2026B"),
            PrimaryRole = UserRole.Administrative,
            ExtraRoles = [UserRole.Accounting],
            Campus = "Merkez Kampus",
            DepartmentOrBranch = "Ogrenci Isleri"
        };
        var accountingUser = new AppUser
        {
            TenantId = demoTenant.Id,
            FullName = "Selim Kara",
            Username = "muhasebe.selim",
            PasswordHash = passwordHasher.Hash("MHS2026A"),
            PrimaryRole = UserRole.Accounting,
            Campus = "Merkez Kampus",
            DepartmentOrBranch = "Muhasebe"
        };
        var studentUser = new AppUser
        {
            TenantId = demoTenant.Id,
            FullName = "Ali Yilmaz",
            Username = "ali10a241",
            PasswordHash = passwordHasher.Hash("ALI2026A"),
            PrimaryRole = UserRole.Student,
            Campus = "Merkez Kampus",
            DepartmentOrBranch = "10-A"
        };
        var parentUser = new AppUser
        {
            TenantId = demoTenant.Id,
            FullName = "Ayse Yilmaz",
            Username = "veli.ayse",
            PasswordHash = passwordHasher.Hash("VLI2026A"),
            PrimaryRole = UserRole.Parent,
            Campus = "Merkez Kampus",
            DepartmentOrBranch = "10-A Velisi"
        };

        demoTenant.AdminUserId = tenantAdminUser.Id;
        demoTenant.Status = "active";
        demoTenant.ApprovedAtUtc ??= DateTime.UtcNow;
        demoTenant.UserCount = 6;
        demoTenant.BranchCount = 1;
        demoTenant.StudentCount = 1;
        demoTenant.StaffCount = 3;

        await dbContext.Users.AddRangeAsync([developerUser, tenantAdminUser, teacherUser, administrativeUser, accountingUser, studentUser, parentUser], cancellationToken);

        await dbContext.RolePolicies.AddRangeAsync(
        [
            new RolePolicy
            {
                RoleName = UserRole.Developer.ToString(),
                IsActive = true,
                LoginEnabled = true,
                RequiresCriticalApproval = false,
                MessagingScope = "Platform",
                ModuleAccessSerialized = JsonSerializer.Serialize(new[] { "Platform", "Kurumlar", "Icerik", "Ayarlar" })
            },
            new RolePolicy
            {
                RoleName = UserRole.Admin.ToString(),
                IsActive = true,
                LoginEnabled = true,
                RequiresCriticalApproval = false,
                MessagingScope = "Tum roller",
                ModuleAccessSerialized = JsonSerializer.Serialize(new[] { "Akademik", "Finans", "Operasyon", "Duyurular", "Onaylar" })
            },
            new RolePolicy
            {
                RoleName = UserRole.Teacher.ToString(),
                IsActive = true,
                LoginEnabled = true,
                RequiresCriticalApproval = false,
                MessagingScope = "Ogrenci, veli, yonetici",
                ModuleAccessSerialized = JsonSerializer.Serialize(new[] { "Akademik", "Icerik", "Sinavlar" })
            },
            new RolePolicy
            {
                RoleName = UserRole.Accounting.ToString(),
                IsActive = true,
                LoginEnabled = true,
                RequiresCriticalApproval = true,
                MessagingScope = "Veli, yonetici",
                ModuleAccessSerialized = JsonSerializer.Serialize(new[] { "Finans", "Tahsilatlar", "Taksitler" })
            },
            new RolePolicy
            {
                RoleName = UserRole.Administrative.ToString(),
                IsActive = true,
                LoginEnabled = true,
                RequiresCriticalApproval = false,
                MessagingScope = "Veli, yonetici, muhasebe",
                ModuleAccessSerialized = JsonSerializer.Serialize(new[] { "Kayit", "Evrak", "Duyurular" })
            },
            new RolePolicy
            {
                RoleName = UserRole.Parent.ToString(),
                IsActive = true,
                LoginEnabled = true,
                RequiresCriticalApproval = false,
                MessagingScope = "Ogretmen, yonetici",
                ModuleAccessSerialized = JsonSerializer.Serialize(new[] { "Ogrenci", "Odeme", "Raporlar" })
            },
            new RolePolicy
            {
                RoleName = UserRole.Student.ToString(),
                IsActive = true,
                LoginEnabled = true,
                RequiresCriticalApproval = false,
                MessagingScope = "Ogretmen",
                ModuleAccessSerialized = JsonSerializer.Serialize(new[] { "Sinavlar", "Icerikler", "Odevler" })
            }
        ], cancellationToken);

        await dbContext.Staff.AddRangeAsync(
        [
            new StaffProfile
            {
                UserId = teacherUser.Id,
                FullName = "Hasan Yildiz",
                TcNo = "45678901234",
                Phone = "+90 555 818 10 10",
                Email = "hasan.yildiz@example.com",
                Education = "Uludag Universitesi",
                StartDate = "01.09.2024",
                Campus = "Merkez Kampus",
                DepartmentOrBranch = "Matematik",
                HomeroomClass = "11-A",
                AssignedClasses = ["11-A", "11-B", "12-A"],
                MaritalStatus = "Evli",
                ChildCount = 2,
                Note = "TYT-AYT matematik gruplarinda gorevli.",
                Role = UserRole.Teacher
            },
            new StaffProfile
            {
                UserId = administrativeUser.Id,
                FullName = "Ceren Aksoy",
                TcNo = "56789012345",
                Phone = "+90 555 919 20 20",
                Email = "ceren.aksoy@example.com",
                Education = "Anadolu Universitesi",
                StartDate = "15.01.2025",
                Campus = "Merkez Kampus",
                DepartmentOrBranch = "Ogrenci Isleri",
                HomeroomClass = "Sinif ogretmenligi yok",
                AssignedClasses = [],
                MaritalStatus = "Bekar",
                ChildCount = 0,
                Note = "Kayit ve evrak takibi sorumlusu.",
                Role = UserRole.Administrative
            },
            new StaffProfile
            {
                UserId = accountingUser.Id,
                FullName = "Selim Kara",
                TcNo = "67890123456",
                Phone = "+90 555 777 30 30",
                Email = "selim.kara@example.com",
                Education = "Marmara Universitesi",
                StartDate = "01.02.2025",
                Campus = "Merkez Kampus",
                DepartmentOrBranch = "Muhasebe",
                HomeroomClass = "Sinif ogretmenligi yok",
                AssignedClasses = [],
                MaritalStatus = "Evli",
                ChildCount = 1,
                Note = "Tahsilat ve fatura operasyonlarindan sorumlu.",
                Role = UserRole.Accounting
            }
        ], cancellationToken);

        await dbContext.Students.AddAsync(
            new StudentProfile
            {
                UserId = studentUser.Id,
                FullName = "Ali Yilmaz",
                TcNo = "12345678901",
                ClassName = "10-A",
                CurrentSchool = "Ataturk Anadolu Lisesi",
                SchoolNumber = "241",
                BirthDate = "14.03.2010",
                ProgramType = "Sayisal",
                ParentName = "Ayse Yilmaz",
                ParentPhone = "+90 555 101 11 11",
                ParentEmail = "ayse.yilmaz@example.com",
                Address = "Bursa / Nilufer",
                Note = "Matematik takviye programina dahil."
            },
            cancellationToken);

        await dbContext.Announcements.AddRangeAsync(
        [
            new AnnouncementItem
            {
                Title = "Yeni donem dersleri basliyor",
                Detail = "Yeni donemin ders programi ve akademik takvimi tum kullanici gruplarina acildi.",
                Audience = "Tum Kurum",
                DateLabel = "13 Mart 2026"
            },
            new AnnouncementItem
            {
                Title = "Hafta sonu deneme organizasyonu",
                Detail = "12. siniflar icin hafta sonu genel deneme sinavi uygulanacaktir.",
                Audience = "Ogrenci ve Veli",
                DateLabel = "12 Mart 2026"
            }
        ], cancellationToken);

        await dbContext.ExamResults.AddRangeAsync(
        [
            new ExamResult
            {
                ExamTitle = "10-A Parabol Sinavi",
                Type = ExamType.Written,
                Subject = "Matematik",
                DateLabel = "18 Mart 2026",
                StudentName = "Ali Yilmaz",
                ClassName = "10-A",
                Score = 80,
                Net = 16
            },
            new ExamResult
            {
                ExamTitle = "Genel TYT Denemesi",
                Type = ExamType.MockExam,
                Subject = "Genel",
                DateLabel = "10 Mart 2026",
                StudentName = "Ali Yilmaz",
                ClassName = "10-A",
                Score = 84,
                Net = 68
            }
        ], cancellationToken);

        await dbContext.QuestionBankItems.AddRangeAsync(
        [
            new QuestionBankItem
            {
                Subject = "Matematik",
                Topic = "Turev",
                Difficulty = "Orta",
                Type = "Acik Uclu",
                QuestionText = "f(x)=x³ + 2x² -5x + 3 fonksiyonunun turevini bulunuz.",
                Teacher = "Hasan Yildiz",
                CreatedAtLabel = "14 Mart 2026",
                UsageCount = 45,
                ClassTargetsSerialized = "[\"10-A\",\"10-B\"]",
                SolutionAssetPath = "turev_cozum.pdf",
                SolutionAssetType = "PDF",
                ExpectedAnswer = "3x² + 4x - 5"
            },
            new QuestionBankItem
            {
                Subject = "Fizik",
                Topic = "Hareket",
                Difficulty = "Kolay",
                Type = "Acik Uclu",
                QuestionText = "Newton'un birinci hareket yasasi nedir? Orneklerle aciklayiniz.",
                Teacher = "Kemal Eren",
                CreatedAtLabel = "13 Mart 2026",
                UsageCount = 31,
                ClassTargetsSerialized = "[\"9-C\",\"10-A\"]",
                SolutionAssetPath = "hareket_cozum.mp4",
                SolutionAssetType = "Video",
                ExpectedAnswer = "Cisim, net kuvvet yoksa mevcut hareket durumunu korur."
            },
            new QuestionBankItem
            {
                Subject = "Kimya",
                Topic = "Organik Kimya",
                Difficulty = "Kolay",
                Type = "Coktan Secmeli",
                QuestionText = "Organik kimyada alkanlarin genel formulu nedir?",
                Teacher = "Serpil Aydin",
                CreatedAtLabel = "12 Mart 2026",
                UsageCount = 26,
                OptionsSerialized = "[\"CnH2n+2\",\"CnH2n\",\"CnH2n-2\",\"CnH2n+1OH\"]",
                CorrectOptionIndex = 0,
                ClassTargetsSerialized = "[\"11-A\",\"Tum Siniflar\"]",
                RevealCorrectAnswerToStudent = false,
                ExpectedAnswer = "CnH2n+2"
            }
        ], cancellationToken);

        await dbContext.AccountingInvoices.AddRangeAsync(
        [
            new AccountingInvoice { Title = "Ogrenci Faturasi #184", Category = "Öğrenci Faturaları", Subtitle = "12 Mart 2026 • PDF", Amount = "₺18.400", Status = "Onaylandı" },
            new AccountingInvoice { Title = "Mekan Gideri #026", Category = "Dershane Mekan Giderleri", Subtitle = "11 Mart 2026 • PDF", Amount = "₺9.250", Status = "Onaylandı" },
            new AccountingInvoice { Title = "Teknik Servis #041", Category = "Diğer Gider Faturaları", Subtitle = "10 Mart 2026 • PDF", Amount = "₺4.850", Status = "Bekliyor" },
            new AccountingInvoice { Title = "Maaş Dökümü #022", Category = "Maaş Faturaları", Subtitle = "08 Mart 2026 • PDF", Amount = "₺52.000", Status = "Onaylandı" }
        ], cancellationToken);

        await dbContext.AccountingSalaries.AddRangeAsync(
        [
            new AccountingSalary { Employee = "Ayşe Şen", Role = "Matematik Öğretmeni", Amount = "₺52.000", PayDate = "28 Mart 2026", Status = "Ödendi" },
            new AccountingSalary { Employee = "Murat Demir", Role = "Fizik Öğretmeni", Amount = "₺49.500", PayDate = "28 Mart 2026", Status = "Planlandı" },
            new AccountingSalary { Employee = "Elif Kara", Role = "İdari İşler", Amount = "₺34.200", PayDate = "28 Mart 2026", Status = "Bekliyor" }
        ], cancellationToken);

        await dbContext.AccountingApprovals.AddRangeAsync(
        [
            new AccountingApproval { Title = "Ahmet Yılmaz burs talebi", Reason = "Sınav başarısı ve yönetici yönlendirmesi", Category = "Öğrenci İndirimi", Status = "Bekliyor", SourceType = "discount", SourceKey = "Ahmet Yılmaz burs talebi" },
            new AccountingApproval { Title = "Öğretmen maaş güncellemesi", Reason = "Mart ayı ek ders ve prim farkı", Category = "Maaş", Status = "Bekliyor", SourceType = "salary", SourceKey = "Öğretmen maaş güncellemesi" },
            new AccountingApproval { Title = "Su alımı tedarik onayı", Reason = "Yeni dönem ofis gider planı", Category = "Gider", Status = "Onaylandı", SourceType = "expense", SourceKey = "Su alımı tedarik onayı" }
        ], cancellationToken);

        await dbContext.AccountingCollections.AddRangeAsync(
        [
            new AccountingCollection { Name = "Ahmet Yılmaz", ClassName = "11-A", Amount = "₺18.500", Method = "Kredi Kartı", Time = "14:10", Note = "Mart ödemesi" },
            new AccountingCollection { Name = "Zeynep Kara", ClassName = "10-B", Amount = "₺7.200", Method = "Havale", Time = "13:25", Note = "Etüt paketi" },
            new AccountingCollection { Name = "Ece Demir", ClassName = "9-C", Amount = "₺4.000", Method = "Nakit", Time = "11:40", Note = "Kısmi ödeme" }
        ], cancellationToken);

        await dbContext.AccountingInstallments.AddRangeAsync(
        [
            new AccountingInstallment { Student = "Ahmet Yılmaz", Status = "Bekleyen", Amount = "₺9.500", Due = "18 Mart 2026", Note = "Nisan taksiti" },
            new AccountingInstallment { Student = "Mehmet Kaya", Status = "Geciken", Amount = "₺12.000", Due = "01 Mart 2026", Note = "Mart taksiti" },
            new AccountingInstallment { Student = "Zeynep Kara", Status = "Alınan", Amount = "₺8.250", Due = "05 Mart 2026", Note = "Şubat kapanışı" },
            new AccountingInstallment { Student = "Defne Çetin", Status = "Sonraki Ay", Amount = "₺10.000", Due = "05 Nisan 2026", Note = "Yeni plan" }
        ], cancellationToken);

        await dbContext.AccountingNotifications.AddRangeAsync(
        [
            new AccountingNotification { Title = "Yeni tahsilat kaydı", Message = "Ahmet Yılmaz için kredi kartı tahsilatı eklendi.", Time = "Bugün 14:10", Unread = true },
            new AccountingNotification { Title = "Onay bekleyen maaş", Message = "Elif Kara bordro kaydı yönetici onayında bekliyor.", Time = "Bugün 12:45", Unread = true },
            new AccountingNotification { Title = "Geciken ödeme hatırlatıldı", Message = "Mehmet Kaya velisine ödeme hatırlatma mesajı gönderildi.", Time = "Bugün 10:20", Unread = false }
        ], cancellationToken);

        await dbContext.Notifications.AddRangeAsync(
        [
            new NotificationItem
            {
                Title = "Kritik finans uyarisı",
                Message = "3 ogrenci odemesi 7 gunu gecti, muhasebe aksiyon bekliyor.",
                TimeLabel = "Bugun 14:20",
                Audience = "Yonetici",
                TargetRole = UserRole.Admin.ToString(),
                Category = "Finans",
                IsRead = false
            },
            new NotificationItem
            {
                Title = "Ogretmen yaniti geldi",
                Message = "Matematik soruna cozum yollandi.",
                TimeLabel = "2 dk once",
                Audience = "Ogrenci",
                TargetRole = UserRole.Student.ToString(),
                Category = "Akademik",
                IsRead = false
            },
            new NotificationItem
            {
                Title = "Yeni kayit tamamlandi",
                Message = "Ali Yilmaz icin veli hos geldiniz bilgilendirmesi gonderildi.",
                TimeLabel = "Bugun 11:15",
                Audience = "Idari",
                TargetRole = UserRole.Administrative.ToString(),
                Category = "Kayit",
                IsRead = false
            }
        ], cancellationToken);

        await dbContext.AccountingAuditLogs.AddRangeAsync(
        [
            new AccountingAuditLog { Title = "Tahsilat işlendi", Detail = "Zeynep Kara için havale tahsilatı sisteme kaydedildi.", Time = "12 Mart 2026 • 13:25" },
            new AccountingAuditLog { Title = "Fatura onaylandı", Detail = "Öğrenci Faturası #184 yönetici onayından geçti.", Time = "12 Mart 2026 • 11:30" },
            new AccountingAuditLog { Title = "İndirim talebi açıldı", Detail = "Ahmet Yılmaz burs talebi onay akışına gönderildi.", Time = "12 Mart 2026 • 09:40" }
        ], cancellationToken);

        await dbContext.MeetingRequests.AddRangeAsync(
        [
            new MeetingRequest
            {
                ParentName = "Ayse Yilmaz",
                StudentName = "Ali Yilmaz",
                Advisor = "Hasan Yildiz",
                Topic = "Sinav sonuclari",
                Slot = "15 Mart Cumartesi • 19:00",
                OnlineMeeting = true,
                Note = "Son deneme sonuclarini ve calisma planini degerlendirmek istiyorum.",
                Status = "Bekliyor"
            },
            new MeetingRequest
            {
                ParentName = "Mehmet Yilmaz",
                StudentName = "Ahmet Yilmaz",
                Advisor = "Hasan Yildiz",
                Topic = "Akademik gelisim",
                Slot = "16 Mart Pazar • 11:30",
                OnlineMeeting = false,
                Note = "Ogrencinin son haftadaki performansi ile ilgili gorusmek istiyorum.",
                Status = "Bekliyor"
            }
        ], cancellationToken);

        var studentTeacherThreadId = Guid.NewGuid();
        var adminAccountingThreadId = Guid.NewGuid();

        await dbContext.MessageThreads.AddRangeAsync(
        [
            new MessageThread
            {
                Id = studentTeacherThreadId,
                ParticipantOneName = "Ali Yilmaz",
                ParticipantOneRole = "Student",
                ParticipantTwoName = "Hasan Yildiz",
                ParticipantTwoRole = "Teacher",
                LastMessagePreview = "Merhaba, nasil yardimci olabilirim?",
                LastMessageAtUtc = DateTime.UtcNow.AddMinutes(-30)
            },
            new MessageThread
            {
                Id = adminAccountingThreadId,
                ParticipantOneName = "Ece Arslan",
                ParticipantOneRole = "Admin",
                ParticipantTwoName = "Muhasebe Birimi",
                ParticipantTwoRole = "Accounting",
                LastMessagePreview = "3 onay bekleyen bordro var.",
                LastMessageAtUtc = DateTime.UtcNow.AddMinutes(-50)
            }
        ], cancellationToken);

        await dbContext.MessageItems.AddRangeAsync(
        [
            new MessageItem
            {
                ThreadId = studentTeacherThreadId,
                SenderName = "Ali Yilmaz",
                SenderRole = "Student",
                Text = "Merhaba hocam",
                IsRead = true,
                SentAtUtc = DateTime.UtcNow.AddMinutes(-40)
            },
            new MessageItem
            {
                ThreadId = studentTeacherThreadId,
                SenderName = "Hasan Yildiz",
                SenderRole = "Teacher",
                Text = "Merhaba, nasil yardimci olabilirim?",
                IsRead = true,
                SentAtUtc = DateTime.UtcNow.AddMinutes(-30)
            },
            new MessageItem
            {
                ThreadId = adminAccountingThreadId,
                SenderName = "Muhasebe Birimi",
                SenderRole = "Accounting",
                Text = "3 onay bekleyen bordro var.",
                IsRead = false,
                SentAtUtc = DateTime.UtcNow.AddMinutes(-50)
            }
        ], cancellationToken);

        await dbContext.ContentItems.AddRangeAsync(
        [
            new ContentItem
            {
                Subject = "Matematik",
                Title = "Turev ve Uygulamalari",
                Teacher = "Hasan Yildiz",
                Info = "45 dk",
                Progress = 0.65,
                FileType = "Video",
                Grade = "11. Sinif",
                Views = "56 goruntulenme",
                Size = "245 MB",
                Description = "Turev konusu temel kurallar, grafik yorumlari ve cikmis soru ornekleri ile anlatilir.",
                PublishStatus = "Aktif"
            },
            new ContentItem
            {
                Subject = "Kimya",
                Title = "Periyodik Tablo Ders Notu",
                Teacher = "Osman Akca",
                Info = "24 sayfa",
                Progress = 0.4,
                FileType = "PDF",
                Grade = "10. Sinif",
                Views = "48 goruntulenme",
                Size = "2.1 MB",
                Description = "Periyodik sistemin temel yapisi, grup ozellikleri ve ezber kolaylastiran tablolar yer alir.",
                PublishStatus = "Aktif"
            }
        ], cancellationToken);

        AssignTrackedTenantScopedEntitiesToDemoTenant(demoTenant.Id);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<TenantWorkspace> EnsureDemoTenantAsync(CancellationToken cancellationToken)
    {
        var tenant = await dbContext.TenantWorkspaces
            .SingleOrDefaultAsync(x => x.Slug == "demo.kurum", cancellationToken);

        if (tenant is not null)
        {
            tenant.Status = string.IsNullOrWhiteSpace(tenant.Status) ? "active" : tenant.Status;
            tenant.ContactEmail = string.IsNullOrWhiteSpace(tenant.ContactEmail) ? "kurum.admin@courseintellect.local" : tenant.ContactEmail;
            tenant.ContactName = string.IsNullOrWhiteSpace(tenant.ContactName) ? "Demo Kurum Yonetimi" : tenant.ContactName;
            tenant.Plan = string.IsNullOrWhiteSpace(tenant.Plan) ? "Business" : tenant.Plan;
            tenant.BranchCount = Math.Max(tenant.BranchCount, 1);
            return tenant;
        }

        tenant = new TenantWorkspace
        {
            Name = "Demo Kurum",
            Slug = "demo.kurum",
            ContactEmail = "kurum.admin@courseintellect.local",
            ContactName = "Demo Kurum Yonetimi",
            ContactPhone = "+90 555 100 20 20",
            Plan = "Business",
            Status = "active",
            BranchCount = 1,
            CreatedAtUtc = DateTime.UtcNow,
            ApprovedAtUtc = DateTime.UtcNow
        };

        await dbContext.TenantWorkspaces.AddAsync(tenant, cancellationToken);
        return tenant;
    }

    private async Task EnsurePlatformAndTenantAdminsAsync(TenantWorkspace demoTenant, CancellationToken cancellationToken)
    {
        var developerAdmin = await dbContext.Users.SingleOrDefaultAsync(x => x.Username == DeveloperAdminUsername, cancellationToken);
        var legacyPlatformAdmin = await dbContext.Users.SingleOrDefaultAsync(x => x.Username == LegacyPlatformAdminUsername, cancellationToken);

        if (developerAdmin is null)
        {
            if (legacyPlatformAdmin is not null)
            {
                developerAdmin = legacyPlatformAdmin;
                developerAdmin.Username = DeveloperAdminUsername;
            }
            else
            {
                developerAdmin = new AppUser { Username = DeveloperAdminUsername };
                await dbContext.Users.AddAsync(developerAdmin, cancellationToken);
            }
        }

        developerAdmin.TenantId = null;
        developerAdmin.FullName = "CourseIntellect Developer Admin";
        developerAdmin.PasswordHash = passwordHasher.Hash(DeveloperAdminPassword);
        developerAdmin.PrimaryRole = UserRole.Developer;
        developerAdmin.Status = UserStatus.Active;
        developerAdmin.Campus = "Platform";
        developerAdmin.DepartmentOrBranch = "Development";

        var tenantAdmin = await dbContext.Users.SingleOrDefaultAsync(x => x.Username == "kurum.admin", cancellationToken);
        if (tenantAdmin is null)
        {
            tenantAdmin = new AppUser
            {
                TenantId = demoTenant.Id,
                FullName = "Demo Kurum Yonetici",
                Username = "kurum.admin",
                PasswordHash = passwordHasher.Hash("KRM2026A"),
                PrimaryRole = UserRole.Admin,
                Campus = demoTenant.Name,
                DepartmentOrBranch = "Yonetim"
            };
            await dbContext.Users.AddAsync(tenantAdmin, cancellationToken);
        }
        else
        {
            tenantAdmin.TenantId = demoTenant.Id;
            tenantAdmin.Campus = string.IsNullOrWhiteSpace(tenantAdmin.Campus) ? demoTenant.Name : tenantAdmin.Campus;
            tenantAdmin.DepartmentOrBranch = string.IsNullOrWhiteSpace(tenantAdmin.DepartmentOrBranch) ? "Yonetim" : tenantAdmin.DepartmentOrBranch;
        }

        demoTenant.AdminUserId = tenantAdmin.Id;
        demoTenant.Status = "active";
        demoTenant.ApprovedAtUtc ??= DateTime.UtcNow;
    }

    private async Task AssignLegacyUsersToDemoTenantAsync(TenantWorkspace demoTenant, CancellationToken cancellationToken)
    {
        var tenantCount = await dbContext.TenantWorkspaces.CountAsync(cancellationToken);
        if (tenantCount != 1)
        {
            return;
        }

        var usersToAssign = await dbContext.Users
            .Where(x => x.TenantId == null && x.PrimaryRole != UserRole.Developer)
            .ToListAsync(cancellationToken);

        foreach (var user in usersToAssign)
        {
            user.TenantId = demoTenant.Id;
            if (string.IsNullOrWhiteSpace(user.Campus))
            {
                user.Campus = demoTenant.Name;
            }
        }

        demoTenant.UserCount = await dbContext.Users.CountAsync(x => x.TenantId == demoTenant.Id, cancellationToken);
        demoTenant.StudentCount = await (
            from student in dbContext.Students
            join user in dbContext.Users on student.UserId equals user.Id
            where user.TenantId == demoTenant.Id
            select student.Id
        ).CountAsync(cancellationToken);
        demoTenant.StaffCount = await (
            from staff in dbContext.Staff
            join user in dbContext.Users on staff.UserId equals user.Id
            where user.TenantId == demoTenant.Id
            select staff.Id
        ).CountAsync(cancellationToken);
        demoTenant.BranchCount = Math.Max(demoTenant.BranchCount, 1);
    }

    private async Task AssignLegacyTenantDataToDemoTenantAsync(TenantWorkspace demoTenant, CancellationToken cancellationToken)
    {
        var tenantCount = await dbContext.TenantWorkspaces.CountAsync(cancellationToken);
        if (tenantCount != 1)
        {
            return;
        }

        await AssignNullTenantEntitiesAsync(dbContext.Students, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.Staff, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.Announcements, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.ExamResults, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.MeetingRequests, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.MessageThreads, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.MessageItems, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.ContentItems, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.QuestionBankItems, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.QuestionPracticeAttempts, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.StudentQuestionThreads, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.StudentQuestionReplies, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.AccountingInvoices, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.AccountingSalaries, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.AccountingApprovals, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.AccountingCollections, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.AccountingInstallments, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.AccountingNotifications, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.AccountingAuditLogs, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.AttendanceEntries, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.HomeworkAssignments, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.HomeworkSubmissions, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.StudyPlanStates, demoTenant.Id, cancellationToken);
        await AssignNullTenantEntitiesAsync(dbContext.Notifications, demoTenant.Id, cancellationToken);
        await AssignTenantScopedPlatformConfigurationsAsync(demoTenant.Id, cancellationToken);
        await AssignTenantScopedSiteContentItemsAsync(demoTenant.Id, cancellationToken);

        demoTenant.UserCount = await dbContext.Users.CountAsync(x => x.TenantId == demoTenant.Id, cancellationToken);
        demoTenant.StudentCount = await dbContext.Students.CountAsync(x => x.TenantId == demoTenant.Id, cancellationToken);
        demoTenant.StaffCount = await dbContext.Staff.CountAsync(x => x.TenantId == demoTenant.Id, cancellationToken);
        demoTenant.BranchCount = Math.Max(demoTenant.BranchCount, 1);
    }

    private async Task AssignNullTenantEntitiesAsync<TEntity>(
        DbSet<TEntity> set,
        Guid demoTenantId,
        CancellationToken cancellationToken)
        where TEntity : class, ITenantScopedEntity
    {
        var items = await set
            .Where(x => x.TenantId == null)
            .ToListAsync(cancellationToken);

        foreach (var item in items)
        {
            item.TenantId = demoTenantId;
        }
    }

    private async Task AssignTenantScopedPlatformConfigurationsAsync(Guid demoTenantId, CancellationToken cancellationToken)
    {
        var tenantConfigurationTypes = new[]
        {
            "admin-task-center",
            "class-management",
            "class-registry",
            "class-schedule",
            "class-schedule-entry",
            "personnel-approvals",
            "role-management"
        };

        var configurations = await dbContext.PlatformConfigurations
            .Where(x => x.TenantId == null && tenantConfigurationTypes.Contains(x.ConfigurationType))
            .ToListAsync(cancellationToken);

        foreach (var configuration in configurations)
        {
            configuration.TenantId = demoTenantId;
        }

        var tenantCustomizations = await dbContext.PlatformConfigurations
            .Where(x => x.TenantId == null && x.ConfigurationType == "tenant-customization")
            .ToListAsync(cancellationToken);

        foreach (var customization in tenantCustomizations)
        {
            if (Guid.TryParse(customization.ScopeKey, out var tenantId))
            {
                customization.TenantId = tenantId;
            }
        }
    }

    private async Task AssignTenantScopedSiteContentItemsAsync(Guid demoTenantId, CancellationToken cancellationToken)
    {
        var tenantSectionKeys = new[]
        {
            "accounting-benefits",
            "exam-sessions",
            "live-room-sessions",
            "meeting-availability-slots",
            "planned-exams",
            "push-device-registrations",
            "teacher-weekly-reports"
        };

        var items = await dbContext.SiteContentItems
            .Where(x => x.TenantId == null && tenantSectionKeys.Contains(x.SectionKey))
            .ToListAsync(cancellationToken);

        foreach (var item in items)
        {
            item.TenantId = demoTenantId;
        }
    }

    private void AssignTrackedTenantScopedEntitiesToDemoTenant(Guid demoTenantId)
    {
        foreach (var entry in dbContext.ChangeTracker.Entries<ITenantScopedEntity>())
        {
            if (entry.State == EntityState.Added &&
                entry.Entity is not AppUser &&
                entry.Entity.TenantId is null)
            {
                entry.Entity.TenantId = demoTenantId;
            }
        }
    }
}
