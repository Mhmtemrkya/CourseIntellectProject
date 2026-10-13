using System.Text.Json;
using CourseIntellect.Application.DTOs.Messages;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Yıkıcı tamamlama motoru. Kişisel verileri GERÇEKTEN temizler (yalnız pasifleştirmez);
/// finans/eğitim satırlarını kişisel tanımlayıcıları silerek ANONİM saklar.
/// Yalnız finalizer tarafından, config bayrağı açıkken çağrılır.
/// </summary>
public sealed class AccountLifecycleService(
    CourseIntellectDbContext dbContext,
    IFileStorageService? fileStorage = null) : IAccountLifecycleService
{
    /// <summary>Anonimleştirilmiş satırlarda kişi adı yerine yazılan iz (tombstone).</summary>
    public const string Tombstone = "Silinmiş Kullanıcı";

    /// <summary>
    /// Kurum silmede fiziksel olarak SİLİNMEYİP anonimleştirilerek saklanan tablolar:
    /// yasal (muhasebe/eğitim) yükümlülük + kullanıcı/profil (FK bütünlüğü + anonim iz) +
    /// denetim izi. Bunların dışındaki tüm tenant-scoped tablolar kurum silmede PURGE edilir.
    /// </summary>
    private static readonly HashSet<Type> InstitutionRetainTypes =
    [
        // Kullanıcı/profil (anonim iz + FK bütünlüğü)
        typeof(AppUser), typeof(StudentProfile), typeof(StaffProfile),
        // Finans defteri (yasal/muhasebe — tutar/makbuz bütünlüğü için tam küme)
        typeof(FinancePayment), typeof(FinanceInstallment), typeof(EnrollmentContract),
        typeof(FinancePaymentAllocation), typeof(FinanceReceiptSequence), typeof(AccountingInvoice),
        // Eğitim kayıtları
        typeof(ExamResult), typeof(ExamSession), typeof(AttendanceEntry), typeof(HomeworkSubmission),
        typeof(StudentQuestionThread), typeof(StudentQuestionReply),
        typeof(TeacherDuty), typeof(TeacherTimetableSlot),
        // Denetim izi + kurum kaydı + silme talepleri (finalizer bu satırı günceller → silinmemeli)
        typeof(AuditLogEntry), typeof(TenantWorkspace),
        typeof(AccountDeletionRequest), typeof(InstitutionDeletionRequest), typeof(DeletionFileTask),
    ];

    public async Task<string> FinalizeAccountDeletionAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken = default)
    {
        // Arka plan akışı: sorgu filtreleri bu tenant'a göre çözülsün.
        dbContext.SetTenantOverride(tenantId);
        try
        {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        var userExists = await dbContext.Users.IgnoreQueryFilters()
            .AnyAsync(x => x.Id == userId && x.TenantId == tenantId, cancellationToken);
        if (!userExists) throw new InvalidOperationException("Kullanıcı bulunamadı.");

        if (await dbContext.Users.IgnoreQueryFilters().AnyAsync(x => x.Id == userId && x.DeletedAtUtc != null, cancellationToken))
        {
            await transaction.CommitAsync(cancellationToken);
            var retriedFiles = await CompleteFilesAsync($"account:{userId:N}", cancellationToken);
            return JsonSerializer.Serialize(new { retriedFiles });
        }

        // Fiziksel medyayı (profil görseli + mesaj ekleri) anonimleştirmeden ÖNCE topla;
        // commit'ten SONRA diskten sil.
        var filesToDelete = new List<string>();
        filesToDelete.AddRange(await dbContext.Users.IgnoreQueryFilters()
            .Where(x => x.Id == userId && x.PhotoUrl != "").Select(x => x.PhotoUrl).ToListAsync(cancellationToken));
        filesToDelete.AddRange(await dbContext.Students.Where(x => x.UserId == userId && x.PhotoUrl != "")
            .Select(x => x.PhotoUrl).ToListAsync(cancellationToken));
        filesToDelete.AddRange(await dbContext.Staff.Where(x => x.UserId == userId && x.PhotoUrl != "")
            .Select(x => x.PhotoUrl).ToListAsync(cancellationToken));
        // Kullanıcının gönderdiği + katıldığı sohbetlerdeki mesaj eklerinin dosyaları.
        var attachmentJsons = await dbContext.MessageItems
            .Where(x => x.SenderUserId == userId
                || dbContext.MessageThreads
                    .Where(t => t.ParticipantOneUserId == userId || t.ParticipantTwoUserId == userId)
                    .Select(t => t.Id).Contains(x.ThreadId))
            .Where(x => x.Attachments != "" && x.Attachments != "[]")
            .Select(x => x.Attachments)
            .ToListAsync(cancellationToken);
        filesToDelete.AddRange(ExtractAttachmentUrls(attachmentJsons));

        var educationNameMatchSkipped = false;

        // 1) EĞİTİM kayıtları.
        // ExamResult/AttendanceEntry FK taşımaz, yalnız (ad, sınıf) ile bağlıdır. Ad çakışması
        // (aynı adlı başka öğrenci/öğretmen) başkasının kaydını bozmasın diye: ad bazlı eşleme
        // YALNIZCA silinen kişinin bir ÖĞRENCİ profili varsa ve (ad, sınıf) o tenant'ta
        // BENZERSİZSE yapılır; değilse atlanır ve özet "review" olarak işaretlenir.
        var retainedEducation = 0;
        var studentProfile = await dbContext.Students
            .IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && x.UserId == userId)
            .Select(x => new { x.FullName, x.ClassName })
            .FirstOrDefaultAsync(cancellationToken);
        if (studentProfile is not null && !string.IsNullOrWhiteSpace(studentProfile.FullName))
        {
            var sameNameClass = await dbContext.Students
                .IgnoreQueryFilters()
                .CountAsync(x => x.TenantId == tenantId
                    && x.FullName == studentProfile.FullName
                    && x.ClassName == studentProfile.ClassName, cancellationToken);
            if (sameNameClass <= 1)
            {
                retainedEducation += await dbContext.ExamResults
                    .Where(x => x.StudentName == studentProfile.FullName && x.ClassName == studentProfile.ClassName)
                    .ExecuteUpdateAsync(s => s.SetProperty(p => p.StudentName, Tombstone), cancellationToken);
                retainedEducation += await dbContext.AttendanceEntries
                    .Where(x => x.StudentName == studentProfile.FullName && x.ClassName == studentProfile.ClassName)
                    .ExecuteUpdateAsync(s => s.SetProperty(p => p.StudentName, Tombstone), cancellationToken);
            }
            else
            {
                throw new InvalidOperationException("education-identity-review-required"); // no false completion for ambiguous legacy data
            }
        }
        // FK'li eğitim kayıtları her zaman güvenli şekilde anonimleştirilir.
        retainedEducation += await dbContext.HomeworkSubmissions
            .Where(x => x.StudentUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.StudentName, Tombstone), cancellationToken);
        retainedEducation += await dbContext.StudentQuestionThreads
            .Where(x => x.StudentUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.StudentName, Tombstone), cancellationToken);

        // 2) FİNANS kayıtları — FK referanslı; satır/tutar korunur, ad anonimleşir.
        var retainedFinance = await dbContext.FinancePayments
            .Where(x => x.StudentUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.StudentName, Tombstone), cancellationToken);
        retainedFinance += await dbContext.FinanceInstallments
            .Where(x => x.StudentUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.StudentName, Tombstone), cancellationToken);
        retainedFinance += await dbContext.EnrollmentContracts
            .Where(x => x.StudentUserId == userId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.StudentName, Tombstone)
                .SetProperty(p => p.Note, string.Empty), cancellationToken);

        // 2b) Diğer FK-referanslı denormalize PII (öğrenci/öğretmen/gönderen adı) — anonimleştir.
        retainedEducation += await dbContext.ExamSessions
            .Where(x => x.StudentUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.StudentName, Tombstone), cancellationToken);
        await dbContext.StudentQuestionThreads
            .Where(x => x.TeacherUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.TeacherName, Tombstone), cancellationToken);
        await dbContext.StudentQuestionReplies
            .Where(x => x.SenderUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.SenderName, Tombstone), cancellationToken);
        await dbContext.TeacherDuties
            .Where(x => x.TeacherUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.TeacherName, Tombstone), cancellationToken);
        await dbContext.TeacherTimetableSlots
            .Where(x => x.TeacherUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.TeacherName, Tombstone), cancellationToken);
        // Onam (imzalı) kayıtları — imza görseli SİLİNİR, ad anonimleşir (kalan kayıt yasal iz).
        await dbContext.ConsentFormRecords
            .Where(x => x.StudentUserId == userId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.StudentName, Tombstone)
                .SetProperty(p => p.SignatureImage, string.Empty), cancellationToken);

        filesToDelete.AddRange(await DeletionDataCleaner.CleanLegacyAsync(dbContext, tenantId, userId, cancellationToken));

        // 3) Profil PII'si (satır korunur; finans/eğitim FK bütünlüğü için).
        await dbContext.Students
            .Where(x => x.UserId == userId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.FullName, Tombstone)
                .SetProperty(p => p.TcNo, string.Empty)
                .SetProperty(p => p.BirthDate, string.Empty)
                .SetProperty(p => p.Address, string.Empty)
                .SetProperty(p => p.Note, string.Empty)
                .SetProperty(p => p.PhotoUrl, string.Empty)
                .SetProperty(p => p.CurrentSchool, string.Empty).SetProperty(p => p.SchoolNumber, string.Empty)
                .SetProperty(p => p.ParentName, string.Empty).SetProperty(p => p.ParentPhone, string.Empty)
                .SetProperty(p => p.ParentEmail, string.Empty).SetProperty(p => p.ParentUserId, (Guid?)null), cancellationToken);
        // Veli olarak başka öğrencilere bağlıysa veli PII'sini de temizle.
        await dbContext.Students
            .Where(x => x.ParentUserId == userId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.ParentName, Tombstone)
                .SetProperty(p => p.ParentPhone, string.Empty)
                .SetProperty(p => p.ParentEmail, string.Empty), cancellationToken);
        await dbContext.Staff
            .Where(x => x.UserId == userId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.FullName, Tombstone)
                .SetProperty(p => p.TcNo, string.Empty)
                .SetProperty(p => p.Phone, string.Empty)
                .SetProperty(p => p.Email, string.Empty)
                .SetProperty(p => p.Note, string.Empty)
                .SetProperty(p => p.Education, string.Empty).SetProperty(p => p.StartDate, string.Empty)
                .SetProperty(p => p.MaritalStatus, string.Empty).SetProperty(p => p.ChildCount, 0)
                .SetProperty(p => p.Campus, string.Empty).SetProperty(p => p.DepartmentOrBranch, string.Empty)
                .SetProperty(p => p.HomeroomClass, string.Empty).SetProperty(p => p.AssignedClassesSerialized, string.Empty)
                .SetProperty(p => p.PhotoUrl, string.Empty), cancellationToken);

        // 4) Kişisel/geçici veriyi TEMİZLE (purge).
        await PurgeUserPersonalDataAsync(userId, cancellationToken);

        // 5) AppUser satırını anonimleştir + oturumları geçersiz kıl. ExecuteUpdate ile
        //    (SaveChanges biçimleyicisini atlar; tombstone birebir "Silinmiş Kullanıcı" kalır).
        await dbContext.Users
            .IgnoreQueryFilters()
            .Where(x => x.Id == userId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.FullName, Tombstone)
                .SetProperty(p => p.Username, $"deleted-{userId:N}") // benzersiz, 40 karakter
                .SetProperty(p => p.PasswordHash, string.Empty)
                .SetProperty(p => p.TcNo, string.Empty)
                .SetProperty(p => p.Phone, (string?)null)
                .SetProperty(p => p.PhotoUrl, string.Empty)
                .SetProperty(p => p.PlatformAccessEmail, (string?)null)
                .SetProperty(p => p.Campus, string.Empty)
                .SetProperty(p => p.DepartmentOrBranch, string.Empty)
                .SetProperty(p => p.RoleHistorySerialized, "[]").SetProperty(p => p.ExtraRolesSerialized, "")
                .SetProperty(p => p.Status, UserStatus.Passive)
                .SetProperty(p => p.DeletedAtUtc, (DateTime?)DateTime.UtcNow)
                .SetProperty(p => p.SecurityVersion, p => p.SecurityVersion + 1), cancellationToken);

        filesToDelete.AddRange(await DeletionDataCleaner.CleanAsync(dbContext, tenantId, userId, cancellationToken));
        await QueueFilesAsync(tenantId, $"account:{userId:N}", filesToDelete, cancellationToken);
        // Unlink deleted ownership; platform operations can assign a replacement later.
        await dbContext.Set<TenantWorkspace>().Where(x => x.Id == tenantId && x.AdminUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.AdminUserId, (Guid?)null), cancellationToken);
        await dbContext.Set<TenantGroup>().Where(x => x.OwnerUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.OwnerUserId, (Guid?)null), cancellationToken);

        // Tamamlanma denetim kaydı — yalnız sayılar, PII yok, aktör "Sistem".
        dbContext.AuditLogEntries.Add(new Domain.Entities.AuditLogEntry
        {
            TenantId = tenantId,
            ActorName = "Sistem",
            Action = "account-deletion-completed",
            Category = "account-lifecycle",
            EntityType = nameof(Domain.Entities.AppUser),
            EntityId = userId.ToString(),
            Detail = $"retainedFinance={retainedFinance};retainedEducation={retainedEducation};educationNameMatchSkipped={educationNameMatchSkipped}",
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        var deletedFiles = await CompleteFilesAsync($"account:{userId:N}", cancellationToken);

        return JsonSerializer.Serialize(new
        {
            retainedFinance,
            retainedEducation,
            educationNameMatchSkipped,
            deletedFiles,
        });
        }
        finally
        {
            dbContext.SetTenantOverride(null);
        }
    }

    public async Task FinalizeInstitutionDeletionAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        dbContext.SetTenantOverride(tenantId);
        try
        {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        if (await dbContext.Set<TenantWorkspace>().IgnoreQueryFilters().AnyAsync(x => x.Id == tenantId && x.Status == "deleted", cancellationToken))
        {
            await transaction.CommitAsync(cancellationToken);
            await CompleteFilesAsync($"institution:{tenantId:N}", cancellationToken);
            return;
        }

        // Fiziksel dosyaları (profil görselleri + mesaj ekleri) purge'den ÖNCE topla.
        var filesToDelete = new List<string>();
        filesToDelete.AddRange(await dbContext.Users.Where(x => x.TenantId == tenantId && x.PhotoUrl != "")
            .Select(x => x.PhotoUrl).ToListAsync(cancellationToken));
        filesToDelete.AddRange(await dbContext.Students.Where(x => x.TenantId == tenantId && x.PhotoUrl != "")
            .Select(x => x.PhotoUrl).ToListAsync(cancellationToken));
        filesToDelete.AddRange(await dbContext.Staff.Where(x => x.TenantId == tenantId && x.PhotoUrl != "")
            .Select(x => x.PhotoUrl).ToListAsync(cancellationToken));
        var tenantAttachmentJsons = await dbContext.MessageItems
            .Where(x => x.TenantId == tenantId && x.Attachments != "" && x.Attachments != "[]")
            .Select(x => x.Attachments).ToListAsync(cancellationToken);
        filesToDelete.AddRange(ExtractAttachmentUrls(tenantAttachmentJsons));

        // Her ifade AÇIKÇA tenant'a daraltılır (yalnız sorgu filtresine güvenilmez) —
        // başka kurumun verisine asla dokunulmaz.
        // Finans/eğitim kişisel adlarını anonimleştir (satırlar kalır).
        await dbContext.FinancePayments.Where(x => x.TenantId == tenantId).ExecuteUpdateAsync(s => s.SetProperty(p => p.StudentName, Tombstone), cancellationToken);
        await dbContext.FinanceInstallments.Where(x => x.TenantId == tenantId).ExecuteUpdateAsync(s => s.SetProperty(p => p.StudentName, Tombstone), cancellationToken);
        await dbContext.EnrollmentContracts.Where(x => x.TenantId == tenantId).ExecuteUpdateAsync(s => s
            .SetProperty(p => p.StudentName, Tombstone).SetProperty(p => p.Note, string.Empty), cancellationToken);
        await dbContext.ExamResults.Where(x => x.TenantId == tenantId).ExecuteUpdateAsync(s => s.SetProperty(p => p.StudentName, Tombstone), cancellationToken);
        await dbContext.ExamSessions.Where(x => x.TenantId == tenantId).ExecuteUpdateAsync(s => s
            .SetProperty(p => p.StudentName, Tombstone), cancellationToken);
        await dbContext.AttendanceEntries.Where(x => x.TenantId == tenantId).ExecuteUpdateAsync(s => s.SetProperty(p => p.StudentName, Tombstone), cancellationToken);
        await dbContext.HomeworkSubmissions.Where(x => x.TenantId == tenantId).ExecuteUpdateAsync(s => s.SetProperty(p => p.StudentName, Tombstone), cancellationToken);
        await dbContext.StudentQuestionThreads.Where(x => x.TenantId == tenantId).ExecuteUpdateAsync(s => s
            .SetProperty(p => p.StudentName, Tombstone).SetProperty(p => p.TeacherName, Tombstone), cancellationToken);
        await dbContext.StudentQuestionReplies.Where(x => x.TenantId == tenantId).ExecuteUpdateAsync(s => s.SetProperty(p => p.SenderName, Tombstone), cancellationToken);
        await dbContext.TeacherDuties.Where(x => x.TenantId == tenantId).ExecuteUpdateAsync(s => s.SetProperty(p => p.TeacherName, Tombstone), cancellationToken);
        await dbContext.TeacherTimetableSlots.Where(x => x.TenantId == tenantId).ExecuteUpdateAsync(s => s.SetProperty(p => p.TeacherName, Tombstone), cancellationToken);
        // Not: ConsentFormRecord ve ConsentDocument (imzalı PDF) finans/eğitim DEĞİL → aşağıda PURGE edilir.

        // Profiller + kullanıcılar: PII temizliği + erişim kapat.
        await dbContext.Students.Where(x => x.TenantId == tenantId).ExecuteUpdateAsync(s => s
            .SetProperty(p => p.FullName, Tombstone)
            .SetProperty(p => p.TcNo, string.Empty)
            .SetProperty(p => p.BirthDate, string.Empty)
            .SetProperty(p => p.Address, string.Empty)
            .SetProperty(p => p.Note, string.Empty)
            .SetProperty(p => p.ParentName, Tombstone)
            .SetProperty(p => p.ParentPhone, string.Empty)
            .SetProperty(p => p.ParentEmail, string.Empty)
            .SetProperty(p => p.PhotoUrl, string.Empty).SetProperty(p => p.CurrentSchool, "").SetProperty(p => p.SchoolNumber, "")
            .SetProperty(p => p.ParentUserId, (Guid?)null), cancellationToken);
        await dbContext.Staff.Where(x => x.TenantId == tenantId).ExecuteUpdateAsync(s => s
            .SetProperty(p => p.FullName, Tombstone)
            .SetProperty(p => p.TcNo, string.Empty)
            .SetProperty(p => p.Phone, string.Empty)
            .SetProperty(p => p.Email, string.Empty)
            .SetProperty(p => p.Note, string.Empty)
            .SetProperty(p => p.PhotoUrl, string.Empty).SetProperty(p => p.Education, "").SetProperty(p => p.StartDate, "")
            .SetProperty(p => p.MaritalStatus, "").SetProperty(p => p.ChildCount, 0).SetProperty(p => p.Campus, "")
            .SetProperty(p => p.DepartmentOrBranch, "").SetProperty(p => p.HomeroomClass, "").SetProperty(p => p.AssignedClassesSerialized, ""), cancellationToken);
        await dbContext.Users.Where(x => x.TenantId == tenantId).ExecuteUpdateAsync(s => s
            .SetProperty(p => p.Username, p => "deleted-" + p.Id.ToString())
            .SetProperty(p => p.Campus, "").SetProperty(p => p.DepartmentOrBranch, "")
            .SetProperty(p => p.RoleHistorySerialized, "[]").SetProperty(p => p.ExtraRolesSerialized, "")
            .SetProperty(p => p.FullName, Tombstone)
            .SetProperty(p => p.TcNo, string.Empty)
            .SetProperty(p => p.Phone, (string?)null)
            .SetProperty(p => p.PhotoUrl, string.Empty)
            .SetProperty(p => p.PlatformAccessEmail, (string?)null)
            .SetProperty(p => p.PasswordHash, string.Empty)
            .SetProperty(p => p.Status, UserStatus.Passive)
            .SetProperty(p => p.DeletedAtUtc, DateTime.UtcNow)
            .SetProperty(p => p.SecurityVersion, p => p.SecurityVersion + 1), cancellationToken);

        // Denetim izindeki aktör adını anonimleştir (audit tablosu saklanır).
        await dbContext.AuditLogEntries.Where(x => x.TenantId == tenantId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.ActorName, Tombstone).SetProperty(p => p.Detail, "")
                .SetProperty(p => p.IpAddress, (string?)null).SetProperty(p => p.UserAgent, (string?)null)
                .SetProperty(p => p.BeforeValue, (string?)null).SetProperty(p => p.AfterValue, (string?)null), cancellationToken);

        // Kullanıcı-scoped oturum/kod kayıtları (TenantId taşımaz) elle temizlenir.
        var tenantUserIds = await dbContext.Users.Where(x => x.TenantId == tenantId).Select(x => x.Id).ToListAsync(cancellationToken);
        await dbContext.Set<AdminMfaChallenge>().Where(x => tenantUserIds.Contains(x.UserId)).ExecuteDeleteAsync(cancellationToken);
        await dbContext.Set<UserScopeGrant>().Where(x => tenantUserIds.Contains(x.UserId)).ExecuteDeleteAsync(cancellationToken);
        await dbContext.Set<TenantGroup>().Where(x => x.OwnerUserId != null && tenantUserIds.Contains(x.OwnerUserId.Value))
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.OwnerUserId, (Guid?)null), cancellationToken);
        await dbContext.RefreshTokenSessions.Where(x => tenantUserIds.Contains(x.UserId)).ExecuteDeleteAsync(cancellationToken);
        await dbContext.AuthorizationCodes.Where(x => tenantUserIds.Contains(x.UserId)).ExecuteDeleteAsync(cancellationToken);

        filesToDelete.AddRange(await DeletionDataCleaner.CleanAsync(dbContext, tenantId, null, cancellationToken, InstitutionRetainTypes));
        await QueueFilesAsync(tenantId, $"institution:{tenantId:N}", filesToDelete, cancellationToken);
        await dbContext.Set<TenantRegistrationApplication>().Where(x => x.CreatedTenantId == tenantId)
            .ExecuteDeleteAsync(cancellationToken);
        // Retain listesi DIŞINDAKİ tüm tenant-scoped tabloları fiziksel sil (mesaj, bildirim,
        // push, içerik, kütüphane, kurs, program, rehberlik, onam belgeleri, sürücü evrakı vb.).
        var purgedRows = await PurgeTenantOperationalTablesAsync(tenantId, cancellationToken);

        // Kurum artık erişilemez: workspace'i silinmiş olarak işaretle.
        await dbContext.Set<Domain.Entities.TenantWorkspace>()
            .IgnoreQueryFilters()
            .Where(x => x.Id == tenantId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, "deleted")
                .SetProperty(p => p.ContactName, "").SetProperty(p => p.ContactEmail, "").SetProperty(p => p.ContactPhone, (string?)null)
                .SetProperty(p => p.AdminUserId, (Guid?)null).SetProperty(p => p.RegistrationIp, (string?)null)
                .SetProperty(p => p.RegistrationUserAgent, (string?)null).SetProperty(p => p.RegistrationReferer, (string?)null)
                .SetProperty(p => p.PendingAdminPasswordHash, (string?)null).SetProperty(p => p.ContactTitle, (string?)null), cancellationToken);

        // Tamamlanma denetim kaydı (yalnız PII'siz özet, aktör "Sistem").
        dbContext.AuditLogEntries.Add(new Domain.Entities.AuditLogEntry
        {
            TenantId = tenantId,
            ActorName = "Sistem",
            Action = "institution-deletion-completed",
            Category = "account-lifecycle",
            EntityType = nameof(Domain.Entities.TenantWorkspace),
            EntityId = tenantId.ToString(),
            Detail = $"de-identified + purged; purgedRows={purgedRows}",
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        await CompleteFilesAsync($"institution:{tenantId:N}", cancellationToken);
        }
        finally
        {
            dbContext.SetTenantOverride(null);
        }
    }

    private async Task QueueFilesAsync(Guid tenantId, string operation, IEnumerable<string> urls, CancellationToken ct)
    {
        var existing = await dbContext.Set<DeletionFileTask>().IgnoreQueryFilters().Where(x => x.OperationKey == operation).Select(x => x.FileUrl).ToListAsync(ct);
        foreach (var url in urls.Select(DeletionDataCleaner.CanonicalUrl).Where(x => x.StartsWith("/uploads/", StringComparison.Ordinal)).Distinct().Except(existing))
            dbContext.Set<DeletionFileTask>().Add(new DeletionFileTask { TenantId = tenantId, OperationKey = operation, FileUrl = url });
    }

    private async Task<int> CompleteFilesAsync(string operation, CancellationToken ct)
    {
        var tasks = await dbContext.Set<DeletionFileTask>().IgnoreQueryFilters().Where(x => x.OperationKey == operation).ToListAsync(ct);
        if (tasks.Count == 0) return 0;
        if (fileStorage is null) throw new InvalidOperationException("File storage is required to complete deletion.");
        // A shared upload is preserved while another record still owns it.
        var referenced = await DeletionDataCleaner.ReferencedFilesAsync(dbContext, ct);
        var removed = 0;
        foreach (var task in tasks)
        {
            if (!referenced.Contains(task.FileUrl))
            {
                if (!await fileStorage.DeleteAsync(task.FileUrl, ct)) throw new IOException("Upload cleanup was not confirmed.");
                removed++;
            }
            dbContext.Set<DeletionFileTask>().Remove(task);
            await dbContext.SaveChangesAsync(ct);
        }
        return removed;
    }

    /// <summary>
    /// Retain listesi dışındaki TÜM tenant-scoped tabloları FK-güvenli sırada (bağımlı→asıl)
    /// fiziksel olarak siler. Sağlayıcı-bağımsız parametreli DELETE; EF modelinden tablo/kolon
    /// ve FK grafiği okunur. Silinen toplam satır sayısını döner.
    /// </summary>
    private async Task<int> PurgeTenantOperationalTablesAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var model = dbContext.Model;
        var targets = model.GetEntityTypes()
            .Where(e => typeof(ITenantScopedEntity).IsAssignableFrom(e.ClrType)
                && !InstitutionRetainTypes.Contains(e.ClrType)
                && e.GetTableName() is not null)
            .DistinctBy(e => e.GetTableName())
            .ToList();

        var ordered = OrderForDeletion(targets);
        var total = 0;
        foreach (var entityType in ordered)
        {
            var table = entityType.GetTableName()!;
            var tenantColumn = entityType.FindProperty(nameof(ITenantScopedEntity.TenantId))
                ?.GetColumnName() ?? "tenant_id";
            // Tablo/kolon adları EF modelinden gelir (kullanıcı girdisi değil) — enjeksiyon yok.
            var sql = $"DELETE FROM \"{table}\" WHERE \"{tenantColumn}\" = {{0}}";
            total += await dbContext.Database.ExecuteSqlRawAsync(sql, [tenantId], cancellationToken);
        }
        return total;
    }

    /// <summary>Kahn topolojik sıralaması: bağımlı tablolar (FK sahibi) asıllardan ÖNCE silinir.</summary>
    private static List<IEntityType> OrderForDeletion(List<IEntityType> types)
    {
        var byType = types.ToHashSet();
        var edges = types.ToDictionary(t => t, _ => new HashSet<IEntityType>());
        var incoming = types.ToDictionary(t => t, _ => 0);

        foreach (var dependent in types)
        {
            foreach (var fk in dependent.GetForeignKeys())
            {
                var principal = fk.PrincipalEntityType;
                if (principal != dependent && byType.Contains(principal) && edges[dependent].Add(principal))
                {
                    incoming[principal]++;
                }
            }
        }

        var queue = new Queue<IEntityType>(incoming.Where(kv => kv.Value == 0).Select(kv => kv.Key));
        var ordered = new List<IEntityType>(types.Count);
        while (queue.TryDequeue(out var current))
        {
            ordered.Add(current);
            foreach (var principal in edges[current])
            {
                if (--incoming[principal] == 0) queue.Enqueue(principal);
            }
        }
        // Döngü (self-referencing/karmaşık FK) kalanları sona ekle — yine de silinir.
        foreach (var t in types.Where(t => !ordered.Contains(t))) ordered.Add(t);
        return ordered;
    }

    /// <summary>Mesaj ekleri JSON'ından fiziksel dosya URL'lerini çıkarır (bozuk JSON atlanır).</summary>
    private static IEnumerable<string> ExtractAttachmentUrls(IEnumerable<string> attachmentJsons)
    {
        foreach (var json in attachmentJsons)
        {
            if (string.IsNullOrWhiteSpace(json) || json == "[]") continue;
            List<MessageAttachmentDto>? list;
            try { list = JsonSerializer.Deserialize<List<MessageAttachmentDto>>(json); }
            catch (JsonException) { continue; }
            if (list is null) continue;
            foreach (var attachment in list)
            {
                if (!string.IsNullOrWhiteSpace(attachment.FileUrl)) yield return attachment.FileUrl;
            }
        }
    }

    private async Task PurgeUserPersonalDataAsync(Guid userId, CancellationToken cancellationToken)
    {
        await dbContext.Set<AdminMfaChallenge>().Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await dbContext.Set<UserScopeGrant>().Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await dbContext.Set<PasswordResetRequest>().Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await dbContext.Set<LegalConsentRecord>().Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await dbContext.RefreshTokenSessions.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await dbContext.AuthorizationCodes.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await dbContext.PushDeviceRegistrations.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await dbContext.LoginAttempts.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await dbContext.Notifications.Where(x => x.TargetUserId == userId).ExecuteDeleteAsync(cancellationToken);

        // Uygulama tercihleri PlatformConfigurations'ta ScopeKey = userId("N") ile saklanır.
        var scopeKey = userId.ToString("N");
        await dbContext.PlatformConfigurations.Where(x => x.ScopeKey == scopeKey).ExecuteDeleteAsync(cancellationToken);

        // Mesajlar: FK ihlali olmaması için önce katıldığı sohbetlerin TÜM mesajları, sonra sohbetler.
        var threadIds = await dbContext.MessageThreads
            .Where(x => x.ParticipantOneUserId == userId || x.ParticipantTwoUserId == userId)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);
        await dbContext.MessageItems
            .Where(x => x.SenderUserId == userId || threadIds.Contains(x.ThreadId))
            .ExecuteDeleteAsync(cancellationToken);
        await dbContext.MessageThreads.Where(x => threadIds.Contains(x.Id)).ExecuteDeleteAsync(cancellationToken);

        // Denetim kayıtlarında silinen kişisel veri KALMAMALI: aktörün adı/IP/UA ve
        // kullanıcı üzerindeki işlemlerin before/after JSON'ları (TC, telefon vb.) temizlenir.
        var userIdText = userId.ToString();
        await dbContext.AuditLogEntries
            .IgnoreQueryFilters()
            .Where(x => x.ActorUserId == userId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.ActorName, Tombstone)
                .SetProperty(p => p.IpAddress, (string?)null)
                .SetProperty(p => p.UserAgent, (string?)null), cancellationToken);
        await dbContext.AuditLogEntries
            .IgnoreQueryFilters()
            .Where(x => x.EntityId == userIdText)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.BeforeValue, (string?)null)
                .SetProperty(p => p.AfterValue, (string?)null), cancellationToken);
    }
}
