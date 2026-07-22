using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Permissions;
using CourseIntellect.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Persistence;

/// <summary>
/// Sürücü kursu demo verisi. Mevcut "Demo Kurum" (okul) kurumuna DOKUNMAZ —
/// ayrı bir sürücü kursu kurumu açar, böylece iki kurum türü yan yana denenebilir.
///
/// <para><b>Yalnızca Development'ta çalışır</b> (Program.cs'te kontrol edilir).</para>
///
/// <para><b>Idempotent:</b> kurum zaten varsa hiçbir şey yapmaz — uygulama her
/// açılışta yeniden veri üretmez.</para>
///
/// <para>Amaç "boş ekran" değil, gerçek bir kursun bir haftalık hâli: dolu takvim,
/// tamamlanmış dersler, bakımdaki araç, evrakı yaklaşan araç, evrakı eksik kursiyer,
/// borçlu kursiyer, devamsızlık ve geç iptal.</para>
/// </summary>
public sealed class DrivingSchoolSeeder(
    CourseIntellectDbContext dbContext,
    IPasswordHasher passwordHasher,
    ILogger<DrivingSchoolSeeder> logger)
{
    private const string TenantName = "Demo Sürücü Kursu";
    private const string AdminUsername = "kurs.admin";
    private const string AdminPassword = "KRS2026A";

    /// <summary>Demo verisi bugüne göre üretilir ki takvim hep "canlı" görünsün.</summary>
    private static DateTime TodayLocal => DrivingAvailability.ToLocal(DateTime.UtcNow).Date;

    /// <summary>Yerel gün + saat → UTC.</summary>
    private static DateTime At(int dayOffset, int hour, int minute = 0)
        => TodayLocal.AddDays(dayOffset).AddHours(hour).AddMinutes(minute)
            .AddHours(-DrivingAvailability.LocalUtcOffsetHours);

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        var existing = await dbContext.TenantWorkspaces.IgnoreQueryFilters()
            .AnyAsync(x => x.Name == TenantName, cancellationToken);
        if (existing)
        {
            logger.LogInformation("Sürücü kursu demo verisi zaten var, atlanıyor.");
            return;
        }

        logger.LogInformation("Sürücü kursu demo verisi oluşturuluyor…");

        // Ya hepsi ya hiçbiri: yarım kalmış demo kurumu, bir sonraki açılışta
        // "zaten var" sanılıp asla tamamlanmazdı.
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        var tenant = new TenantWorkspace
        {
            Name = TenantName,
            InstitutionType = InstitutionType.DrivingSchool,
            DrivingSchoolModuleEnabled = true,
            Status = "active",
        };
        dbContext.TenantWorkspaces.Add(tenant);
        await dbContext.SaveChangesAsync(cancellationToken);

        // Seed HTTP bağlamı dışında çalışır → tenant filtresi ve damgası elle kurulur.
        dbContext.SetTenantOverride(tenant.Id);
        try
        {
            var branches = await SeedBranchesAsync(tenant.Id, cancellationToken);
            await SeedSettingsAsync(cancellationToken);
            await SeedStaffAndRolesAsync(tenant.Id, branches, cancellationToken);
            var packages = await SeedPackagesAsync(cancellationToken);
            var vehicles = await SeedVehiclesAsync(cancellationToken);
            var instructors = await SeedInstructorsAsync(tenant.Id, branches, vehicles, cancellationToken);
            await SeedStudentsAndOperationsAsync(tenant.Id, branches, packages, vehicles, instructors, cancellationToken);

            await transaction.CommitAsync(cancellationToken);
            logger.LogInformation("Sürücü kursu demo verisi hazır. Giriş: {Username} / {Password}", AdminUsername, AdminPassword);
        }
        catch (Exception exception)
        {
            await transaction.RollbackAsync(cancellationToken);
            // Demo verisi uygulamayı açılışta çökertmemeli; kurum oluşmadığı için
            // bir sonraki açılışta yeniden denenir.
            logger.LogError(exception, "Sürücü kursu demo verisi oluşturulamadı; geri alındı.");
        }
        finally
        {
            dbContext.SetTenantOverride(null);
        }
    }

    private async Task<(OrgUnit Center, OrgUnit Second)> SeedBranchesAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var center = new OrgUnit { TenantId = tenantId, Name = "Merkez Şube", UnitType = "Şube", ManagerName = "Kurs Yönetimi" };
        var second = new OrgUnit { TenantId = tenantId, Name = "Kadıköy Şube", UnitType = "Şube", ManagerName = "Şube Yönetimi" };
        dbContext.OrgUnits.AddRange(center, second);
        await dbContext.SaveChangesAsync(cancellationToken);
        return (center, second);
    }

    private async Task SeedSettingsAsync(CancellationToken cancellationToken)
    {
        dbContext.DrivingSchoolSettings.Add(new DrivingSchoolSettings
        {
            LateCancellationHours = 24,
            LateCancellationDeductPercent = 50,
            NoShowDeductPercent = 100,
            MinRescheduleHours = 12,
            MaxInstructorDailyMinutes = 480,
            MaxVehicleDailyMinutes = 600,
            MaxStudentDailyLessons = 2,
            PreparationMinutes = 15,
            FinancialHoldEnabled = false,
            FinancialHoldThreshold = 2000,
        });
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Kurum sahibi, sekreter, muhasebe ve filo sorumlusu (özel rol).</summary>
    private async Task SeedStaffAndRolesAsync(Guid tenantId, (OrgUnit Center, OrgUnit Second) branches, CancellationToken cancellationToken)
    {
        // "Filo Sorumlusu": Administrative tabanlı özel rol, yalnızca filo izinleriyle.
        var fleetRole = new CustomRole
        {
            TenantId = tenantId,
            Name = "Filo Sorumlusu",
            BaseRole = UserRole.Administrative,
            Permissions = DrivingPermissionCatalog.DefaultsFor(DrivingPermissionCatalog.Fleet).ToList(),
        };
        dbContext.CustomRoles.Add(fleetRole);

        AddUser(tenantId, "Kurs Yöneticisi", AdminUsername, AdminPassword, UserRole.Admin, branches.Center.Id);
        AddUser(tenantId, "Sekreter Elif", "kurs.sekreter", "SKR2026A", UserRole.Administrative, branches.Center.Id);
        AddUser(tenantId, "Muhasebe Burak", "kurs.muhasebe", "MHS2026A", UserRole.Accounting, branches.Center.Id);

        var fleetUser = AddUser(tenantId, "Filo Sorumlusu Cem", "kurs.filo", "FLO2026A", UserRole.Administrative, branches.Center.Id);
        fleetUser.CustomRoleId = fleetRole.Id;

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private AppUser AddUser(Guid tenantId, string fullName, string username, string password, UserRole role, Guid? branchId)
    {
        var user = new AppUser
        {
            TenantId = tenantId,
            BranchId = branchId,
            FullName = fullName,
            Username = username,
            PasswordHash = passwordHasher.Hash(password),
            PrimaryRole = role,
            Campus = "Merkez Şube",
            DepartmentOrBranch = "Sürücü Kursu",
        };
        dbContext.Users.Add(user);
        return user;
    }

    private async Task<List<DrivingPackage>> SeedPackagesAsync(CancellationToken cancellationToken)
    {
        var packages = new List<DrivingPackage>
        {
            new() { Name = "B Sınıfı Manuel — Tam Paket", LicenseClass = "B", TransmissionType = TransmissionType.Manual, DrivingLessonMinutes = 840, TheoryLessonMinutes = 720, Price = 18500 },
            new() { Name = "B Sınıfı Otomatik — Tam Paket", LicenseClass = "B", TransmissionType = TransmissionType.Automatic, DrivingLessonMinutes = 840, TheoryLessonMinutes = 720, Price = 21000 },
            new() { Name = "A2 Motosiklet Paketi", LicenseClass = "A2", TransmissionType = TransmissionType.Manual, DrivingLessonMinutes = 480, TheoryLessonMinutes = 480, Price = 12000 },
        };
        dbContext.DrivingPackages.AddRange(packages);
        await dbContext.SaveChangesAsync(cancellationToken);
        return packages;
    }

    /// <summary>Dört araç: ikisi sağlam, biri bakımda, birinin muayenesi 12 gün sonra doluyor.</summary>
    private async Task<List<DrivingVehicle>> SeedVehiclesAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var vehicles = new List<DrivingVehicle>
        {
            new()
            {
                PlateNumber = "34 ABC 101", Brand = "Fiat", Model = "Egea", ModelYear = 2024,
                LicenseClass = "B", TransmissionType = TransmissionType.Manual, CurrentKilometer = 42_300,
                InspectionExpiresAtUtc = now.AddMonths(9), InsuranceExpiresAtUtc = now.AddMonths(7),
            },
            new()
            {
                PlateNumber = "34 ABC 202", Brand = "Renault", Model = "Clio", ModelYear = 2023,
                LicenseClass = "B", TransmissionType = TransmissionType.Automatic, CurrentKilometer = 58_900,
                InspectionExpiresAtUtc = now.AddMonths(5), InsuranceExpiresAtUtc = now.AddMonths(11),
            },
            // Muayenesi 15 gün sonra doluyor ve bakım kilometresine 300 km kaldı →
            // hatırlatma işinin uyarı basamaklarına (30/15/7/1) bilerek denk getirildi.
            new()
            {
                PlateNumber = "34 ABC 303", Brand = "Volkswagen", Model = "Polo", ModelYear = 2022,
                LicenseClass = "B", TransmissionType = TransmissionType.Manual, CurrentKilometer = 99_700,
                InspectionExpiresAtUtc = now.AddDays(15), InsuranceExpiresAtUtc = now.AddMonths(4),
            },
            // Bakımda → randevuya çıkamaz.
            new()
            {
                PlateNumber = "34 ABC 404", Brand = "Honda", Model = "CB125", ModelYear = 2024,
                LicenseClass = "A2", TransmissionType = TransmissionType.Manual, CurrentKilometer = 12_800,
                InspectionExpiresAtUtc = now.AddMonths(8), InsuranceExpiresAtUtc = now.AddMonths(8),
                IsInMaintenance = true,
            },
        };
        dbContext.DrivingVehicles.AddRange(vehicles);
        await dbContext.SaveChangesAsync(cancellationToken);

        // Bakımdaki aracın açık arıza kaydı olmalı ki ekranlar tutarlı görünsün.
        dbContext.DrivingVehicleServiceRecords.Add(new DrivingVehicleServiceRecord
        {
            VehicleId = vehicles[3].Id,
            RecordType = "Fault",
            Title = "Debriyaj balatası aşınmış",
            Description = "Vites geçişlerinde kayma var; servise bırakıldı.",
            Priority = "High",
            Kilometer = vehicles[3].CurrentKilometer,
            VehicleUsable = false,
            Status = "Open",
            ReportedAtUtc = DateTime.UtcNow.AddDays(-2),
        });

        // Kapanmış bakım kaydı: sonraki bakım kilometresi yaklaşıyor → hatırlatma üretir.
        dbContext.DrivingVehicleServiceRecords.Add(new DrivingVehicleServiceRecord
        {
            VehicleId = vehicles[2].Id,
            RecordType = "Maintenance",
            Title = "Periyodik bakım (90.000 km)",
            ServiceProvider = "Yetkili Servis",
            Description = "Yağ, filtre ve fren kontrolü yapıldı.",
            Priority = "Normal",
            Kilometer = 90_000,
            // Bir sonraki bakıma 300 km kaldı → bakım hatırlatması tetiklenir.
            VehicleUsable = true,
            LaborCost = 1800,
            PartsCost = 3200,
            NextServiceKilometer = 100_000,
            NextServiceAtUtc = DateTime.UtcNow.AddMonths(6),
            Status = "Completed",
            Resolution = "Bakım tamamlandı, araç teslim alındı.",
            ReportedAtUtc = DateTime.UtcNow.AddDays(-30),
            CompletedAtUtc = DateTime.UtcNow.AddDays(-28),
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return vehicles;
    }

    /// <summary>Üç öğretmen: çalışma saatleri ve araç atamalarıyla birlikte.</summary>
    private async Task<List<DrivingInstructorProfile>> SeedInstructorsAsync(
        Guid tenantId,
        (OrgUnit Center, OrgUnit Second) branches,
        List<DrivingVehicle> vehicles,
        CancellationToken cancellationToken)
    {
        var definitions = new[]
        {
            (Name: "Ahmet Direksiyon", Username: "kurs.ogrt.ahmet", Classes: "B", Manual: true, Automatic: false, Branch: branches.Center.Id, Vehicle: vehicles[0]),
            (Name: "Zeynep Yıldız", Username: "kurs.ogrt.zeynep", Classes: "B", Manual: false, Automatic: true, Branch: branches.Center.Id, Vehicle: vehicles[1]),
            (Name: "Murat Kaya", Username: "kurs.ogrt.murat", Classes: "B,A2", Manual: true, Automatic: false, Branch: branches.Second.Id, Vehicle: vehicles[2]),
        };

        var profiles = new List<DrivingInstructorProfile>();

        foreach (var definition in definitions)
        {
            var user = AddUser(tenantId, definition.Name, definition.Username, "OGR2026A", UserRole.Teacher, definition.Branch);
            var staff = new StaffProfile
            {
                TenantId = tenantId,
                BranchId = definition.Branch,
                UserId = user.Id,
                FullName = definition.Name,
                DepartmentOrBranch = "Direksiyon Eğitimi",
                Campus = "Sürücü Kursu",
            };
            dbContext.Staff.Add(staff);

            var profile = new DrivingInstructorProfile
            {
                StaffId = staff.Id,
                LicenseClasses = definition.Classes,
                CanTeachManual = definition.Manual,
                CanTeachAutomatic = definition.Automatic,
            };
            dbContext.DrivingInstructorProfiles.Add(profile);
            profiles.Add(profile);

            // Hafta içi 09:00-18:00 (yerel dakika: 540-1080).
            foreach (var day in new[] { DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday })
            {
                dbContext.DrivingInstructorWorkingHours.Add(new DrivingInstructorWorkingHour
                {
                    InstructorProfileId = profile.Id,
                    DayOfWeek = day,
                    StartMinute = 540,
                    EndMinute = 1080,
                });
            }

            dbContext.DrivingInstructorVehicleAssignments.Add(new DrivingInstructorVehicleAssignment
            {
                InstructorProfileId = profile.Id,
                VehicleId = definition.Vehicle.Id,
                AssignmentType = VehicleAssignmentType.Primary,
                Priority = 10,
                Note = "Asıl araç",
            });
        }

        // Ahmet, Zeynep'in aracını yedek olarak da kullanabilir (manuel/otomatik uyumu
        // olmadığı için değil — bu atama bilerek YOK; yedek atamayı Murat'a veriyoruz).
        dbContext.DrivingInstructorVehicleAssignments.Add(new DrivingInstructorVehicleAssignment
        {
            InstructorProfileId = profiles[2].Id,
            VehicleId = vehicles[0].Id,
            AssignmentType = VehicleAssignmentType.Backup,
            Priority = 50,
            Note = "Kendi aracı serviste olduğunda",
        });

        // Zeynep'in gelecek hafta iki günlük yıllık izni var → o günlerde randevu verilemez.
        dbContext.DrivingInstructorLeaves.Add(new DrivingInstructorLeave
        {
            InstructorProfileId = profiles[1].Id,
            StartsAtUtc = At(7, 0),
            EndsAtUtc = At(9, 0),
            LeaveType = "Annual",
            Reason = "Yıllık izin",
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return profiles;
    }

    /// <summary>
    /// Altı kursiyer, farklı hâllerde: evrakı eksik, borçlu, eğitimi süren, mezun.
    /// Geçmiş dersler ledger'a ve değerlendirmeye işlenir; gelecek randevular takvimi doldurur.
    /// </summary>
    private async Task SeedStudentsAndOperationsAsync(
        Guid tenantId,
        (OrgUnit Center, OrgUnit Second) branches,
        List<DrivingPackage> packages,
        List<DrivingVehicle> vehicles,
        List<DrivingInstructorProfile> instructors,
        CancellationToken cancellationToken)
    {
        var students = new[]
        {
            // (Ad, kullanıcı adı, paket, durum, evrak tam mı, borçlu mu, şube)
            ("Elif Yılmaz", "kurs.elif", packages[0], DrivingStudentStatus.PracticeOngoing, true, false, branches.Center.Id),
            ("Burak Demir", "kurs.burak", packages[0], DrivingStudentStatus.PracticeOngoing, true, true, branches.Center.Id),
            ("Ayşe Kara", "kurs.ayse", packages[1], DrivingStudentStatus.Active, true, false, branches.Center.Id),
            ("Mehmet Can", "kurs.mehmet", packages[0], DrivingStudentStatus.DocumentsPending, false, false, branches.Second.Id),
            ("Selin Aksoy", "kurs.selin", packages[2], DrivingStudentStatus.TheoryOngoing, true, false, branches.Second.Id),
            ("Deniz Şahin", "kurs.deniz", packages[0], DrivingStudentStatus.Graduated, true, false, branches.Center.Id),
        };

        var profiles = new List<StudentDrivingProfile>();

        foreach (var (fullName, username, package, status, documentsComplete, hasDebt, branchId) in students)
        {
            var user = AddUser(tenantId, fullName, username, "OGR2026A", UserRole.Student, branchId);
            var student = new StudentProfile
            {
                TenantId = tenantId,
                BranchId = branchId,
                UserId = user.Id,
                FullName = fullName,
                TcNo = string.Empty,
                ClassName = $"{package.LicenseClass}-{(package.TransmissionType == TransmissionType.Manual ? "M" : "O")}",
                ProgramType = $"{package.LicenseClass} Sürücü Kursu",
                BirthDate = "1998-06-15",
            };
            dbContext.Students.Add(student);

            var profile = new StudentDrivingProfile
            {
                StudentId = student.Id,
                PackageId = package.Id,
                LicenseClass = package.LicenseClass,
                TransmissionType = package.TransmissionType,
                PurchasedDrivingMinutes = package.DrivingLessonMinutes,
                Status = status,
                Gender = "Belirtilmedi",
                City = "İstanbul",
                AvailableWeekdays = true,
                KvkkConsentAtUtc = DateTime.UtcNow.AddDays(-40),
                CommunicationConsent = true,
                RegisteredAtUtc = DateTime.UtcNow.AddDays(-40),
            };
            dbContext.StudentDrivingProfiles.Add(profile);
            profiles.Add(profile);

            SeedDocuments(profile.Id, documentsComplete);
            await SeedFinanceAsync(profile, student, user, package, hasDebt, cancellationToken);

            // Paket dakikaları defterin açılış hareketidir.
            dbContext.DrivingLessonLedgerEntries.Add(new DrivingLessonLedgerEntry
            {
                StudentDrivingProfileId = profile.Id,
                EntryType = DrivingLedgerEntryType.PackageMinutes,
                MinutesDelta = package.DrivingLessonMinutes,
                Description = $"\"{package.Name}\" paketinden gelen direksiyon hakkı",
                CreatedAtUtc = DateTime.UtcNow.AddDays(-40),
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await SeedAppointmentsAndLessonsAsync(profiles, instructors, vehicles, cancellationToken);
    }

    private void SeedDocuments(Guid profileId, bool complete)
    {
        var required = DrivingStudentRules.BaseRequiredDocuments;
        var now = DateTime.UtcNow;

        foreach (var type in required)
        {
            // Eksik dosyalı kursiyerde son iki belge hiç yüklenmemiş olsun.
            if (!complete && type is StudentDocumentType.CriminalRecord or StudentDocumentType.Residence) continue;

            dbContext.StudentDrivingDocuments.Add(new StudentDrivingDocument
            {
                StudentDrivingProfileId = profileId,
                DocumentType = type,
                Status = complete ? StudentDocumentStatus.Approved : StudentDocumentStatus.PendingApproval,
                FileUrl = $"/uploads/driving-student-documents/{type}.pdf",
                FileName = $"{type}.pdf",
                UploadedAtUtc = now.AddDays(-38),
                ReviewedAtUtc = complete ? now.AddDays(-37) : null,
            });
        }
    }

    private async Task SeedFinanceAsync(
        StudentDrivingProfile profile,
        StudentProfile student,
        AppUser user,
        DrivingPackage package,
        bool hasDebt,
        CancellationToken cancellationToken)
    {
        var contract = new EnrollmentContract
        {
            StudentUserId = user.Id,
            StudentName = student.FullName,
            ClassName = student.ClassName,
            AcademicYear = DateTime.UtcNow.Year.ToString(),
            GrossAmount = package.Price,
            DiscountAmount = 0,
            NetAmount = package.Price,
            DownPayment = hasDebt ? 0 : package.Price * 0.3m,
            InstallmentCount = 3,
            CreatedAtUtc = DateTime.UtcNow.AddDays(-40),
        };
        dbContext.EnrollmentContracts.Add(contract);
        profile.EnrollmentContractId = contract.Id;

        var remaining = contract.NetAmount - contract.DownPayment;
        var perInstallment = Math.Round(remaining / 3, 2);

        for (var i = 1; i <= 3; i++)
        {
            // Borçlu kursiyerde ilk taksitin vadesi geçmiş ve ödenmemiş.
            var dueDate = hasDebt
                ? DateTime.UtcNow.Date.AddDays(-10 + ((i - 1) * 30))
                : DateTime.UtcNow.Date.AddDays((i - 1) * 30);

            dbContext.FinanceInstallments.Add(new FinanceInstallment
            {
                EnrollmentContractId = contract.Id,
                StudentUserId = user.Id,
                StudentName = student.FullName,
                SeqNo = i,
                Label = $"{i}. Taksit",
                DueDateUtc = dueDate,
                Amount = perInstallment,
                PaidAmount = hasDebt ? 0 : (i == 1 ? perInstallment : 0),
                Status = hasDebt ? "Pending" : (i == 1 ? "Paid" : "Pending"),
            });
        }

        if (contract.DownPayment > 0)
        {
            dbContext.FinancePayments.Add(new FinancePayment
            {
                EnrollmentContractId = contract.Id,
                StudentUserId = user.Id,
                StudentName = student.FullName,
                Amount = contract.DownPayment,
                Method = "Nakit",
                ReceiptNo = $"DEMO-{Random.Shared.Next(10000, 99999)}",
                Note = "Kayıt peşinatı",
                PaidAtUtc = DateTime.UtcNow.AddDays(-40),
            });
        }

        await Task.CompletedTask;
    }

    /// <summary>
    /// Geçmiş: tamamlanmış dersler (değerlendirmeli), bir devamsızlık, bir geç iptal.
    /// Gelecek: önümüzdeki günlerin takvimini dolduran randevular.
    /// </summary>
    private async Task SeedAppointmentsAndLessonsAsync(
        List<StudentDrivingProfile> profiles,
        List<DrivingInstructorProfile> instructors,
        List<DrivingVehicle> vehicles,
        CancellationToken cancellationToken)
    {
        var elif = profiles[0];
        var burak = profiles[1];
        var ayse = profiles[2];
        var deniz = profiles[5];

        // ─── Geçmiş: tamamlanmış dersler ──────────────────────────────────────
        var completed = new[]
        {
            (Profile: elif, Instructor: instructors[0], Vehicle: vehicles[0], DayOffset: -7, Hour: 10, Scores: (4, 3, 3, 4), Note: "Vites geçişleri düzeldi, park manevrası çalışılmalı."),
            (Profile: elif, Instructor: instructors[0], Vehicle: vehicles[0], DayOffset: -4, Hour: 10, Scores: (4, 4, 4, 5), Note: "Şehir içi trafikte özgüveni arttı."),
            (Profile: burak, Instructor: instructors[0], Vehicle: vehicles[0], DayOffset: -6, Hour: 14, Scores: (3, 3, 2, 3), Note: "Ayna kontrolü zayıf, tekrar edilecek."),
            (Profile: deniz, Instructor: instructors[2], Vehicle: vehicles[2], DayOffset: -20, Hour: 11, Scores: (5, 5, 5, 5), Note: "Sınava hazır."),
        };

        foreach (var item in completed)
        {
            var start = At(item.DayOffset, item.Hour);
            var end = start.AddHours(1);

            var appointment = new DrivingAppointment
            {
                StudentDrivingProfileId = item.Profile.Id,
                InstructorProfileId = item.Instructor.Id,
                VehicleId = item.Vehicle.Id,
                StartsAtUtc = start,
                EndsAtUtc = end,
                Status = DrivingAppointmentStatus.Completed,
                MeetingPoint = "Kurs önü",
            };
            dbContext.DrivingAppointments.Add(appointment);

            var lesson = new DrivingLesson
            {
                AppointmentId = appointment.Id,
                StudentDrivingProfileId = item.Profile.Id,
                InstructorProfileId = item.Instructor.Id,
                VehicleId = item.Vehicle.Id,
                StartedAtUtc = start,
                CompletedAtUtc = end,
                StartKilometer = item.Vehicle.CurrentKilometer - 40,
                EndKilometer = item.Vehicle.CurrentKilometer - 20,
                BrakesOk = true, TiresOk = true, LightsOk = true, FluidsOk = true,
                TrafficRulesScore = item.Scores.Item1,
                VehicleControlScore = item.Scores.Item2,
                ManeuversScore = item.Scores.Item3,
                SafetyScore = item.Scores.Item4,
                InstructorNote = item.Note,
                ChargedMinutes = 60,
            };
            dbContext.DrivingLessons.Add(lesson);

            // Defter: rezervasyon kurulur, ders yapılınca çözülür ve kullanım işlenir.
            AddLedger(item.Profile.Id, DrivingLedgerEntryType.PlannedMinutes, -60, appointment.Id, null, start.AddDays(-2));
            AddLedger(item.Profile.Id, DrivingLedgerEntryType.ReservationReleased, 60, appointment.Id, null, end);
            AddLedger(item.Profile.Id, DrivingLedgerEntryType.LessonUsage, -60, appointment.Id, lesson.Id, end);
        }

        // ─── Geçmiş: devamsızlık (hak yandı) ──────────────────────────────────
        var noShowStart = At(-3, 15);
        var noShow = new DrivingAppointment
        {
            StudentDrivingProfileId = burak.Id,
            InstructorProfileId = instructors[0].Id,
            VehicleId = vehicles[0].Id,
            StartsAtUtc = noShowStart,
            EndsAtUtc = noShowStart.AddHours(1),
            Status = DrivingAppointmentStatus.NoShow,
        };
        dbContext.DrivingAppointments.Add(noShow);
        AddLedger(burak.Id, DrivingLedgerEntryType.PlannedMinutes, -60, noShow.Id, null, noShowStart.AddDays(-2));
        AddLedger(burak.Id, DrivingLedgerEntryType.ReservationReleased, 60, noShow.Id, null, noShowStart.AddHours(1));
        AddLedger(burak.Id, DrivingLedgerEntryType.NoShowDeductedMinutes, -60, noShow.Id, null, noShowStart.AddHours(1));

        // ─── Geçmiş: öğrencinin geç iptali (yarım hak yandı) ──────────────────
        var lateCancelStart = At(-2, 11);
        var lateCancel = new DrivingAppointment
        {
            StudentDrivingProfileId = ayse.Id,
            InstructorProfileId = instructors[1].Id,
            VehicleId = vehicles[1].Id,
            StartsAtUtc = lateCancelStart,
            EndsAtUtc = lateCancelStart.AddHours(1),
            Status = DrivingAppointmentStatus.CancelledByStudent,
            CancellationReason = "İşten izin alamadım.",
            CancelledAtUtc = lateCancelStart.AddHours(-6),
        };
        dbContext.DrivingAppointments.Add(lateCancel);
        AddLedger(ayse.Id, DrivingLedgerEntryType.PlannedMinutes, -60, lateCancel.Id, null, lateCancelStart.AddDays(-3));
        AddLedger(ayse.Id, DrivingLedgerEntryType.ReservationReleased, 60, lateCancel.Id, null, lateCancelStart.AddHours(-6));
        AddLedger(ayse.Id, DrivingLedgerEntryType.CancelledDeductedMinutes, -30, lateCancel.Id, null, lateCancelStart.AddHours(-6));

        // ─── Gelecek: takvimi dolduran randevular ─────────────────────────────
        var upcoming = new[]
        {
            (Profile: elif, Instructor: instructors[0], Vehicle: vehicles[0], DayOffset: 1, Hour: 10),
            (Profile: burak, Instructor: instructors[0], Vehicle: vehicles[0], DayOffset: 1, Hour: 13),
            (Profile: ayse, Instructor: instructors[1], Vehicle: vehicles[1], DayOffset: 1, Hour: 15),
            (Profile: elif, Instructor: instructors[0], Vehicle: vehicles[0], DayOffset: 2, Hour: 11),
            (Profile: ayse, Instructor: instructors[1], Vehicle: vehicles[1], DayOffset: 3, Hour: 10),
            (Profile: burak, Instructor: instructors[0], Vehicle: vehicles[0], DayOffset: 4, Hour: 14),
        };

        foreach (var item in upcoming)
        {
            var start = At(item.DayOffset, item.Hour);
            var appointment = new DrivingAppointment
            {
                StudentDrivingProfileId = item.Profile.Id,
                InstructorProfileId = item.Instructor.Id,
                VehicleId = item.Vehicle.Id,
                StartsAtUtc = start,
                EndsAtUtc = start.AddHours(1),
                Status = DrivingAppointmentStatus.Planned,
                MeetingPoint = "Kurs önü",
            };
            dbContext.DrivingAppointments.Add(appointment);

            // Gelecek randevular hâlâ rezervasyon tutar (çözülmez).
            AddLedger(item.Profile.Id, DrivingLedgerEntryType.PlannedMinutes, -60, appointment.Id, null, DateTime.UtcNow.AddDays(-1));
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        // Profil önbellek alanlarını defterle eşitle (ekranlar bu alanları okuyor).
        foreach (var profile in profiles)
        {
            var movements = await dbContext.DrivingLessonLedgerEntries.AsNoTracking()
                .Where(x => x.StudentDrivingProfileId == profile.Id)
                .Select(x => new LedgerMovement(x.EntryType, x.MinutesDelta))
                .ToListAsync(cancellationToken);

            var balance = DrivingLessonBalance.Compute(movements);
            var tracked = await dbContext.StudentDrivingProfiles.SingleAsync(x => x.Id == profile.Id, cancellationToken);
            tracked.PurchasedDrivingMinutes = balance.TotalGrantedMinutes;
            tracked.UsedDrivingMinutes = balance.ConsumedMinutes;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private void AddLedger(
        Guid profileId,
        DrivingLedgerEntryType type,
        int minutes,
        Guid? appointmentId,
        Guid? lessonId,
        DateTime createdAtUtc)
        => dbContext.DrivingLessonLedgerEntries.Add(new DrivingLessonLedgerEntry
        {
            StudentDrivingProfileId = profileId,
            EntryType = type,
            MinutesDelta = minutes,
            AppointmentId = appointmentId,
            DrivingLessonId = lessonId,
            Description = type switch
            {
                DrivingLedgerEntryType.PlannedMinutes => "Randevu için ayrılan süre",
                DrivingLedgerEntryType.ReservationReleased => "Rezervasyon çözüldü",
                DrivingLedgerEntryType.LessonUsage => "Direksiyon dersi",
                DrivingLedgerEntryType.NoShowDeductedMinutes => "Devamsızlık kesintisi",
                DrivingLedgerEntryType.CancelledDeductedMinutes => "Geç iptal cezası",
                _ => type.ToString(),
            },
            CreatedAtUtc = createdAtUtc,
        });
}
