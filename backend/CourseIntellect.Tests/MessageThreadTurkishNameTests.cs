using CourseIntellect.Application.DTOs.Messages;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

/// <summary>
/// Gerçek PostgreSQL'de thread oluşturma: Türkçe "İ" içeren adlar eşleşmeli.
/// Eski kod .NET ToLower ile SQL LOWER'ı karşılaştırıyordu ("İ" farklı küçülür) →
/// "Kişi bulunamadı" (500). Fix: her iki taraf PG ILIKE. SQLite ILIKE'ı çeviremez,
/// bu yüzden test PostgreSQL'e özgü. COURSE_INTELLECT_POSTGRES_TEST yoksa atlanır.
/// </summary>
public sealed class MessageThreadTurkishNameTests
{
    private static string Conn => Environment.GetEnvironmentVariable("COURSE_INTELLECT_POSTGRES_TEST")!;

    private static CourseIntellectDbContext NewContext()
        => new(new DbContextOptionsBuilder<CourseIntellectDbContext>().UseNpgsql(Conn).Options);

    [PostgreSqlFact("COURSE_INTELLECT_POSTGRES_TEST")]
    public async Task CreateThread_MatchesContact_WithTurkishDottedI()
    {
        var tenant = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var veliId = Guid.NewGuid();
        var teacherId = Guid.NewGuid();
        // Formatlayıcının ürettiği gibi SOYAD büyük + Türkçe İ: "Demo VELİ".
        const string veliName = "Demo VELİ";
        // Diakritikli ad (Ö, Ğ): mobil bunu "Demo OGRETMEN"e katlayıp gönderir.
        const string teacherName = "Demo ÖĞRETMEN";

        await using (var db = NewContext())
        {
            db.Set<TenantWorkspace>().Add(new TenantWorkspace { Id = tenant, Name = "T", Slug = $"t-{Guid.NewGuid():N}"[..18], ContactEmail = "t@e.co", Plan = "free", Status = "active" });
            db.Users.Add(new AppUser { Id = adminId, TenantId = tenant, FullName = "Demo YÖNETİCİ", Username = $"a-{Guid.NewGuid():N}"[..16], PasswordHash = "h", PrimaryRole = UserRole.Admin, Status = UserStatus.Active });
            db.Users.Add(new AppUser { Id = veliId, TenantId = tenant, FullName = veliName, Username = $"v-{Guid.NewGuid():N}"[..16], PasswordHash = "h", PrimaryRole = UserRole.Parent, Status = UserStatus.Active });
            db.Users.Add(new AppUser { Id = teacherId, TenantId = tenant, FullName = teacherName, Username = $"o-{Guid.NewGuid():N}"[..16], PasswordHash = "h", PrimaryRole = UserRole.Teacher, Status = UserStatus.Active });
            await db.SaveChangesAsync();
        }

        await using (var db = NewContext())
        {
            db.SetTenantOverride(tenant);
            var svc = new MessageService(db, new FakeNotifier(), new FakePush());

            // Bug senaryosu: İ'li adı birebir göndererek thread iste.
            var thread = await svc.CreateOrGetThreadAsync(
                adminId, "Demo YÖNETİCİ", "Admin",
                new CreateThreadRequest(veliName, "Parent", null));

            Assert.NotNull(thread);
            // İkinci kez birebir adla → AYNI thread (yeni oluşturmamalı).
            var again = await svc.CreateOrGetThreadAsync(
                adminId, "Demo YÖNETİCİ", "Admin",
                new CreateThreadRequest(veliName, "Parent", null));
            Assert.Equal(thread.Id, again.Id);

            // Farklı harf büyüklüğüyle (aynı Unicode biçimi) da eşleşmeli → case-insensitive.
            var upper = await svc.CreateOrGetThreadAsync(
                adminId, "Demo YÖNETİCİ", "Admin",
                new CreateThreadRequest("DEMO VELİ", "Parent", null));
            Assert.Equal(thread.Id, upper.Id);

            // GERÇEK İSTEMCİ YOLU (regresyon): mobil, kişi adını ASCII'ye katlayarak
            // gönderir ("Demo VELİ" → "Demo VELI"). Backend aynı normalizasyonla
            // eşleşmeli; eski ILIKE-ham-ad yaklaşımı bunu bulamıyordu.
            var asciiVeli = await svc.CreateOrGetThreadAsync(
                adminId, "Demo YÖNETİCİ", "Admin",
                new CreateThreadRequest("Demo VELI", "Parent", null));
            Assert.Equal(thread.Id, asciiVeli.Id);

            // Diakritikli ad: mobil "Demo ÖĞRETMEN"i "Demo OGRETMEN" olarak gönderir
            // (Ö→O, Ğ→G). ILIKE bunu asla eşleştiremezdi (prod 500'ün gerçek nedeni).
            var asciiTeacher = await svc.CreateOrGetThreadAsync(
                adminId, "Demo YÖNETİCİ", "Admin",
                new CreateThreadRequest("Demo OGRETMEN", "Teacher", null));
            Assert.NotNull(asciiTeacher);
            var asciiTeacherAgain = await svc.CreateOrGetThreadAsync(
                adminId, "Demo YÖNETİCİ", "Admin",
                new CreateThreadRequest("Demo OGRETMEN", "Teacher", null));
            Assert.Equal(asciiTeacher.Id, asciiTeacherAgain.Id);
        }

        // Temizlik
        await using (var db = NewContext())
        {
            await db.Database.ExecuteSqlRawAsync("DELETE FROM message_items WHERE tenant_id = {0}", tenant);
            await db.Database.ExecuteSqlRawAsync("DELETE FROM message_threads WHERE tenant_id = {0}", tenant);
            await db.Database.ExecuteSqlRawAsync("DELETE FROM users WHERE tenant_id = {0}", tenant);
            await db.Database.ExecuteSqlRawAsync("DELETE FROM tenant_workspaces WHERE id = {0}", tenant);
        }
    }

    private sealed class FakeNotifier : IMessageRealtimeNotifier
    {
        public Task NotifyThreadUpdatedAsync(Guid t, IReadOnlyCollection<string> p, MessageThreadDto d, CancellationToken c = default) => Task.CompletedTask;
        public Task NotifyMessageReceivedAsync(Guid t, IReadOnlyCollection<string> p, MessageItemDto m, CancellationToken c = default) => Task.CompletedTask;
        public Task NotifyMessageStatusChangedAsync(Guid t, IReadOnlyCollection<string> p, MessageStatusChangedDto m, CancellationToken c = default) => Task.CompletedTask;
    }

    private sealed class FakePush : IPushNotificationService
    {
        public bool IsConfigured => false;
        public Task SendToUserAsync(Guid u, string t, string b, IReadOnlyDictionary<string, string>? d = null, CancellationToken c = default) => Task.CompletedTask;
        public Task SendToUserByNameAsync(string f, string t, string b, IReadOnlyDictionary<string, string>? d = null, CancellationToken c = default) => Task.CompletedTask;
        public Task SendToRoleAsync(string r, string t, string b, IReadOnlyDictionary<string, string>? d = null, CancellationToken c = default) => Task.CompletedTask;
    }
}
