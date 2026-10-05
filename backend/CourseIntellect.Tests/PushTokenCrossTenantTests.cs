using CourseIntellect.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

/// <summary>
/// Aynı fiziksel cihazın push token'ı farklı kurum/kullanıcı olarak yeniden
/// kaydedilirken tenant sorgu filtresine takılmamalı. Aksi halde mevcut (başka
/// kurumdaki) kayıt görülmez, INSERT denenir ve token'daki GLOBAL unique kısıt
/// (23505) ihlal edilir — canlıda POST /api/push/register bu yüzden patlıyordu.
/// </summary>
public sealed class PushTokenCrossTenantTests
{
    private static readonly Guid TenantA = Guid.Parse("aaaaaaaa-0000-4000-8000-000000000001");
    private static readonly Guid TenantB = Guid.Parse("bbbbbbbb-0000-4000-8000-000000000002");

    [Fact]
    public void FilteredLookup_MissesCrossTenantToken_ButIgnoreFiltersFindsIt()
    {
        using var db = new TestDb();
        const string token = "device-token-123";

        var userA = Guid.NewGuid();
        foreach (var (id, slug, uid) in new[] { (TenantA, "a", userA), (TenantB, "b", Guid.NewGuid()) })
        {
            db.Context.Set<TenantWorkspace>().Add(new TenantWorkspace
            {
                Id = id, Name = $"Kurum {slug}", Slug = slug, ContactEmail = $"{slug}@e.co", Plan = "free", Status = "active",
            });
            db.Context.Users.Add(new AppUser
            {
                Id = uid, TenantId = id, FullName = $"User {slug}", Username = $"user-{slug}", PasswordHash = "h",
                PrimaryRole = CourseIntellect.Domain.Enums.UserRole.Teacher,
            });
        }
        db.Context.SaveChanges();
        db.Context.ChangeTracker.Clear();

        // Cihaz önce A kurumunda kayıtlı.
        db.Context.SetTenantOverride(TenantA);
        db.Context.PushDeviceRegistrations.Add(new PushDeviceRegistration
        {
            TenantId = TenantA, UserId = userA, Token = token, Platform = "ios",
        });
        db.Context.SaveChanges();

        // Aynı cihaz şimdi B kurumunda giriş yapıyor (Register bağlamı).
        db.Context.SetTenantOverride(TenantB);
        db.Context.ChangeTracker.Clear();

        // Filtreli arama A'daki kaydı GÖREMEZ (eski hatalı davranış → INSERT → 23505).
        var filtered = db.Context.PushDeviceRegistrations
            .FirstOrDefault(x => x.Token == token);
        Assert.Null(filtered);

        // Düzeltme: IgnoreQueryFilters mevcut kaydı bulur → güncellenir (upsert), hata yok.
        var found = db.Context.PushDeviceRegistrations
            .IgnoreQueryFilters()
            .FirstOrDefault(x => x.Token == token);
        Assert.NotNull(found);

        // Yeniden atama: kayıt B kurumuna/kullanıcısına güncellenebilmeli.
        found!.TenantId = TenantB;
        db.Context.SaveChanges();
        db.Context.ChangeTracker.Clear();
        db.Context.SetTenantOverride(null);
        Assert.Equal(1, db.Context.PushDeviceRegistrations.IgnoreQueryFilters().Count(x => x.Token == token));
    }
}
