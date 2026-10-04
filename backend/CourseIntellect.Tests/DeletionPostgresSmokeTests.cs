using CourseIntellect.Application.DTOs.Contents;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

/// <summary>
/// Gerçek PostgreSQL'e karşı uçtan-uca smoke: raw-SQL purge + FK davranışlarını (RESTRICT/SET NULL)
/// GERÇEK şemada doğrular — SQLite testlerinin kapsayamadığı tek nokta.
/// COURSE_INTELLECT_POSTGRES_TEST ayarlı değilse atlanır.
/// </summary>
public sealed class DeletionPostgresSmokeTests
{
    private static string Conn => Environment.GetEnvironmentVariable("COURSE_INTELLECT_POSTGRES_TEST")!;

    private static CourseIntellectDbContext NewContext()
    {
        var options = new DbContextOptionsBuilder<CourseIntellectDbContext>().UseNpgsql(Conn).Options;
        return new CourseIntellectDbContext(options);
    }

    private static AppUser User(Guid tenant, UserRole role, string name)
        => new() { Id = Guid.NewGuid(), TenantId = tenant, FullName = name, Username = $"u-{Guid.NewGuid():N}"[..20], PasswordHash = "h", PrimaryRole = role, Status = UserStatus.Active };

    [PostgreSqlFact("COURSE_INTELLECT_POSTGRES_TEST")]
    public async Task InstitutionFinalize_OnRealSchema_PurgesOperational_RetainsFinance_NoFkError()
    {
        var tenant = Guid.NewGuid();
        await using (var db = NewContext())
        {
            db.Set<TenantWorkspace>().Add(new TenantWorkspace { Id = tenant, Name = "Smoke Kurum", Slug = $"smoke-{Guid.NewGuid():N}"[..20], ContactEmail = "s@e.co", Plan = "free", Status = "active" });
            var role = new CustomRole { TenantId = tenant, Name = "Özel" };
            db.Set<CustomRole>().Add(role);
            var admin = User(tenant, UserRole.Admin, "Yönetici Kişi");
            admin.CustomRoleId = role.Id; // AppUser -> CustomRole [SetNull]
            var student = User(tenant, UserRole.Student, "Ali Veli");
            db.Users.AddRange(admin, student);

            // Finans defteri (retain + anonim) — kendi aralarında RESTRICT FK'li küme
            var contract = new EnrollmentContract { TenantId = tenant, StudentUserId = student.Id, StudentName = "Ali Veli" };
            var installment = new FinanceInstallment { TenantId = tenant, StudentUserId = student.Id, StudentName = "Ali Veli" };
            db.EnrollmentContracts.Add(contract);
            db.FinanceInstallments.Add(installment);
            var payment = new FinancePayment { TenantId = tenant, StudentUserId = student.Id, StudentName = "Ali Veli", Amount = 1000m, ReceiptNo = "R-1" };
            db.FinancePayments.Add(payment);
            await db.SaveChangesAsync();
            db.Set<FinancePaymentAllocation>().Add(new FinancePaymentAllocation { TenantId = tenant, FinancePaymentId = payment.Id, FinanceInstallmentId = installment.Id, Amount = 1000m });
            db.ExamResults.Add(new ExamResult { TenantId = tenant, StudentName = "Ali Veli", Score = 80 });
            db.AttendanceEntries.Add(new AttendanceEntry { TenantId = tenant, StudentName = "Ali Veli", LessonDate = DateTime.UtcNow });

            // Operasyonel (purge) — parent/child RESTRICT çiftleri topolojik sırayı sınar
            var book = new LibraryBook { TenantId = tenant, Title = "Kitap", Author = "Yazar", Isbn = "1" };
            db.Set<LibraryBook>().Add(book);
            await db.SaveChangesAsync();
            db.Set<LibraryLoan>().Add(new LibraryLoan { TenantId = tenant, BookId = book.Id, BookTitle = "Kitap", StudentName = "Ali Veli", DueAtUtc = DateTime.UtcNow.AddDays(7) });
            var thread = new MessageThread { TenantId = tenant, ParticipantOneUserId = admin.Id, ParticipantTwoUserId = student.Id };
            db.MessageThreads.Add(thread);
            await db.SaveChangesAsync();
            db.MessageItems.Add(new MessageItem { TenantId = tenant, ThreadId = thread.Id, SenderUserId = student.Id, Attachments = "[{\"FileName\":\"a.pdf\",\"OriginalFileName\":\"a.pdf\",\"FileUrl\":\"/uploads/messages/a.pdf\",\"FileType\":\"pdf\",\"Size\":1}]" });
            // Onam: ConsentFormRecord -> ConsentDocument [RESTRICT] (ikisi de purge; sıra kritik)
            var doc = new ConsentDocument { TenantId = tenant, FileName = "c.pdf", Content = [1, 2, 3] };
            db.ConsentDocuments.Add(doc);
            await db.SaveChangesAsync();
            db.ConsentFormRecords.Add(new ConsentFormRecord { TenantId = tenant, StudentProfileId = Guid.NewGuid(), StudentUserId = student.Id, StudentName = "Ali Veli", DocumentId = doc.Id });
            db.ContentItems.Add(new ContentItem { TenantId = tenant, Title = "Ders", Subject = "Mat", Teacher = "Öğretmen" });
            db.Notifications.Add(new NotificationItem { TenantId = tenant, Title = "B", Message = "m", TargetUserId = student.Id });
            db.Set<InstitutionDeletionRequest>().Add(new InstitutionDeletionRequest { TenantId = tenant, RequestedByUserId = admin.Id, Status = InstitutionDeletionStatus.Scheduled, FinalizeAtUtc = DateTime.UtcNow.AddMinutes(-1), ImpactSnapshotJson = "{}" });
            await db.SaveChangesAsync();
        }

        var recording = new RecordingStorage();
        // Finalizer yolu (request satırı Completed'a geçmeli, purge onu silmemeli).
        await using (var db = NewContext())
        {
            await AccountDeletionFinalizerService.ProcessDueInstitutionDeletionsAsync(
                db, new AccountLifecycleService(db, recording), DateTime.UtcNow);
        }

        await using (var db = NewContext())
        {
            // Operasyonel PURGE
            Assert.Equal(0, await db.ContentItems.IgnoreQueryFilters().CountAsync(x => x.TenantId == tenant));
            Assert.Equal(0, await db.Set<LibraryBook>().IgnoreQueryFilters().CountAsync(x => x.TenantId == tenant));
            Assert.Equal(0, await db.Set<LibraryLoan>().IgnoreQueryFilters().CountAsync(x => x.TenantId == tenant));
            Assert.Equal(0, await db.MessageItems.IgnoreQueryFilters().CountAsync(x => x.TenantId == tenant));
            Assert.Equal(0, await db.ConsentDocuments.IgnoreQueryFilters().CountAsync(x => x.TenantId == tenant));
            Assert.Equal(0, await db.ConsentFormRecords.IgnoreQueryFilters().CountAsync(x => x.TenantId == tenant));
            Assert.Equal(0, await db.Notifications.IgnoreQueryFilters().CountAsync(x => x.TenantId == tenant));

            // Finans RETAIN + anonim
            var pay = await db.FinancePayments.IgnoreQueryFilters().FirstAsync(x => x.TenantId == tenant);
            Assert.Equal(AccountLifecycleService.Tombstone, pay.StudentName);
            Assert.Equal(1000m, pay.Amount);
            Assert.Equal(1, await db.Set<FinancePaymentAllocation>().IgnoreQueryFilters().CountAsync(x => x.TenantId == tenant));
            Assert.Equal(1, await db.ExamResults.IgnoreQueryFilters().CountAsync(x => x.TenantId == tenant));

            // Kullanıcı anonim + erişim kapalı; CustomRole purge → CustomRoleId SET NULL
            var reAdmin = await db.Users.IgnoreQueryFilters().FirstAsync(x => x.Id != Guid.Empty && x.TenantId == tenant && x.FullName == AccountLifecycleService.Tombstone);
            Assert.NotNull(reAdmin.DeletedAtUtc);
            Assert.Null(await db.Set<CustomRole>().IgnoreQueryFilters().FirstOrDefaultAsync(x => x.TenantId == tenant));

            // Talep satırı HAYATTA + Completed
            var req = await db.Set<InstitutionDeletionRequest>().IgnoreQueryFilters().FirstOrDefaultAsync(x => x.TenantId == tenant);
            Assert.NotNull(req);
            Assert.Equal(InstitutionDeletionStatus.Completed, req!.Status);

            // Fiziksel dosyalar silinmeye çalışıldı (foto yok ama mesaj eki var)
            Assert.Contains("/uploads/messages/a.pdf", recording.Deleted);

            // Temizlik — FK sırası: önce bağımlı (allocation), sonra payment/installment/contract.
            await db.Database.ExecuteSqlRawAsync("DELETE FROM finance_payment_allocations WHERE tenant_id = {0}", tenant);
            await db.Database.ExecuteSqlRawAsync("DELETE FROM finance_payments WHERE tenant_id = {0}", tenant);
            await db.Database.ExecuteSqlRawAsync("DELETE FROM finance_installments WHERE tenant_id = {0}", tenant);
            await db.Database.ExecuteSqlRawAsync("DELETE FROM enrollment_contracts WHERE tenant_id = {0}", tenant);
            await db.Database.ExecuteSqlRawAsync("DELETE FROM exam_results WHERE tenant_id = {0}", tenant);
            await db.Database.ExecuteSqlRawAsync("DELETE FROM attendance_entries WHERE tenant_id = {0}", tenant);
            await db.Database.ExecuteSqlRawAsync("DELETE FROM institution_deletion_requests WHERE tenant_id = {0}", tenant);
            await db.Database.ExecuteSqlRawAsync("DELETE FROM users WHERE tenant_id = {0}", tenant);
            await db.Database.ExecuteSqlRawAsync("DELETE FROM tenant_workspaces WHERE id = {0}", tenant);
        }
    }

    [PostgreSqlFact("COURSE_INTELLECT_POSTGRES_TEST")]
    public async Task AccountFinalize_OnRealSchema_AnonymizesUser_PurgesPersonal_RetainsFinance()
    {
        var tenant = Guid.NewGuid();
        var userId = Guid.NewGuid();
        await using (var db = NewContext())
        {
            db.Set<TenantWorkspace>().Add(new TenantWorkspace { Id = tenant, Name = "Smoke2", Slug = $"s2-{Guid.NewGuid():N}"[..20], ContactEmail = "s2@e.co", Plan = "free", Status = "active" });
            db.Users.Add(new AppUser { Id = userId, TenantId = tenant, FullName = "Veli Can", Username = $"u-{Guid.NewGuid():N}"[..20], PasswordHash = "h", PrimaryRole = UserRole.Student, Status = UserStatus.Active });
            db.FinancePayments.Add(new FinancePayment { TenantId = tenant, StudentUserId = userId, StudentName = "Veli Can", Amount = 500m, ReceiptNo = "R-2" });
            var thread = new MessageThread { TenantId = tenant, ParticipantOneUserId = userId, ParticipantTwoUserId = Guid.NewGuid() };
            db.MessageThreads.Add(thread);
            await db.SaveChangesAsync();
            db.MessageItems.Add(new MessageItem { TenantId = tenant, ThreadId = thread.Id, SenderUserId = userId });
            await db.SaveChangesAsync();
        }

        await using (var db = NewContext())
        {
            await new AccountLifecycleService(db, new RecordingStorage()).FinalizeAccountDeletionAsync(tenant, userId);
        }

        await using (var db = NewContext())
        {
            var user = await db.Users.IgnoreQueryFilters().FirstAsync(x => x.Id == userId);
            Assert.Equal(AccountLifecycleService.Tombstone, user.FullName);
            Assert.NotNull(user.DeletedAtUtc);
            Assert.True(user.SecurityVersion > 1);
            Assert.Equal(0, await db.MessageItems.IgnoreQueryFilters().CountAsync(x => x.TenantId == tenant));
            var pay = await db.FinancePayments.IgnoreQueryFilters().FirstAsync(x => x.TenantId == tenant);
            Assert.Equal(AccountLifecycleService.Tombstone, pay.StudentName);
            Assert.Equal(500m, pay.Amount);

            await db.Database.ExecuteSqlRawAsync("DELETE FROM users WHERE tenant_id = {0}", tenant);
            await db.Database.ExecuteSqlRawAsync("DELETE FROM finance_payments WHERE tenant_id = {0}", tenant);
            await db.Database.ExecuteSqlRawAsync("DELETE FROM message_threads WHERE tenant_id = {0}", tenant);
            await db.Database.ExecuteSqlRawAsync("DELETE FROM tenant_workspaces WHERE id = {0}", tenant);
        }
    }

    private sealed class RecordingStorage : IFileStorageService
    {
        public List<string> Deleted { get; } = [];
        public Task<UploadedAssetDto> SaveAsync(Stream s, string f, string c, string folder, string b, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<byte[]?> ReadBytesAsync(string u, CancellationToken ct = default) => Task.FromResult<byte[]?>(null);
        public Task<StoredFilePrefixDto?> ReadPrefixAsync(string u, int m, CancellationToken ct = default) => Task.FromResult<StoredFilePrefixDto?>(null);
        public Task<bool> DeleteAsync(string fileUrl, CancellationToken ct = default) { Deleted.Add(fileUrl); return Task.FromResult(true); }
    }
}
