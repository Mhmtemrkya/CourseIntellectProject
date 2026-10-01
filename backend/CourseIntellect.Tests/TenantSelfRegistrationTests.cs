using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using CourseIntellect.Api.Controllers;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.DTOs.PlatformOperations;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

namespace CourseIntellect.Tests;

/// <summary>
/// Pazarlama sitesinden gelen ANONİM kurum kaydı. Bu uç kimliksiz yazma yaptığı
/// için kapıların hepsi burada kilitlenir: doğrulama, captcha, tekilleştirme,
/// slug işgali ve KPI zehirlenmesi.
/// </summary>
public sealed class TenantSelfRegistrationTests : IDisposable
{
    private readonly TestDb db = new();

    private sealed class StubHasher : IPasswordHasher
    {
        public string Hash(string password) => $"hashed:{password}";
        public bool Verify(string password, string hash) => hash == $"hashed:{password}";
    }

    private sealed class StubCaptcha(CaptchaVerificationStatus status) : ICaptchaVerificationService
    {
        public Task<CaptchaVerificationResult> VerifyAsync(string? token, string? remoteIp, CancellationToken cancellationToken = default)
            => Task.FromResult(new CaptchaVerificationResult(status, "stub"));
    }

    private sealed class StubAudit : IAuditLogService
    {
        public Task LogAsync(Guid? actorUserId, string actorName, string action, string category, string entityType, string entityId, string detail, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task LogAsync(string action, string category, string entityType, string entityId, string detail, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task LogChangeAsync(string action, string category, string entityType, string entityId, string detail, object? before, object? after, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        // Okuma tarafı bu testlerde kullanılmıyor.
        public Task<IReadOnlyList<AuditLogDto>> GetAsync(string? category, int limit, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<AuditLogPageDto> GetPagedAsync(AuditLogQuery query, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<IReadOnlyList<AuditBranchSummaryDto>> GetBranchSummaryAsync(CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
    }

    private sealed class StubEmailSender(bool isConfigured, bool sendSucceeds = true) : IEmailSender
    {
        public List<(string To, string Subject, string Body)> Sent { get; } = [];

        public bool IsConfigured { get; } = isConfigured;

        public Task<bool> SendAsync(string toAddress, string subject, string htmlBody, CancellationToken cancellationToken = default)
        {
            if (sendSucceeds) Sent.Add((toAddress, subject, htmlBody));
            return Task.FromResult(sendSucceeds);
        }

        /// <summary>Gönderilen bağlantıdan doğrulama kodunu çıkarır.</summary>
        public string ExtractToken()
        {
            var match = Regex.Match(Sent[^1].Body, @"token=([A-Za-z0-9\-_%]+)");
            return Uri.UnescapeDataString(match.Groups[1].Value);
        }
    }

    private sealed class StubEnvironment(string environmentName) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = environmentName;
        public string ApplicationName { get; set; } = "Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
    }

    private PlatformOperationsService CreateService(
        CaptchaVerificationStatus captcha = CaptchaVerificationStatus.Success,
        Dictionary<string, string?>? settings = null,
        IEmailSender? email = null,
        string environmentName = "Development",
        ITenantSetupDocumentService? setupDocument = null,
        IOnboardingEmailDelivery? delivery = null)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(settings ?? [])
            .Build();

        return new PlatformOperationsService(
            db.Context,
            new StubHasher(),
            new StubCaptcha(captcha),
            setupDocument ?? new TenantSetupDocumentPdfService(),
            new StubAudit(),
            email ?? new StubEmailSender(isConfigured: false),
            new StubEnvironment(environmentName),
            configuration,
            NullLogger<PlatformOperationsService>.Instance, delivery);
    }

    [Fact]
    public async Task Verified_application_sends_receipt_once_then_approval_credentials_via_outbox()
    {
        var email = new StubEmailSender(true);
        var protection = new Microsoft.AspNetCore.DataProtection.EphemeralDataProtectionProvider();
        var delivery = new OnboardingEmailDelivery(db.Context, email, protection, NullLogger<OnboardingEmailDelivery>.Instance);
        var service = CreateService(email: email, delivery: delivery, environmentName: "Production", settings: ProductionRegistrationEnabled());
        await service.RegisterTenantAsync(ValidRequest(), Context);
        var application = await db.Context.TenantRegistrationApplications.SingleAsync();
        var token = email.ExtractToken();
        Assert.Contains("#token=", Assert.Single(email.Sent).Body);
        Assert.Null(await service.ApproveTenantAsync(application.Id));
        Assert.Empty(await db.Context.TenantWorkspaces.ToListAsync());
        Assert.True(await service.VerifyRegistrationContactAsync(token));
        Assert.True(await service.VerifyRegistrationContactAsync(token));
        Assert.Single(email.Sent.Where(x => x.Subject.Contains("başarıyla alınmıştır")));
        var approved = await service.ApproveTenantAsync(application.Id);
        Assert.NotNull(approved);
        Assert.NotNull(approved!.ApprovalEmailSentAtUtc);
        var mail = Assert.Single(email.Sent.Where(x => x.Subject.Contains("onaylandı")));
        Assert.Contains(approved.CustomerNumber!, mail.Body);
        Assert.Contains(approved.TemporaryPassword!, mail.Body);
        Assert.All(await db.Context.Set<OnboardingEmail>().AsNoTracking().ToListAsync(), x =>
        {
            Assert.True(x.Delivered);
            Assert.Empty(x.ProtectedPayload);
        });
    }

    [Fact]
    public async Task Outbox_retains_encrypted_verification_on_transport_failure_and_retries()
    {
        var protection = new Microsoft.AspNetCore.DataProtection.EphemeralDataProtectionProvider();
        var failed = new StubEmailSender(true, false);
        var delivery = new OnboardingEmailDelivery(db.Context, failed, protection, NullLogger<OnboardingEmailDelivery>.Instance);
        await CreateService(email: failed, delivery: delivery).RegisterTenantAsync(ValidRequest(), Context);
        var queued = await db.Context.Set<OnboardingEmail>().AsNoTracking().SingleAsync();
        Assert.Null(queued.CompletedAtUtc);
        Assert.Equal(1, queued.Attempts);
        Assert.DoesNotContain("abckoleji", queued.ProtectedPayload);
        Assert.DoesNotContain("token=", queued.ProtectedPayload);
        Assert.NotNull((await db.Context.TenantRegistrationApplications.SingleAsync()).VerificationTokenHash);
        await db.Context.Set<OnboardingEmail>().ExecuteUpdateAsync(s => s.SetProperty(x => x.NextAttemptAtUtc, DateTime.UtcNow.AddMinutes(-1)));
        var successful = new StubEmailSender(true);
        await new OnboardingEmailDelivery(db.Context, successful, protection, NullLogger<OnboardingEmailDelivery>.Instance).DispatchAsync();
        Assert.Single(successful.Sent);
        queued = await db.Context.Set<OnboardingEmail>().AsNoTracking().SingleAsync();
        Assert.True(queued.Delivered);
        Assert.Empty(queued.ProtectedPayload);
    }

    [Fact]
    public async Task Outbox_discards_expired_or_rotated_verification_without_sending()
    {
        var email = new StubEmailSender(true);
        var delivery = new OnboardingEmailDelivery(db.Context, email,
            new Microsoft.AspNetCore.DataProtection.EphemeralDataProtectionProvider(), NullLogger<OnboardingEmailDelivery>.Instance);
        delivery.Queue("stale-test", "verification", Guid.NewGuid(), "old-hash", DateTime.UtcNow.AddHours(1),
            "test@example.com", "stale", "secret token");
        delivery.Queue("expired-test", "verification", Guid.NewGuid(), "old-hash", DateTime.UtcNow.AddHours(-1),
            "test@example.com", "expired", "secret token");
        await db.Context.SaveChangesAsync();
        await delivery.DispatchAsync();
        Assert.Empty(email.Sent);
        Assert.All(await db.Context.Set<OnboardingEmail>().AsNoTracking().ToListAsync(), x =>
        { Assert.NotNull(x.CompletedAtUtc); Assert.False(x.Delivered); Assert.Empty(x.ProtectedPayload); });
    }

    private static RegisterTenantRequest ValidRequest(string email = "info@abckoleji.com") => new(
        InstitutionName: "ABC Koleji",
        ContactName: "Ahmet Yilmaz",
        Email: email,
        Phone: "0532 111 22 33",
        Plan: "Starter",
        EstimatedStudents: 250,
        InstitutionType: "PrivateSchool",
        CaptchaToken: "token",
        KvkkAccepted: true);

    private static readonly TenantRegistrationContext Context =
        new("203.0.113.7", "Mozilla/5.0", "https://schoolasist.com/kurum-kaydi");

    private static Dictionary<string, string?> ProductionRegistrationEnabled() => new()
    {
        ["Registration:Enabled"] = "true",
    };

    [Fact]
    public async Task Kvkk_onayi_yoksa_kayit_yazilmaz()
    {
        var service = CreateService();

        var result = await service.RegisterTenantAsync(ValidRequest() with { KvkkAccepted = false }, Context);

        Assert.Equal(TenantRegistrationOutcome.Invalid, result.Outcome);
        Assert.Empty(await db.Context.TenantRegistrationApplications.ToListAsync());
        Assert.Empty(await db.Context.TenantWorkspaces.ToListAsync());
    }

    [Theory]
    [InlineData("Ucretsiz")]      // beyaz listede olmayan plan
    [InlineData("")]
    public async Task Ucretli_modda_plan_beyaz_liste_disindaysa_reddedilir(string plan)
    {
        var service = CreateService(settings: new() { ["Billing:Enabled"] = "true" });

        var result = await service.RegisterTenantAsync(ValidRequest() with { Plan = plan }, Context);

        Assert.Equal(TenantRegistrationOutcome.Invalid, result.Outcome);
        Assert.Empty(await db.Context.TenantRegistrationApplications.ToListAsync());
        Assert.Empty(await db.Context.TenantWorkspaces.ToListAsync());
    }

    [Theory]
    [InlineData("Enterprise")]   // eski istemci plan gönderse bile
    [InlineData(null)]           // yeni form plan göndermez
    public async Task Ucretsiz_donemde_plan_alinmaz_kurum_paketsiz_acilir(string? plan)
    {
        var service = CreateService();

        var result = await service.RegisterTenantAsync(ValidRequest() with { Plan = plan }, Context);

        Assert.Equal(TenantRegistrationOutcome.Accepted, result.Outcome);
        var application = await db.Context.TenantRegistrationApplications.SingleAsync();
        // Boş plan EntitlementService'te paket kısıtı olmadan (tüm modüller açık) çözülür.
        Assert.Equal(string.Empty, application.Plan);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(500_000)]
    public async Task Ogrenci_sayisi_aralik_disindaysa_reddedilir(int students)
    {
        var service = CreateService();

        var result = await service.RegisterTenantAsync(ValidRequest() with { EstimatedStudents = students }, Context);

        Assert.Equal(TenantRegistrationOutcome.Invalid, result.Outcome);
        Assert.Empty(await db.Context.TenantRegistrationApplications.ToListAsync());
        Assert.Empty(await db.Context.TenantWorkspaces.ToListAsync());
    }

    [Fact]
    public async Task Gecersiz_kurum_turu_500_degil_dogrulama_hatasi_dondurur()
    {
        var service = CreateService();

        var result = await service.RegisterTenantAsync(ValidRequest() with { InstitutionType = "Hastane" }, Context);

        Assert.Equal(TenantRegistrationOutcome.Invalid, result.Outcome);
    }

    [Fact]
    public async Task Surucu_kursu_basvurusu_bu_urunde_alinmaz()
    {
        var service = CreateService();

        var result = await service.RegisterTenantAsync(ValidRequest() with { InstitutionType = "DrivingSchool" }, Context);

        Assert.Equal(TenantRegistrationOutcome.Invalid, result.Outcome);
        Assert.Empty(await db.Context.TenantRegistrationApplications.ToListAsync());
    }

    [Fact]
    public async Task Captcha_dogrulanmazsa_kayit_yazilmaz()
    {
        var service = CreateService(CaptchaVerificationStatus.Failed);

        var result = await service.RegisterTenantAsync(ValidRequest(), Context);

        Assert.Equal(TenantRegistrationOutcome.CaptchaFailed, result.Outcome);
        Assert.Empty(await db.Context.TenantRegistrationApplications.ToListAsync());
        Assert.Empty(await db.Context.TenantWorkspaces.ToListAsync());
    }

    [Fact]
    public async Task Production_kurum_kaydi_acikca_etkin_degilse_fail_closed_kalir()
    {
        var service = CreateService(environmentName: "Production");

        var result = await service.RegisterTenantAsync(ValidRequest(), Context);

        Assert.Equal(TenantRegistrationOutcome.Disabled, result.Outcome);
        Assert.Empty(await db.Context.TenantRegistrationApplications.ToListAsync());
        Assert.Empty(await db.Context.TenantWorkspaces.ToListAsync());
    }

    [Fact]
    public async Task Production_kurum_kaydi_yalniz_explicit_true_ile_acilir()
    {
        var service = CreateService(
            environmentName: "Production",
            settings: new Dictionary<string, string?>
            {
                ["Registration:Enabled"] = "true",
            });

        var result = await service.RegisterTenantAsync(ValidRequest(), Context);

        Assert.Equal(TenantRegistrationOutcome.Accepted, result.Outcome);
        Assert.Single(await db.Context.TenantRegistrationApplications.ToListAsync());
    }

    [Fact]
    public async Task Anonim_kayit_kurum_tablosuna_hic_dokunmaz()
    {
        var service = CreateService();

        var result = await service.RegisterTenantAsync(ValidRequest(), Context);

        Assert.Equal(TenantRegistrationOutcome.Accepted, result.Outcome);

        // P1'in asıl güvencesi: kimliği doğrulanmamış girdi kurum tablosuna yazılmaz.
        // Slug ad alanı, platform sayaçları ve kurum sorguları başvurudan etkilenmez.
        Assert.Empty(await db.Context.TenantWorkspaces.ToListAsync());

        var application = await db.Context.TenantRegistrationApplications.SingleAsync();
        Assert.Equal("pending", application.Status);
        Assert.Equal("ABC Koleji", application.InstitutionName);
        Assert.Equal("info@abckoleji.com", application.ContactEmailNormalized);
        Assert.Equal(250, application.EstimatedStudents);

        // Triyaj ve KVKK kanıtı.
        Assert.Equal("203.0.113.7", application.RegistrationIp);
        Assert.Equal("Mozilla/5.0", application.RegistrationUserAgent);
        Assert.NotNull(application.KvkkConsentVersion);
        Assert.NotNull(application.KvkkConsentAtUtc);
    }

    [Fact]
    public async Task Ayni_eposta_buyuk_kucuk_harf_farkiyla_bile_ikinci_kez_yazilmaz()
    {
        var service = CreateService();

        var first = await service.RegisterTenantAsync(ValidRequest("info@abckoleji.com"), Context);
        var second = await service.RegisterTenantAsync(ValidRequest("INFO@AbcKoleji.com"), Context);

        Assert.Equal(TenantRegistrationOutcome.Accepted, first.Outcome);
        Assert.Equal(TenantRegistrationOutcome.Duplicate, second.Outcome);
        Assert.Single(await db.Context.TenantRegistrationApplications.ToListAsync());
    }

    [Fact]
    public async Task Gunluk_sert_tavan_asilinca_reddedilir()
    {
        var service = CreateService(settings: new Dictionary<string, string?>
        {
            ["Registration:DailyHardLimit"] = "1",
        });

        await service.RegisterTenantAsync(ValidRequest("bir@abckoleji.com"), Context);
        var second = await service.RegisterTenantAsync(ValidRequest("iki@abckoleji.com"), Context);

        Assert.Equal(TenantRegistrationOutcome.Throttled, second.Outcome);
        Assert.Single(await db.Context.TenantRegistrationApplications.ToListAsync());
    }

    [Fact]
    public async Task Kurum_satiri_onay_aninda_uretilir()
    {
        var service = CreateService();
        await service.RegisterTenantAsync(ValidRequest(), Context);
        var application = await db.Context.TenantRegistrationApplications.SingleAsync();

        var approved = await service.ApproveTenantAsync(application.Id);

        Assert.NotNull(approved);
        var tenant = await db.Context.TenantWorkspaces.SingleAsync();
        Assert.Equal("active", tenant.Status);
        // Okunabilir slug ancak burada doğar; bekleyen başvuru adı kapatamaz.
        Assert.Contains("abc", tenant.Slug, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(application.ContactEmail, tenant.ContactEmail);
        Assert.NotNull(tenant.AdminUserId);
        Assert.False(string.IsNullOrWhiteSpace(approved!.TemporaryPassword));

        // Geçici parolanın ömrü var: süresiz bir parola, kurulum belgesi kaybolduğunda
        // aylarca açık kapı bırakırdı.
        var adminUser = await db.Context.Users.SingleAsync(x => x.Id == tenant.AdminUserId);
        Assert.True(adminUser.MustChangePassword);
        Assert.NotNull(adminUser.TemporaryPasswordExpiresAtUtc);
        Assert.Equal(approved.TemporaryPasswordExpiresAtUtc, adminUser.TemporaryPasswordExpiresAtUtc);

        // Başvuru iz olarak kalır ve üretilen kurumu işaret eder.
        var stored = await db.Context.TenantRegistrationApplications.SingleAsync();
        Assert.Equal("approved", stored.Status);
        Assert.Equal(tenant.Id, stored.CreatedTenantId);
    }

    [Fact]
    public async Task Onaylanan_basvuru_listede_bir_kez_gorunur()
    {
        var service = CreateService();
        await service.RegisterTenantAsync(ValidRequest(), Context);
        var application = await db.Context.TenantRegistrationApplications.SingleAsync();

        application.City = "İstanbul";
        application.District = "Kadıköy";
        application.ContactTitle = "Kurum müdürü";
        application.VerifiedAtUtc = DateTime.UtcNow.AddMinutes(-5);
        application.CreatedAtUtc = DateTime.UtcNow.AddDays(-2);
        await db.Context.SaveChangesAsync();

        var beforeApproval = await service.GetTenantsAsync();
        Assert.Single(beforeApproval);
        Assert.Equal("pending", beforeApproval[0].Status);

        await service.ApproveTenantAsync(application.Id);

        // Onaydan sonra yalnız kurum satırı: başvurunun kopyası listede kalmaz.
        var afterApproval = await service.GetTenantsAsync();
        Assert.Single(afterApproval);
        Assert.Equal("active", afterApproval[0].Status);
        foreach (var row in new[] { beforeApproval[0], afterApproval[0] })
        {
            Assert.Equal("İstanbul", row.City);
            Assert.Equal("Kadıköy", row.District);
            Assert.Equal("Kurum müdürü", row.ContactTitle);
            Assert.Equal(application.VerifiedAtUtc, row.VerifiedAtUtc);
            Assert.Equal(application.CreatedAtUtc, row.RegistrationCreatedAtUtc);
            Assert.Equal(application.EstimatedStudents, row.EstimatedStudents);
            Assert.Null(row.TemporaryPassword);
            Assert.Null(row.SetupDocumentBase64);
        }
    }

    [Fact]
    public async Task Red_gerekcesi_saklanir_ve_kurum_uretilmez()
    {
        var service = CreateService();
        await service.RegisterTenantAsync(ValidRequest(), Context);
        var application = await db.Context.TenantRegistrationApplications.SingleAsync();

        var rejected = await service.RejectTenantAsync(application.Id, "Kurum bilgileri doğrulanamadı.");

        Assert.NotNull(rejected);
        Assert.Empty(await db.Context.TenantWorkspaces.ToListAsync());
        var stored = await db.Context.TenantRegistrationApplications.SingleAsync();
        Assert.Equal("rejected", stored.Status);
        Assert.Equal("Kurum bilgileri doğrulanamadı.", stored.RejectionReason);
        Assert.NotNull(stored.RejectedAtUtc);
    }

    [Fact]
    public async Task Basvuru_silinebilir()
    {
        var service = CreateService();
        await service.RegisterTenantAsync(ValidRequest(), Context);
        var application = await db.Context.TenantRegistrationApplications.SingleAsync();

        var deleted = await service.DeleteTenantAsync(application.Id);

        Assert.True(deleted);
        Assert.Empty(await db.Context.TenantRegistrationApplications.ToListAsync());
    }

    [Fact]
    public async Task Uretimde_captcha_yapilandirilmamissa_fail_closed()
    {
        var service = new CaptchaVerificationService(
            new HttpClient(),
            new ConfigurationBuilder().AddInMemoryCollection([]).Build(),
            new StubEnvironment("Production"),
            NullLogger<CaptchaVerificationService>.Instance);

        var result = await service.VerifyAsync("token", "203.0.113.7");

        // Anahtar unutulduğunda koruma sessizce kalkmaz; kayıt gürültülü şekilde durur.
        Assert.Equal(CaptchaVerificationStatus.Failed, result.Status);
        Assert.False(result.IsAllowed);
    }

    [Fact]
    public async Task Uretim_disinda_captcha_yapilandirilmamissa_atlanir()
    {
        var service = new CaptchaVerificationService(
            new HttpClient(),
            new ConfigurationBuilder().AddInMemoryCollection([]).Build(),
            new StubEnvironment("Development"),
            NullLogger<CaptchaVerificationService>.Instance);

        var result = await service.VerifyAsync(null, null);

        Assert.Equal(CaptchaVerificationStatus.SkippedNotConfigured, result.Status);
        Assert.True(result.IsAllowed);
    }

    [Fact]
    public async Task Bekleyen_basvuruda_eposta_benzersizligi_veritabani_seviyesinde()
    {
        // Servisteki cooldown kontrolünü ATLAYIP doğrudan yazıyoruz: yarış durumunda
        // asıl kısıt filtreli benzersiz indeks. Bu test o indeksin gerçekten var
        // olduğunu doğrular; yoksa DbUpdateException dalı hiç çalışmadan "geçer".
        static TenantRegistrationApplication Row() => new()
        {
            InstitutionName = "ABC Koleji",
            ContactName = "Ahmet Yilmaz",
            ContactEmail = "info@abckoleji.com",
            ContactEmailNormalized = "info@abckoleji.com",
            Plan = "Starter",
            Status = "pending",
            EstimatedStudents = 100,
        };

        db.Context.TenantRegistrationApplications.Add(Row());
        await db.Context.SaveChangesAsync();

        db.Context.TenantRegistrationApplications.Add(Row());
        await Assert.ThrowsAnyAsync<DbUpdateException>(() => db.Context.SaveChangesAsync());
    }

    [Fact]
    public async Task Reddedilen_basvurular_benzersizlik_kisitina_takilmaz()
    {
        // Filtre yalnız "pending" satırlarda: aynı kurum reddedildikten sonra
        // yeniden başvurabilmeli.
        static TenantRegistrationApplication Row(string status) => new()
        {
            InstitutionName = "ABC Koleji",
            ContactName = "Ahmet Yilmaz",
            ContactEmail = "info@abckoleji.com",
            ContactEmailNormalized = "info@abckoleji.com",
            Plan = "Starter",
            Status = status,
            EstimatedStudents = 100,
        };

        db.Context.TenantRegistrationApplications.AddRange(Row("rejected"), Row("rejected"), Row("pending"));
        await db.Context.SaveChangesAsync();

        Assert.Equal(3, await db.Context.TenantRegistrationApplications.CountAsync());
    }

    // --- Kurulum belgesi ---

    [Fact]
    public async Task Onayda_kurulum_belgesi_uretilir()
    {
        var service = CreateService();
        await service.RegisterTenantAsync(ValidRequest(), Context);
        var application = await db.Context.TenantRegistrationApplications.SingleAsync();

        var approved = await service.ApproveTenantAsync(application.Id);

        Assert.NotNull(approved!.SetupDocumentBase64);
        Assert.EndsWith(".pdf", approved.SetupDocumentFileName);
        // Gerçek PDF mi: %PDF imzası.
        var bytes = Convert.FromBase64String(approved.SetupDocumentBase64!);
        Assert.Equal("%PDF"u8.ToArray(), bytes[..4]);
    }

    [Fact]
    public async Task Pdf_failure_does_not_commit_approval_or_credentials()
    {
        var service = CreateService(setupDocument: new ThrowingSetupDocument());
        await service.RegisterTenantAsync(ValidRequest(), Context);
        var application = await db.Context.TenantRegistrationApplications.SingleAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.ApproveTenantAsync(application.Id));

        db.Context.ChangeTracker.Clear();
        Assert.Empty(await db.Context.TenantWorkspaces.ToListAsync());
        Assert.Empty(await db.Context.Users.ToListAsync());
        Assert.Equal("pending", (await db.Context.TenantRegistrationApplications.SingleAsync()).Status);
    }

    [Fact]
    public async Task Approval_response_loss_can_be_retried_to_deliver_fresh_credentials_without_duplicate_tenant()
    {
        var service = CreateService();
        await service.RegisterTenantAsync(ValidRequest(), Context);
        var application = await db.Context.TenantRegistrationApplications.SingleAsync();
        var first = await service.ApproveTenantAsync(application.Id);

        var recovered = await service.ApproveTenantAsync(application.Id);

        Assert.NotNull(recovered?.SetupDocumentBase64);
        Assert.NotEqual(first!.TemporaryPassword, recovered!.TemporaryPassword);
        Assert.Single(await db.Context.TenantWorkspaces.ToListAsync());
        Assert.Single(await db.Context.Users.ToListAsync());
    }

    [Fact]
    public async Task Belge_yenilenince_eski_parola_gecersiz_olur()
    {
        var service = CreateService();
        await service.RegisterTenantAsync(ValidRequest(), Context);
        var application = await db.Context.TenantRegistrationApplications.SingleAsync();
        var approved = await service.ApproveTenantAsync(application.Id);
        var tenant = await db.Context.TenantWorkspaces.SingleAsync();
        var firstHash = (await db.Context.Users.SingleAsync(x => x.Id == tenant.AdminUserId)).PasswordHash;

        var result = await service.RegenerateSetupDocumentAsync(tenant.Id);

        Assert.Equal(SetupDocumentOutcome.Ready, result.Outcome);
        Assert.NotEqual(approved!.TemporaryPassword, result.Tenant!.TemporaryPassword);
        Assert.NotNull(result.Tenant.SetupDocumentBase64);

        var adminUser = await db.Context.Users.SingleAsync(x => x.Id == tenant.AdminUserId);
        Assert.NotEqual(firstHash, adminUser.PasswordHash);
        Assert.True(adminUser.MustChangePassword);
        Assert.NotNull(adminUser.TemporaryPasswordExpiresAtUtc);
    }

    [Fact]
    public async Task Kendi_parolasini_belirlemis_kurumda_belge_yenilenmez()
    {
        var service = CreateService();
        await service.RegisterTenantAsync(ValidRequest(), Context);
        var application = await db.Context.TenantRegistrationApplications.SingleAsync();
        await service.ApproveTenantAsync(application.Id);
        var tenant = await db.Context.TenantWorkspaces.SingleAsync();

        // Kurum kendi parolasını belirledi.
        var adminUser = await db.Context.Users.SingleAsync(x => x.Id == tenant.AdminUserId);
        adminUser.MustChangePassword = false;
        adminUser.TemporaryPasswordExpiresAtUtc = null;
        await db.Context.SaveChangesAsync();

        var result = await service.RegenerateSetupDocumentAsync(tenant.Id);

        // Yenilemek, kurumun parolasını habersiz sıfırlamak olurdu.
        Assert.Equal(SetupDocumentOutcome.AlreadyActivated, result.Outcome);
        var unchanged = await db.Context.Users.SingleAsync(x => x.Id == tenant.AdminUserId);
        Assert.False(unchanged.MustChangePassword);
    }

    // --- İletişim adresi doğrulaması ---

    [Fact]
    public async Task Smtp_yokken_uretimde_basvuru_dogrulanmis_sayilmaz_ama_kuyrukta_kalir()
    {
        var service = CreateService(
            email: new StubEmailSender(isConfigured: false),
            environmentName: "Production",
            settings: ProductionRegistrationEnabled());

        await service.RegisterTenantAsync(ValidRequest(), Context);

        var application = await db.Context.TenantRegistrationApplications.SingleAsync();
        Assert.Null(application.VerifiedAtUtc);
        Assert.Equal("unproven", application.VerificationState);

        // Gönderilemeyen doğrulama gerçek kurumu görünmez yapmamalı.
        var queue = await service.GetTenantsAsync();
        Assert.Single(queue);
        Assert.Equal("unproven", queue[0].VerificationState);
    }

    [Fact]
    public async Task Dogrulama_bekleyen_basvuru_kuyrukta_gorunmez_dogrulaninca_girer()
    {
        var email = new StubEmailSender(isConfigured: true);
        var service = CreateService(email: email, environmentName: "Production", settings: ProductionRegistrationEnabled());

        await service.RegisterTenantAsync(ValidRequest(), Context);

        var application = await db.Context.TenantRegistrationApplications.SingleAsync();
        Assert.Equal("awaiting", application.VerificationState);
        Assert.Single(email.Sent);
        Assert.Equal("info@abckoleji.com", email.Sent[0].To);

        // Onay kuyruğunun spam ile dolmasını asıl engelleyen davranış.
        Assert.Equal("awaiting", Assert.Single(await service.GetTenantsAsync()).VerificationState);

        Assert.True(await service.VerifyRegistrationContactAsync(email.ExtractToken()));

        var queue = await service.GetTenantsAsync();
        Assert.Single(queue);
        Assert.Equal("verified", queue[0].VerificationState);
    }

    [Fact]
    public async Task Ayni_baglantiya_ikinci_tiklama_hata_vermez()
    {
        var email = new StubEmailSender(isConfigured: true);
        var service = CreateService(email: email, environmentName: "Production", settings: ProductionRegistrationEnabled());
        await service.RegisterTenantAsync(ValidRequest(), Context);
        var token = email.ExtractToken();

        Assert.True(await service.VerifyRegistrationContactAsync(token));
        Assert.True(await service.VerifyRegistrationContactAsync(token));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("uydurma-token")]
    public async Task Gecersiz_kodlar_ayni_sonucu_verir(string? token)
    {
        var service = CreateService(
            email: new StubEmailSender(isConfigured: true),
            environmentName: "Production",
            settings: ProductionRegistrationEnabled());
        await service.RegisterTenantAsync(ValidRequest(), Context);

        Assert.False(await service.VerifyRegistrationContactAsync(token));
    }

    [Fact]
    public async Task Suresi_dolmus_kod_kabul_edilmez()
    {
        var email = new StubEmailSender(isConfigured: true);
        var service = CreateService(email: email, environmentName: "Production", settings: ProductionRegistrationEnabled());
        await service.RegisterTenantAsync(ValidRequest(), Context);
        var token = email.ExtractToken();

        var application = await db.Context.TenantRegistrationApplications.SingleAsync();
        application.VerificationExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1);
        await db.Context.SaveChangesAsync();

        Assert.False(await service.VerifyRegistrationContactAsync(token));
    }

    [Fact]
    public async Task Expired_verification_can_be_resent_by_reapplying_without_duplicate_record()
    {
        var email = new StubEmailSender(isConfigured: true);
        var service = CreateService(email: email, environmentName: "Production", settings: ProductionRegistrationEnabled());
        await service.RegisterTenantAsync(ValidRequest(), Context);
        var oldToken = email.ExtractToken();
        var application = await db.Context.TenantRegistrationApplications.SingleAsync();
        application.VerificationExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1);
        await db.Context.SaveChangesAsync();

        var reapplied = await service.RegisterTenantAsync(ValidRequest(), Context);
        var newToken = email.ExtractToken();

        Assert.Equal(TenantRegistrationOutcome.Duplicate, reapplied.Outcome);
        Assert.Equal(2, email.Sent.Count);
        Assert.NotEqual(oldToken, newToken);
        Assert.Single(await db.Context.TenantRegistrationApplications.ToListAsync());
        var rotated = await db.Context.TenantRegistrationApplications.AsNoTracking().SingleAsync();
        var expectedHash = Convert.ToBase64String(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(newToken)));
        Assert.Equal(expectedHash, rotated.VerificationTokenHash);
        Assert.True(rotated.VerificationExpiresAtUtc > DateTime.UtcNow);
        Assert.False(await service.VerifyRegistrationContactAsync(oldToken));
        Assert.True(await service.VerifyRegistrationContactAsync(newToken));
    }

    [Fact]
    public async Task Eposta_gonderilemezse_basvuru_kanitlanmamis_olarak_kuyrukta_kalir()
    {
        var email = new StubEmailSender(isConfigured: true, sendSucceeds: false);
        var service = CreateService(email: email, environmentName: "Production", settings: ProductionRegistrationEnabled());

        await service.RegisterTenantAsync(ValidRequest(), Context);

        var application = await db.Context.TenantRegistrationApplications.SingleAsync();
        Assert.Equal("unproven", application.VerificationState);
        Assert.Null(application.VerificationTokenHash);
        Assert.Single(await service.GetTenantsAsync());
    }

    // --- Kara liste ve şüpheli işareti ---

    [Fact]
    public async Task Kara_listedeki_alan_adi_sessizce_yutulur()
    {
        var service = CreateService();
        await service.AddRegistrationBlocklistEntryAsync(
            new AddRegistrationBlocklistRequest("domain", "abckoleji.com", "Spam"), null, "Test");

        var result = await service.RegisterTenantAsync(ValidRequest("info@abckoleji.com"), Context);

        Assert.Equal(TenantRegistrationOutcome.Blocked, result.Outcome);
        Assert.Empty(await db.Context.TenantRegistrationApplications.ToListAsync());
    }

    [Fact]
    public async Task Kara_listedeki_ip_sessizce_yutulur()
    {
        var service = CreateService();
        await service.AddRegistrationBlocklistEntryAsync(
            new AddRegistrationBlocklistRequest("ip", "203.0.113.7", null), null, "Test");

        var result = await service.RegisterTenantAsync(ValidRequest(), Context);

        Assert.Equal(TenantRegistrationOutcome.Blocked, result.Outcome);
        Assert.Empty(await db.Context.TenantRegistrationApplications.ToListAsync());
    }

    [Fact]
    public async Task Kara_liste_girisi_alan_adina_indirgenir_ve_tekrarlanmaz()
    {
        var service = CreateService();

        var first = await service.AddRegistrationBlocklistEntryAsync(
            new AddRegistrationBlocklistRequest("domain", "INFO@Ornek.COM", null), null, "Test");
        var second = await service.AddRegistrationBlocklistEntryAsync(
            new AddRegistrationBlocklistRequest("domain", "ornek.com", null), null, "Test");

        Assert.NotNull(first);
        Assert.Equal("ornek.com", first!.Value);
        Assert.Equal(first.Id, second!.Id);
        Assert.Single(await db.Context.RegistrationBlocklistEntries.ToListAsync());
    }

    [Fact]
    public async Task Gecersiz_kara_liste_turu_reddedilir()
    {
        var service = CreateService();

        var result = await service.AddRegistrationBlocklistEntryAsync(
            new AddRegistrationBlocklistRequest("kullanici", "ornek.com", null), null, "Test");

        Assert.Null(result);
        Assert.Empty(await db.Context.RegistrationBlocklistEntries.ToListAsync());
    }

    [Fact]
    public async Task Ayni_ipden_yigin_basvuru_supheli_isaretlenir()
    {
        var service = CreateService(settings: new Dictionary<string, string?>
        {
            ["Registration:SuspiciousIpThreshold"] = "2",
        });

        await service.RegisterTenantAsync(ValidRequest("bir@abckoleji.com"), Context);
        await service.RegisterTenantAsync(ValidRequest("iki@abckoleji.com"), Context);
        await service.RegisterTenantAsync(ValidRequest("uc@abckoleji.com"), Context);

        var applications = await db.Context.TenantRegistrationApplications
            .OrderBy(x => x.CreatedAtUtc)
            .ToListAsync();

        // Eşik 2 → aynı IP'den İKİNCİ başvuru işaretlenir.
        Assert.Equal(3, applications.Count);
        Assert.False(applications[0].IsSuspicious);
        Assert.True(applications[1].IsSuspicious);
        Assert.True(applications[2].IsSuspicious);
        Assert.Contains("IP", applications[2].SuspiciousReason);

        // İşaret kaydı ENGELLEMEZ; başvuru kuyrukta durur.
        Assert.Equal("pending", applications[2].Status);
    }

    [Fact]
    public async Task Supheli_isareti_elle_acilip_kapatilabilir()
    {
        var service = CreateService();
        await service.RegisterTenantAsync(ValidRequest(), Context);
        var application = await db.Context.TenantRegistrationApplications.SingleAsync();

        var marked = await service.SetApplicationSuspiciousAsync(application.Id, true, "Sahte kurum adı.");
        Assert.True(marked!.IsSuspicious);
        Assert.Equal("Sahte kurum adı.", marked.SuspiciousReason);

        var cleared = await service.SetApplicationSuspiciousAsync(application.Id, false);
        Assert.False(cleared!.IsSuspicious);
        Assert.Null(cleared.SuspiciousReason);
    }

    [Fact]
    public async Task Gunluk_esik_asilinca_platform_yoneticisine_bildirim_gider()
    {
        var admin = new AppUser
        {
            FullName = "Platform Yonetici",
            Username = "platform.admin",
            PasswordHash = "x",
            PrimaryRole = UserRole.Developer,
            Status = UserStatus.Active,
            TenantId = null,
        };
        db.Context.Users.Add(admin);
        await db.Context.SaveChangesAsync();

        var service = CreateService(settings: new Dictionary<string, string?>
        {
            ["Registration:DailyAlertThreshold"] = "1",
        });

        await service.RegisterTenantAsync(ValidRequest("bir@abckoleji.com"), Context);
        await service.RegisterTenantAsync(ValidRequest("iki@abckoleji.com"), Context);
        await service.RegisterTenantAsync(ValidRequest("uc@abckoleji.com"), Context);

        var notifications = await db.Context.Notifications.IgnoreQueryFilters().ToListAsync();

        // Eşik iki kez aşıldı ama bildirim günde bir kez düşer.
        var burst = Assert.Single(notifications.Where(x => x.DedupeKey!.StartsWith("registration-burst:")));
        Assert.Equal(admin.Id, burst.TargetUserId);
        Assert.Null(burst.TenantId);
    }

    [Fact]
    public async Task Engellenen_basvuru_kabul_edilenle_ayni_yaniti_dondurur()
    {
        var controller = CreateController();
        var accepted = await controller.RegisterTenant(ValidRequest("bir@abckoleji.com"), CancellationToken.None);

        await CreateService().AddRegistrationBlocklistEntryAsync(
            new AddRegistrationBlocklistRequest("domain", "abckoleji.com", null), null, "Test");

        var blocked = await CreateController().RegisterTenant(ValidRequest("iki@abckoleji.com"), CancellationToken.None);

        // Engellendiğini belli etmek, saldırgana kara listeyi deneyerek okuturdu.
        Assert.Equal(StatusCodes.Status202Accepted, Assert.IsType<AcceptedResult>(blocked).StatusCode);
        Assert.Equal(SerializeBody(accepted), SerializeBody(blocked));
    }

    // --- Yanıt hijyeni: bu davranış controller'da yaşıyor, orada kilitlenmeli ---

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Approval_assigns_customer_number_and_reports_email_delivery(bool sendSucceeds)
    {
        var email = new StubEmailSender(true, sendSucceeds);
        var service = CreateService(email: email);
        await service.RegisterTenantAsync(ValidRequest(), Context);
        var application = await db.Context.TenantRegistrationApplications.SingleAsync();
        var result = await service.ApproveTenantAsync(application.Id);
        Assert.NotNull(result);
        Assert.Matches("^SA-[0-9]{12}$", result!.CustomerNumber!);
        Assert.Equal(string.Empty, result.Plan);
        Assert.Equal(0, result.MonthlyFee);
        Assert.Equal(sendSucceeds, result.ApprovalEmailSentAtUtc.HasValue);
        if (sendSucceeds)
        {
            var mail = Assert.Single(email.Sent.Where(e => e.Subject.Contains("onaylandı")));
            Assert.Contains(result.CustomerNumber!, mail.Body);
            Assert.Contains(result.AdminUsername!, mail.Body);
            Assert.Contains(result.TemporaryPassword!, mail.Body);
        }
        Assert.Single(await db.Context.TenantWorkspaces.ToListAsync());
    }

    [Fact]
    public async Task Support_uses_tenant_identity_and_accepts_disabled_customer_without_exposing_details()
    {
        var first = new TenantWorkspace { Name = "Aynı Ad", Slug = "bir", Status = "suspended" };
        var second = new TenantWorkspace { Name = "Aynı Ad", Slug = "iki", Status = "active" };
        db.Context.TenantWorkspaces.AddRange(first, second);
        await db.Context.SaveChangesAsync();
        var service = CreateService();
        var controller = new PublicSupportController(db.Context, service, new StubCaptcha(CaptchaVerificationStatus.Success))
        { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
        var body = new PublicSupportRequest(first.CustomerNumber, "Ayşe Yılmaz", "ayse@example.com", "Giriş sorunu", "Kurum hesabına giriş yapamıyoruz.", "Erişim", "test");
        var known = await controller.Create(body, CancellationToken.None);
        var unknown = await controller.Create(body with { CustomerNumber = "SA-000000000000" }, CancellationToken.None);
        Assert.Equal(SerializeBody(known), SerializeBody(unknown));
        var ticket = Assert.Single(await service.GetSupportTicketsByTenantAsync(first.Id));
        Assert.Equal(first.CustomerNumber, ticket.CustomerNumber);
        Assert.Equal(body.Email, ticket.ContactEmail);
        Assert.Empty(await service.GetSupportTicketsByTenantAsync(second.Id));
    }

    [Fact]
    public async Task Access_control_is_platform_only_and_revokes_all_institution_sessions()
    {
        var tenant = new TenantWorkspace { Name = "Okul", Slug = "okul", Status = "active" };
        db.Context.TenantWorkspaces.Add(tenant);
        await db.Context.SaveChangesAsync();
        var admin = new AppUser { Username = "kurum.admin", FullName = "Yönetici", PasswordHash = "x", TenantId = tenant.Id, PrimaryRole = UserRole.Admin };
        var teacher = new AppUser { Username = "kurum.teacher", FullName = "Öğretmen", PasswordHash = "x", TenantId = tenant.Id, PrimaryRole = UserRole.Teacher };
        db.Context.Users.AddRange(admin, teacher);
        await db.Context.SaveChangesAsync();
        db.Context.RefreshTokenSessions.AddRange(new RefreshTokenSession { UserId = admin.Id, TokenHash = "first", ExpiresAtUtc = DateTime.UtcNow.AddDays(1) },
            new RefreshTokenSession { UserId = teacher.Id, TokenHash = "second", ExpiresAtUtc = DateTime.UtcNow.AddDays(1) });
        await db.Context.SaveChangesAsync();
        var controller = CreateController();
        controller.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity(
            new[] { new System.Security.Claims.Claim("role", "Admin") }, "test", "sub", "role"));
        Assert.IsType<ForbidResult>(await controller.SetAccess(tenant.Id, new TenantAccessRequest(false), CancellationToken.None));
        Assert.Equal("active", tenant.Status);
        controller.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity(
            new[] { new System.Security.Claims.Claim("role", "Developer"), new System.Security.Claims.Claim("platform_admin", "true") }, "test", "sub", "role"));
        Assert.IsType<OkObjectResult>(await controller.SetAccess(tenant.Id, new TenantAccessRequest(false), CancellationToken.None));
        Assert.Equal("suspended", tenant.Status);
        Assert.All(await db.Context.RefreshTokenSessions.ToListAsync(), session => Assert.NotNull(session.RevokedAtUtc));
        Assert.IsType<OkObjectResult>(await controller.SetAccess(tenant.Id, new TenantAccessRequest(true), CancellationToken.None));
        Assert.Equal("active", tenant.Status);
        Assert.All(await db.Context.RefreshTokenSessions.ToListAsync(), session => Assert.NotNull(session.RevokedAtUtc));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Support_reply_is_saved_and_email_delivery_result_is_reported(bool succeeds)
    {
        var email = new StubEmailSender(true, succeeds);
        var service = CreateService(email: email);
        var ticket = await service.CreateSupportTicketAsync(new CreateSupportTicketRequest("Destek", "Okul", "Ayşe", "Harici başvuru", "Destek", "normal", "Sorun", "Sorun", ContactEmail: "ayse@example.com"));
        var reply = await service.UpdateSupportTicketAsync(ticket.Id, new UpdateSupportTicketRequest("resolved", null, "Sorununuz giderildi <script>", null));
        Assert.Equal(succeeds, reply!.ReplyEmailSent);
        Assert.Equal("resolved", reply.Status);
        var stored = await db.Context.SupportTickets.SingleAsync();
        Assert.Equal("Sorununuz giderildi <script>", stored.LastMessage);
        if (succeeds) Assert.Contains("&lt;script&gt;", Assert.Single(email.Sent).Body);
    }

    [Fact]
    public async Task Public_support_rejects_failed_captcha_without_creating_ticket()
    {
        var controller = new PublicSupportController(db.Context, CreateService(), new StubCaptcha(CaptchaVerificationStatus.Failed))
        { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
        var result = await controller.Create(new PublicSupportRequest("SA-000000000000", "Ayşe", "ayse@example.com", "Sorun", "Giriş yapamıyoruz", "Erişim", null), CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(await db.Context.SupportTickets.ToListAsync());
    }

    private PlatformOperationsController CreateController(
        CaptchaVerificationStatus captcha = CaptchaVerificationStatus.Success,
        IEmailSender? email = null)
    {
        var controller = new PlatformOperationsController(
            CreateService(captcha, email: email),
            email ?? new StubEmailSender(isConfigured: false), db.Context)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };
        controller.HttpContext.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.7");
        controller.Request.Headers.UserAgent = "Mozilla/5.0";
        controller.Request.Headers.Referer = "https://schoolasist.com/kurum-kaydi";
        return controller;
    }

    private static string SerializeBody(IActionResult result) => result switch
    {
        ObjectResult objectResult => JsonSerializer.Serialize(objectResult.Value),
        _ => throw new InvalidOperationException($"Beklenmeyen sonuç tipi: {result.GetType().Name}"),
    };

    [Fact]
    public async Task Anonim_cagirana_kurum_kimligi_sizdirilmaz()
    {
        var controller = CreateController();

        var response = await controller.RegisterTenant(ValidRequest(), CancellationToken.None);

        var accepted = Assert.IsType<AcceptedResult>(response);
        Assert.Equal(StatusCodes.Status202Accepted, accepted.StatusCode);

        var body = SerializeBody(accepted);
        // Oluşan kaydın kimliği yanıtta olmamalı.
        Assert.DoesNotContain("\"id\"", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("slug", body, StringComparison.OrdinalIgnoreCase);

        var application = await db.Context.TenantRegistrationApplications.SingleAsync();
        Assert.DoesNotContain(application.Id.ToString(), body);
    }

    [Fact]
    public async Task Yinelenen_basvuru_kabul_edilenle_ayni_yaniti_dondurur()
    {
        var controller = CreateController();

        var first = await controller.RegisterTenant(ValidRequest("info@abckoleji.com"), CancellationToken.None);
        var second = await controller.RegisterTenant(ValidRequest("INFO@abckoleji.com"), CancellationToken.None);

        // Aynı gövde: "bu e-posta zaten kayıtlı" ayrımı yanıttan okunamamalı.
        Assert.Equal(StatusCodes.Status202Accepted, Assert.IsType<AcceptedResult>(first).StatusCode);
        Assert.Equal(StatusCodes.Status202Accepted, Assert.IsType<AcceptedResult>(second).StatusCode);
        Assert.Equal(SerializeBody(first), SerializeBody(second));
        Assert.Single(await db.Context.TenantRegistrationApplications.ToListAsync());
    }

    [Fact]
    public async Task Dogrulama_acikken_de_202_govdesi_tek_tip_kalir()
    {
        // verificationRequired yapılandırmaya bakar, sonuca değil: yinelenen başvuru
        // yine kabul edilenle aynı gövdeyi almalı.
        var controller = CreateController(email: new StubEmailSender(isConfigured: true));

        var first = await controller.RegisterTenant(ValidRequest("info@abckoleji.com"), CancellationToken.None);
        var second = await controller.RegisterTenant(ValidRequest("INFO@abckoleji.com"), CancellationToken.None);

        Assert.Equal(SerializeBody(first), SerializeBody(second));
        Assert.Contains("verificationRequired", SerializeBody(first));
    }

    [Fact]
    public async Task Dogrulama_hatasi_400_captcha_hatasi_400_dondurur()
    {
        var invalid = await CreateController()
            .RegisterTenant(ValidRequest() with { InstitutionType = "Hastane" }, CancellationToken.None);
        Assert.Equal(StatusCodes.Status400BadRequest, Assert.IsType<BadRequestObjectResult>(invalid).StatusCode);

        var captchaFailed = await CreateController(CaptchaVerificationStatus.Failed)
            .RegisterTenant(ValidRequest(), CancellationToken.None);
        Assert.Equal(StatusCodes.Status400BadRequest, Assert.IsType<BadRequestObjectResult>(captchaFailed).StatusCode);
    }

    [Fact]
    public async Task Platformops_requires_explicit_platform_admin_claim_and_absent_tenant()
    {
        var controller = CreateController();
        controller.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
            new System.Security.Claims.ClaimsIdentity([
                new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, "Admin"),
                new System.Security.Claims.Claim("platform_admin", "false")
            ], "test", "name", System.Security.Claims.ClaimTypes.Role));
        Assert.IsType<ForbidResult>(await controller.GetOverview(CancellationToken.None));

        controller.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
            new System.Security.Claims.ClaimsIdentity([
                new System.Security.Claims.Claim("platform_admin", "true"),
                new System.Security.Claims.Claim("tenant_id", Guid.NewGuid().ToString())
            ], "test"));
        Assert.IsType<ForbidResult>(await controller.GetOverview(CancellationToken.None));
    }

    private sealed class ThrowingSetupDocument : ITenantSetupDocumentService
    {
        public byte[] Generate(TenantSetupDocumentModel model)
            => throw new InvalidOperationException("pdf failed");
    }

    public void Dispose() => db.Dispose();
}
