using CourseIntellect.Application.DTOs.AccountLifecycle;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace CourseIntellect.Tests;

public sealed class AccountDeletionTests
{
    private static readonly Guid Tenant = Guid.Parse("11111111-1111-1111-1111-111111111111");

    private static TestDb NewDb()
    {
        var db = new TestDb();
        db.Context.Set<TenantWorkspace>().Add(new TenantWorkspace
        {
            Id = Tenant,
            Name = "Test Kurum",
            Slug = "test-kurum",
            ContactEmail = "test@example.com",
            Plan = "free",
            Status = "active",
        });
        db.Context.SaveChanges();
        return db;
    }

    private static AccountDeletionService NewService(TestDb db)
        => new(db.Context, new FakeHasher(), new FakeTenant(Tenant), new NoopAudit(),
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["AccountDeletion:GracePeriodDays"] = "7",
            }).Build());

    private static AppUser Student(Guid? id = null, string name = "Ali Veli") => new()
    {
        Id = id ?? Guid.NewGuid(),
        TenantId = Tenant,
        FullName = name,
        Username = $"user-{Guid.NewGuid():N}"[..12],
        PasswordHash = "correct-password",
        PrimaryRole = UserRole.Student,
        Status = UserStatus.Active,
        SecurityVersion = 1,
    };

    [Fact]
    public async Task Request_WithWrongPassword_Throws_AndCreatesNoRow()
    {
        using var db = NewDb();
        var user = Student();
        db.Context.Users.Add(user);
        await db.Context.SaveChangesAsync();

        var service = NewService(db);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.RequestAsync(user.Id, "Ali", new CreateAccountDeletionRequest { Password = "wrong", Confirm = true }));

        Assert.Equal(0, await db.Context.Set<AccountDeletionRequest>().CountAsync());
    }

    [Fact]
    public async Task Request_RequiresExplicitConfirm()
    {
        using var db = NewDb();
        var user = Student();
        db.Context.Users.Add(user);
        await db.Context.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewService(db).RequestAsync(user.Id, "Ali", new CreateAccountDeletionRequest { Password = "correct-password", Confirm = false }));
    }

    [Fact]
    public async Task Request_CreatesPending_WithFutureDeadline_AndIsIdempotent()
    {
        using var db = NewDb();
        var user = Student();
        db.Context.Users.Add(user);
        await db.Context.SaveChangesAsync();
        var service = NewService(db);

        var first = await service.RequestAsync(user.Id, "Ali", Ok());
        Assert.Equal("Pending", first.Status);
        Assert.True(first.FinalizeAtUtc > DateTime.UtcNow);
        Assert.True(first.CanCancel);

        // Tekrarlı talep: ikinci çağrı yeni satır OLUŞTURMAZ.
        var second = await service.RequestAsync(user.Id, "Ali", Ok());
        Assert.Equal(first.Id, second.Id);
        Assert.Equal(1, await db.Context.Set<AccountDeletionRequest>().CountAsync());
    }

    [Fact]
    public async Task Cancel_SetsCancelled()
    {
        using var db = NewDb();
        var user = Student();
        db.Context.Users.Add(user);
        await db.Context.SaveChangesAsync();
        var service = NewService(db);
        await service.RequestAsync(user.Id, "Ali", Ok());

        var cancelled = await service.CancelMineAsync(user.Id, "Ali");
        Assert.Equal("Cancelled", cancelled.Status);
        Assert.False(cancelled.CanCancel);
    }

    [Fact]
    public async Task SoleAdmin_WithoutSuccessor_Throws_WithSuccessor_PromotesAndAllows()
    {
        using var db = NewDb();
        var admin = Student(name: "Yönetici");
        admin.PrimaryRole = UserRole.Admin;
        var staff = Student(name: "Öğretmen");
        staff.PrimaryRole = UserRole.Teacher;
        db.Context.Users.AddRange(admin, staff);
        await db.Context.SaveChangesAsync();
        var service = NewService(db);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.RequestAsync(admin.Id, "Yönetici", Ok()));

        var ok = await service.RequestAsync(admin.Id, "Yönetici",
            new CreateAccountDeletionRequest { Password = "correct-password", Confirm = true, SuccessorAdminUserId = staff.Id });
        Assert.Equal("Pending", ok.Status);

        var promoted = await db.Context.Users.FirstAsync(x => x.Id == staff.Id);
        Assert.Equal(UserRole.Admin, promoted.PrimaryRole); // yönetici devri → süresiz kilit yok
    }

    [Fact]
    public async Task Finalize_Anonymizes_PurgesPersonal_RetainsFinanceAndEducation()
    {
        using var db = NewDb();
        var user = Student(name: "Ali Veli");
        db.Context.Users.Add(user);
        db.Context.Students.Add(new StudentProfile { TenantId = Tenant, UserId = user.Id, FullName = "Ali Veli", TcNo = "12345678901", Address = "X Mah." });
        db.Context.RefreshTokenSessions.Add(new RefreshTokenSession { UserId = user.Id, TokenHash = "h", ExpiresAtUtc = DateTime.UtcNow.AddDays(1) });
        db.Context.PushDeviceRegistrations.Add(new PushDeviceRegistration { TenantId = Tenant, UserId = user.Id, Token = "t" });
        // Finans FK (StudentUserId) ile bağlı → güvenilir anonimleştirme.
        db.Context.FinancePayments.Add(new FinancePayment { TenantId = Tenant, StudentUserId = user.Id, StudentName = "Ali Veli", Amount = 1500m, ReceiptNo = "R-1" });
        await db.Context.SaveChangesAsync();
        var originalVersion = user.SecurityVersion;

        // Eğitim kaydı FK'siz, yalnız AD ile bağlı; biçimlendirilmiş saklanan ada göre eşle.
        var storedName = await db.Context.Users.Where(x => x.Id == user.Id).Select(x => x.FullName).FirstAsync();
        db.Context.ExamResults.Add(new ExamResult { TenantId = Tenant, StudentName = storedName, Score = 85 });
        await db.Context.SaveChangesAsync();

        var lifecycle = new AccountLifecycleService(db.Context);
        var summary = await lifecycle.FinalizeAccountDeletionAsync(Tenant, user.Id);
        db.Context.ChangeTracker.Clear(); // gerçek finalizer taze kapsam kullanır; test bağlamında bayat izlenen varlıkları temizle

        var reloaded = await db.Context.Users.IgnoreQueryFilters().FirstAsync(x => x.Id == user.Id);
        Assert.Equal(AccountLifecycleService.Tombstone, reloaded.FullName);
        Assert.Equal(string.Empty, reloaded.TcNo);
        Assert.Equal(string.Empty, reloaded.PasswordHash);
        Assert.NotNull(reloaded.DeletedAtUtc);
        Assert.Equal(UserStatus.Passive, reloaded.Status);
        Assert.True(reloaded.SecurityVersion > originalVersion); // oturum/token iptali

        // Kişisel veri purge.
        Assert.Equal(0, await db.Context.RefreshTokenSessions.CountAsync(x => x.UserId == user.Id));
        Assert.Equal(0, await db.Context.PushDeviceRegistrations.CountAsync(x => x.UserId == user.Id));

        // Finans/eğitim ANONİM saklandı (satır + tutar/puan korunur, ad silinir).
        var pay = await db.Context.FinancePayments.FirstAsync();
        Assert.Equal(AccountLifecycleService.Tombstone, pay.StudentName);
        Assert.Equal(1500m, pay.Amount);
        var exam = await db.Context.ExamResults.FirstAsync();
        Assert.Equal(AccountLifecycleService.Tombstone, exam.StudentName);
        Assert.Equal(85, exam.Score);

        Assert.Contains("retainedFinance", summary);
    }

    [Fact]
    public async Task SoleAdmin_CannotHandOffToStudentOrParent()
    {
        using var db = NewDb();
        var admin = Student(name: "Yönetici");
        admin.PrimaryRole = UserRole.Admin;
        var student = Student(name: "Öğrenci"); // PrimaryRole = Student
        db.Context.Users.AddRange(admin, student);
        await db.Context.SaveChangesAsync();
        var service = NewService(db);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.RequestAsync(admin.Id, "Yönetici",
                new CreateAccountDeletionRequest { Password = "correct-password", Confirm = true, SuccessorAdminUserId = student.Id }));
        Assert.Contains("personel", ex.Message);

        // Öğrenci yükseltilmemeli, talep oluşmamalı.
        Assert.Equal(UserRole.Student, (await db.Context.Users.FirstAsync(x => x.Id == student.Id)).PrimaryRole);
        Assert.Equal(0, await db.Context.Set<AccountDeletionRequest>().CountAsync());
    }

    [Fact]
    public async Task Finalize_TeacherDeletion_DoesNotAnonymizeSameNamedStudentGrades()
    {
        using var db = NewDb();
        var teacher = Student(name: "Ayşe Kaya");
        teacher.PrimaryRole = UserRole.Teacher;
        db.Context.Users.Add(teacher);
        // Aynı adlı bir ÖĞRENCİ ve onun notu — öğretmen silinince BOZULMAMALI.
        db.Context.Students.Add(new StudentProfile { TenantId = Tenant, UserId = Guid.NewGuid(), FullName = "Ayşe Kaya", ClassName = "9A" });
        db.Context.ExamResults.Add(new ExamResult { TenantId = Tenant, StudentName = "Ayşe Kaya", ClassName = "9A", Score = 90 });
        await db.Context.SaveChangesAsync();

        await new AccountLifecycleService(db.Context).FinalizeAccountDeletionAsync(Tenant, teacher.Id);
        db.Context.ChangeTracker.Clear();

        var exam = await db.Context.ExamResults.IgnoreQueryFilters().FirstAsync();
        Assert.Equal("Ayşe Kaya", exam.StudentName); // öğretmenin StudentProfile'ı yok → ada göre eşleme yapılmaz
    }

    [Fact]
    public async Task Finalize_DuplicateNameClassStudents_SkipsEducationNameMatch()
    {
        using var db = NewDb();
        var s1 = Student(name: "Ali Yılmaz");
        db.Context.Users.Add(s1);
        db.Context.Students.Add(new StudentProfile { TenantId = Tenant, UserId = s1.Id, FullName = "Ali Yılmaz", ClassName = "10B" });
        // Aynı ad + aynı sınıf ikinci öğrenci → ad bazlı eşleme çakışır, ATLANMALI.
        db.Context.Students.Add(new StudentProfile { TenantId = Tenant, UserId = Guid.NewGuid(), FullName = "Ali Yılmaz", ClassName = "10B" });
        db.Context.ExamResults.Add(new ExamResult { TenantId = Tenant, StudentName = "Ali Yılmaz", ClassName = "10B", Score = 70 });
        await db.Context.SaveChangesAsync();

        var summary = await new AccountLifecycleService(db.Context).FinalizeAccountDeletionAsync(Tenant, s1.Id);
        db.Context.ChangeTracker.Clear();

        var exam = await db.Context.ExamResults.IgnoreQueryFilters().FirstAsync();
        Assert.Equal("Ali Yılmaz", exam.StudentName); // çakışma → dokunulmadı
        Assert.Contains("educationNameMatchSkipped\":true", summary);
    }

    [Fact]
    public async Task Finalize_DeletesSharedThread_WithOtherParticipantReply_NoFkError()
    {
        using var db = NewDb();
        var a = Student(name: "A");
        var b = Student(name: "B");
        db.Context.Users.AddRange(a, b);
        var thread = new MessageThread { TenantId = Tenant, ParticipantOneUserId = a.Id, ParticipantTwoUserId = b.Id };
        db.Context.MessageThreads.Add(thread);
        db.Context.MessageItems.Add(new MessageItem { TenantId = Tenant, ThreadId = thread.Id, SenderUserId = a.Id });
        db.Context.MessageItems.Add(new MessageItem { TenantId = Tenant, ThreadId = thread.Id, SenderUserId = b.Id }); // karşı taraf yanıtı
        await db.Context.SaveChangesAsync();

        await new AccountLifecycleService(db.Context).FinalizeAccountDeletionAsync(Tenant, a.Id); // FK hatası atmamalı
        db.Context.ChangeTracker.Clear();

        Assert.Equal(0, await db.Context.MessageThreads.IgnoreQueryFilters().CountAsync());
        Assert.Equal(0, await db.Context.MessageItems.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task Finalize_AnonymizesContract_ClearsConsentSignature()
    {
        using var db = NewDb();
        var user = Student(name: "Zeynep Ak");
        db.Context.Users.Add(user);
        db.Context.EnrollmentContracts.Add(new EnrollmentContract { TenantId = Tenant, StudentUserId = user.Id, StudentName = "Zeynep Ak", Note = "özel not" });
        db.Context.ConsentFormRecords.Add(new ConsentFormRecord { TenantId = Tenant, StudentProfileId = Guid.NewGuid(), StudentUserId = user.Id, StudentName = "Zeynep Ak", SignatureImage = "data:image/png;base64,AAAA" });
        await db.Context.SaveChangesAsync();

        await new AccountLifecycleService(db.Context).FinalizeAccountDeletionAsync(Tenant, user.Id);
        db.Context.ChangeTracker.Clear();

        var contract = await db.Context.EnrollmentContracts.IgnoreQueryFilters().FirstAsync();
        Assert.Equal(AccountLifecycleService.Tombstone, contract.StudentName);
        Assert.Equal(string.Empty, contract.Note);
        var consent = await db.Context.ConsentFormRecords.IgnoreQueryFilters().FirstAsync();
        Assert.Equal(AccountLifecycleService.Tombstone, consent.StudentName);
        Assert.Equal(string.Empty, consent.SignatureImage); // imza görseli silindi
    }

    [Fact]
    public async Task Finalize_DeletesPhysicalProfilePhoto_AndMessageAttachments()
    {
        using var db = NewDb();
        var user = Student(name: "Can Su");
        user.PhotoUrl = "/uploads/avatars/can.png";
        db.Context.Users.Add(user);
        db.Context.Students.Add(new StudentProfile { TenantId = Tenant, UserId = user.Id, FullName = "Can Su", PhotoUrl = "/uploads/students/can.png" });
        // Kullanıcının gönderdiği mesajda ek dosya (JSON) — fiziksel dosya da silinmeli.
        var thread = new MessageThread { TenantId = Tenant, ParticipantOneUserId = user.Id, ParticipantTwoUserId = Guid.NewGuid() };
        db.Context.MessageThreads.Add(thread);
        db.Context.MessageItems.Add(new MessageItem
        {
            TenantId = Tenant, ThreadId = thread.Id, SenderUserId = user.Id,
            Attachments = "[{\"FileName\":\"a.pdf\",\"OriginalFileName\":\"a.pdf\",\"FileUrl\":\"/uploads/messages/a.pdf\",\"FileType\":\"pdf\",\"Size\":10}]",
        });
        await db.Context.SaveChangesAsync();
        var storage = new RecordingStorage();

        await new AccountLifecycleService(db.Context, storage).FinalizeAccountDeletionAsync(Tenant, user.Id);

        Assert.Contains("/uploads/avatars/can.png", storage.Deleted);
        Assert.Contains("/uploads/students/can.png", storage.Deleted);
        Assert.Contains("/uploads/messages/a.pdf", storage.Deleted);
    }

    private sealed class RecordingStorage : IFileStorageService
    {
        public List<string> Deleted { get; } = [];
        public Task<CourseIntellect.Application.DTOs.Contents.UploadedAssetDto> SaveAsync(Stream s, string f, string c, string folder, string b, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<byte[]?> ReadBytesAsync(string u, CancellationToken ct = default) => Task.FromResult<byte[]?>(null);
        public Task<StoredFilePrefixDto?> ReadPrefixAsync(string u, int m, CancellationToken ct = default) => Task.FromResult<StoredFilePrefixDto?>(null);
        public Task<bool> DeleteAsync(string fileUrl, CancellationToken ct = default) { Deleted.Add(fileUrl); return Task.FromResult(true); }
    }

    [Fact]
    public async Task Finalize_AnonymizesAuditActorName()
    {
        using var db = NewDb();
        var user = Student(name: "Mehmet Demir");
        db.Context.Users.Add(user);
        db.Context.AuditLogEntries.Add(new AuditLogEntry { TenantId = Tenant, ActorUserId = user.Id, ActorName = "Mehmet Demir", Action = "login", Category = "auth" });
        await db.Context.SaveChangesAsync();

        await new AccountLifecycleService(db.Context).FinalizeAccountDeletionAsync(Tenant, user.Id);
        db.Context.ChangeTracker.Clear();

        var entry = await db.Context.AuditLogEntries.IgnoreQueryFilters().FirstAsync();
        Assert.Equal(AccountLifecycleService.Tombstone, entry.ActorName);
    }

    [Fact]
    public async Task Finalizer_CompletesDue_LeavesNotDueAndCancelledUntouched()
    {
        using var db = NewDb();
        var dueUser = Student(name: "Vadesi Gelen");
        var notDueUser = Student(name: "Vadesi Gelmeyen");
        var cancelledUser = Student(name: "İptal Eden");
        db.Context.Users.AddRange(dueUser, notDueUser, cancelledUser);
        var now = DateTime.UtcNow;
        db.Context.Set<AccountDeletionRequest>().AddRange(
            new AccountDeletionRequest { TenantId = Tenant, UserId = dueUser.Id, Status = AccountDeletionStatus.Scheduled, FinalizeAtUtc = now.AddMinutes(-1) },
            new AccountDeletionRequest { TenantId = Tenant, UserId = notDueUser.Id, Status = AccountDeletionStatus.Pending, FinalizeAtUtc = now.AddDays(3) },
            new AccountDeletionRequest { TenantId = Tenant, UserId = cancelledUser.Id, Status = AccountDeletionStatus.Cancelled, FinalizeAtUtc = now.AddMinutes(-1) });
        await db.Context.SaveChangesAsync();

        await AccountDeletionFinalizerService.ProcessDueAccountDeletionsAsync(
            db.Context, new AccountLifecycleService(db.Context), push: null, now: now);
        db.Context.ChangeTracker.Clear();

        // Vadesi gelen tamamlandı + kullanıcı anonimleşti.
        var due = await db.Context.Set<AccountDeletionRequest>().IgnoreQueryFilters().FirstAsync(x => x.UserId == dueUser.Id);
        Assert.Equal(AccountDeletionStatus.Completed, due.Status);
        Assert.NotNull(due.CompletedAtUtc);
        Assert.NotNull(due.RetainedSummaryJson);
        Assert.NotNull((await db.Context.Users.IgnoreQueryFilters().FirstAsync(x => x.Id == dueUser.Id)).DeletedAtUtc);

        // Vadesi gelmeyen ve iptal edilen: DOKUNULMADI.
        Assert.Equal(AccountDeletionStatus.Pending, (await db.Context.Set<AccountDeletionRequest>().IgnoreQueryFilters().FirstAsync(x => x.UserId == notDueUser.Id)).Status);
        Assert.Null((await db.Context.Users.IgnoreQueryFilters().FirstAsync(x => x.Id == notDueUser.Id)).DeletedAtUtc);
        Assert.Null((await db.Context.Users.IgnoreQueryFilters().FirstAsync(x => x.Id == cancelledUser.Id)).DeletedAtUtc);
    }

    private static CreateAccountDeletionRequest Ok()
        => new() { Password = "correct-password", Confirm = true };

    private sealed class FakeHasher : IPasswordHasher
    {
        public string Hash(string password) => password;
        public bool Verify(string password, string passwordHash) => password == passwordHash;
    }

    private sealed class FakeTenant(Guid tenantId) : ITenantContext
    {
        public Guid? CurrentTenantId { get; } = tenantId;
        public bool HasTenant => true;
    }

    private sealed class NoopAudit : IAuditLogService
    {
        public Task LogAsync(Guid? a, string b, string c, string d, string e, string f, string g, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogAsync(string a, string b, string c, string d, string e, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogChangeAsync(string a, string b, string c, string d, string e, object? before, object? after, CancellationToken ct = default) => Task.CompletedTask;
        public Task<IReadOnlyList<AuditLogDto>> GetAsync(string? c, int t, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<AuditLogDto>>([]);
        public Task<AuditLogPageDto> GetPagedAsync(AuditLogQuery q, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<AuditBranchSummaryDto>> GetBranchSummaryAsync(CancellationToken ct = default) => Task.FromResult<IReadOnlyList<AuditBranchSummaryDto>>([]);
    }
}
