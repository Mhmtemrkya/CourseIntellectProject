using System.Reflection;
using CourseIntellect.Api.Authorization;
using CourseIntellect.Api.Controllers;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Tests;

/// <summary>
/// Onam formu + tablet dijital imza akışının kabul testleri.
///
/// Her test bir iş kuralına karşılık gelir; kurallar servis katmanında yaşadığı
/// için HTTP ayağa kaldırılmadan doğrulanabilir. Yetki kuralları (rol beyaz
/// listesi, paket kapısının yalnız yazma yollarında olması) controller
/// metadata'sı üzerinden sınanır.
/// </summary>
public sealed class ConsentFormTests
{
    private const string Png =
        "data:image/png;base64," +
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" +
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    // ══════════════════════════════════════════════════════════════════════════
    // Kurulum
    // ══════════════════════════════════════════════════════════════════════════

    private sealed class Harness : IDisposable
    {
        public TestDb Db { get; } = new();
        public ConsentFormService Service { get; }
        public ConsentFormPdfService Pdf { get; } = new();
        public StudentProfile Student { get; }

        public Harness()
        {
            Service = new ConsentFormService(
                Db.Context, new StubInstitutionProfileService(), Pdf, new StubAuditLogService());

            Student = new StudentProfile
            {
                UserId = Guid.NewGuid(),
                FullName = "Elif YILMAZ",
                TcNo = "12345678901",
                ClassName = "11-A",
                SchoolNumber = "204",
                ParentName = "Murat YILMAZ",
                ParentPhone = "0555 111 22 33",
                Address = "Yakutiye / ERZURUM",
                BirthDate = "2008-04-11",
            };
            Db.Context.Students.Add(Student);
            Db.Context.SaveChanges();
        }

        public void Dispose() => Db.Dispose();
    }

    private sealed class StubInstitutionProfileService : IInstitutionProfileService
    {
        public Task<InstitutionProfileDto> GetEffectiveAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(new InstitutionProfileDto(
                "ERZURUM SÜRÜŞ AKADEMİSİ", "Cumhuriyet Cad. No:5", "Yakutiye", "Erzurum",
                "0442 000 00 00", "info@example.com", "example.com", "Yakutiye VD", "1234567890",
                string.Empty, true, DateTime.UtcNow));

        public Task<InstitutionProfileDto> SaveAsync(
            SaveInstitutionProfileRequest request, Guid? updatedByUserId, CancellationToken cancellationToken = default) =>
            GetEffectiveAsync(cancellationToken);
    }

    private sealed class StubAuditLogService : IAuditLogService
    {
        public Task LogAsync(Guid? actorUserId, string actorName, string action, string category,
            string entityType, string entityId, string detail, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task LogAsync(string action, string category, string entityType, string entityId,
            string detail, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task LogChangeAsync(string action, string category, string entityType, string entityId,
            string detail, object? before, object? after, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<IReadOnlyList<AuditLogDto>> GetAsync(string? category, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<AuditLogDto>>([]);

        public Task<AuditLogPageDto> GetPagedAsync(AuditLogQuery query, CancellationToken cancellationToken = default)
            => Task.FromResult(new AuditLogPageDto([], 0, query.Skip, query.Take));

        public Task<IReadOnlyList<AuditBranchSummaryDto>> GetBranchSummaryAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<AuditBranchSummaryDto>>([]);
    }

    private static SaveConsentTemplateRequest TemplateRequest(
        string title = "Direksiyon Eğitimi Açık Rıza ve Taahhütnamesi",
        string? body = null,
        IReadOnlyList<string>? items = null,
        bool requiresSignature = true,
        IReadOnlyList<ConsentTemplateBindingDto>? bindings = null) =>
        new(title,
            body ?? "Ben, {{ogrenci}} ({{tc}}), {{kurum}} bünyesinde {{konu}} kapsamında eğitim alacağımı kabul ederim.\n"
                  + "Veli: {{veli}} — Sınıf: {{sinif}} — Tarih: {{tarih}} — Personel: {{personel}}",
            items ?? ["Metni okudum ve anladım.", "Kişisel verilerimin işlenmesine rıza gösteriyorum."],
            requiresSignature,
            ConsentSignerRole.StudentOrParent,
            true,
            0,
            bindings);

    private static async Task<Guid> SeedTemplateAsync(
        Harness harness, SaveConsentTemplateRequest? request = null)
    {
        var created = await harness.Service.CreateTemplateAsync(request ?? TemplateRequest(), null);
        Assert.True(created.Ok);
        return created.Value!.Id;
    }

    private static async Task<ConsentFormDto> SeedFormAsync(
        Harness harness,
        Guid templateId,
        ConsentContextKind kind = ConsentContextKind.DrivingLesson,
        Guid? contextRefId = null,
        string? contextKey = null,
        string? staffNotes = null)
    {
        var created = await harness.Service.CreateFormAsync(
            new CreateConsentFormRequest(templateId, harness.Student.Id, kind, contextKey, contextRefId,
                "B Sınıfı Direksiyon Dersi", staffNotes),
            null, "Ayşe DEMİR");
        Assert.True(created.Ok);
        return created.Value!;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 1-2 — Şablon
    // ══════════════════════════════════════════════════════════════════════════

    [Fact] // 1
    public async Task Template_IsCreatedWithCheckItems()
    {
        using var harness = new Harness();

        var created = await harness.Service.CreateTemplateAsync(TemplateRequest(), null);

        Assert.True(created.Ok);
        Assert.Equal(2, created.Value!.CheckItems.Count);
        Assert.Equal("Metni okudum ve anladım.", created.Value.CheckItems[0]);
        Assert.True(created.Value.RequiresSignature);
    }

    [Fact] // 2
    public async Task Template_BoundToContext_MakesAppointmentIncomplete()
    {
        using var harness = new Harness();
        var (appointmentId, packageId) = await SeedDrivingAppointmentAsync(harness);

        await SeedTemplateAsync(harness, TemplateRequest(
            bindings: [new ConsentTemplateBindingDto(ConsentContextKind.DrivingLesson, packageId.ToString())]));

        var status = await harness.Service.GetAppointmentStatusAsync(appointmentId);

        Assert.True(status.Ok);
        Assert.False(status.Value!.Complete);
        Assert.Equal(1, status.Value.RequiredCount);
        Assert.Equal(0, status.Value.SignedCount);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 3-7 — Müşteri kaydı
    // ══════════════════════════════════════════════════════════════════════════

    [Fact] // 3
    public async Task Form_IsCreatedAsDraft()
    {
        using var harness = new Harness();
        var templateId = await SeedTemplateAsync(harness);

        var form = await SeedFormAsync(harness, templateId);

        Assert.Equal(ConsentFormStatus.Draft, form.Status);
        Assert.Equal(harness.Student.Id, form.StudentProfileId);
    }

    [Fact] // 4
    public async Task Form_CopiesTemplateText_AndSurvivesTemplateEdit()
    {
        using var harness = new Harness();
        var templateId = await SeedTemplateAsync(harness);
        var form = await SeedFormAsync(harness, templateId);

        await harness.Service.UpdateTemplateAsync(templateId,
            TemplateRequest(title: "Değişmiş Başlık", body: "Tamamen farklı metin.", items: ["Tek madde"]), null);

        var reloaded = await harness.Service.GetFormAsync(form.Id);

        Assert.True(reloaded.Ok);
        Assert.Equal("Direksiyon Eğitimi Açık Rıza ve Taahhütnamesi", reloaded.Value!.Title);
        Assert.Contains("Elif YILMAZ", reloaded.Value.Body);
        Assert.Equal(2, reloaded.Value.CheckItems.Count);
    }

    [Fact] // 5
    public async Task Form_FillsEveryPlaceholderOnServer()
    {
        using var harness = new Harness();
        var templateId = await SeedTemplateAsync(harness);

        var form = await SeedFormAsync(harness, templateId);

        Assert.DoesNotContain("{{", form.Body);
        Assert.DoesNotContain("}}", form.Body);
        Assert.DoesNotContain("...", form.Body); // her alanın karşılığı var → noktalı boşluk kalmadı
        Assert.Contains("ERZURUM SÜRÜŞ AKADEMİSİ", form.Body);
        Assert.Contains("Murat YILMAZ", form.Body);
        Assert.Contains("B Sınıfı Direksiyon Dersi", form.Body);
    }

    [Fact] // 5b — karşılığı olmayan alan noktalı boşluk olur, ham yer tutucu kalmaz
    public async Task Form_LeavesDottedBlankForUnknownPlaceholder()
    {
        using var harness = new Harness();
        var templateId = await SeedTemplateAsync(harness, TemplateRequest(body: "Plaka: {{plaka}} — Öğrenci: {{ogrenci}}"));

        var form = await SeedFormAsync(harness, templateId);

        Assert.DoesNotContain("{{plaka}}", form.Body);
        Assert.Contains("............................", form.Body);
        Assert.Contains("Elif YILMAZ", form.Body);
    }

    [Fact] // 6
    public async Task Form_NeverPrintsEmailAsStaffName()
    {
        using var harness = new Harness();
        var userId = Guid.NewGuid();
        harness.Db.Context.Users.Add(new AppUser
        {
            Id = userId,
            FullName = "kurs.admin@example.com",
            Username = "kurs.admin",
            PasswordHash = "x",
            PrimaryRole = UserRole.Admin,
        });
        harness.Db.Context.SaveChanges();

        var templateId = await SeedTemplateAsync(harness);
        var created = await harness.Service.CreateFormAsync(
            new CreateConsentFormRequest(templateId, harness.Student.Id, ConsentContextKind.General,
                null, null, "KVKK", null),
            userId, "kurs.admin@example.com");

        Assert.True(created.Ok);
        Assert.Equal(string.Empty, created.Value!.StaffName);
        Assert.DoesNotContain("@", created.Value.Body);
    }

    [Fact] // 6b — personel kaydı varsa belgeye o ad basılır
    public async Task Form_PrefersStaffProfileName()
    {
        using var harness = new Harness();
        var userId = Guid.NewGuid();
        harness.Db.Context.Users.Add(new AppUser
        {
            Id = userId, FullName = "ofis@example.com", Username = "ofis", PasswordHash = "x", PrimaryRole = UserRole.Administrative,
        });
        harness.Db.Context.Staff.Add(new StaffProfile { UserId = userId, FullName = "Ayşe DEMİR" });
        harness.Db.Context.SaveChanges();

        var templateId = await SeedTemplateAsync(harness);
        var created = await harness.Service.CreateFormAsync(
            new CreateConsentFormRequest(templateId, harness.Student.Id, ConsentContextKind.General, null, null, "KVKK", null),
            userId, "ofis@example.com");

        Assert.Equal("Ayşe DEMİR", created.Value!.StaffName);
    }

    [Fact] // 7
    public async Task Form_StoresStaffNote()
    {
        using var harness = new Harness();
        var templateId = await SeedTemplateAsync(harness);

        var form = await SeedFormAsync(harness, templateId, staffNotes: "Gece sürüşü — refakatçi bilgilendirildi.");

        Assert.Equal("Gece sürüşü — refakatçi bilgilendirildi.", form.StaffNotes);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 8-12 — Tablete aktarma
    // ══════════════════════════════════════════════════════════════════════════

    [Fact] // 8 + 9
    public async Task Dispatch_OpensSingleUseSessionOnNamedStation()
    {
        using var harness = new Harness();
        var templateId = await SeedTemplateAsync(harness);
        var form = await SeedFormAsync(harness, templateId);

        var dispatched = await harness.Service.OpenSessionAsync(form.Id, new OpenConsentSessionRequest("Kabin 1", null), null);

        Assert.True(dispatched.Ok);
        Assert.Equal(ConsentFormStatus.AwaitingSignature, dispatched.Value!.Status);
        Assert.Equal("Kabin 1", dispatched.Value.StationName);

        var record = harness.Db.Context.ConsentFormRecords.Single(x => x.Id == form.Id);
        Assert.NotNull(record.SessionToken);
        Assert.NotNull(record.SessionExpiresAtUtc);
    }

    [Fact] // 10
    public async Task Station_SeesFormAddressedToIt()
    {
        using var harness = new Harness();
        var templateId = await SeedTemplateAsync(harness);
        var form = await SeedFormAsync(harness, templateId);
        await harness.Service.OpenSessionAsync(form.Id, new OpenConsentSessionRequest("Kabin 1", null), null);

        // Baştaki/sondaki boşluk ve büyük-küçük harf farkı tolere edilir.
        var polled = await harness.Service.PollStationAsync("  kabin 1 ", "iPad");

        Assert.True(polled.Ok);
        Assert.NotNull(polled.Value);
        Assert.Equal(form.Id, polled.Value!.Id);
        Assert.Equal(2, polled.Value.CheckItems.Count);
    }

    [Fact] // 11
    public async Task Station_DoesNotSeeAnotherStationsForm()
    {
        using var harness = new Harness();
        var templateId = await SeedTemplateAsync(harness);
        var form = await SeedFormAsync(harness, templateId);
        await harness.Service.OpenSessionAsync(form.Id, new OpenConsentSessionRequest("Kabin 1", null), null);

        var polled = await harness.Service.PollStationAsync("Kabin 2", "iPad");

        Assert.True(polled.Ok);
        Assert.Null(polled.Value);
    }

    [Fact] // 12
    public async Task Dispatch_ClosesStaleSessionOnSameStation()
    {
        using var harness = new Harness();
        var templateId = await SeedTemplateAsync(harness);
        var first = await SeedFormAsync(harness, templateId);
        var second = await SeedFormAsync(harness, templateId);

        await harness.Service.OpenSessionAsync(first.Id, new OpenConsentSessionRequest("Kabin 1", null), null);
        await harness.Service.OpenSessionAsync(second.Id, new OpenConsentSessionRequest("Kabin 1", null), null);

        var stale = harness.Db.Context.ConsentFormRecords.Single(x => x.Id == first.Id);
        Assert.Equal(ConsentFormStatus.Draft, stale.Status);
        Assert.Null(stale.SessionToken);

        var polled = await harness.Service.PollStationAsync("Kabin 1", "iPad");
        Assert.Equal(second.Id, polled.Value!.Id);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 13-18 — İmza
    // ══════════════════════════════════════════════════════════════════════════

    [Fact] // 13
    public async Task Sign_RejectsMissingCheckItems()
    {
        using var harness = new Harness();
        var token = await DispatchAsync(harness);

        var signed = await harness.Service.SignAsync(token,
            new SignConsentFormRequest([0], Png, "Murat YILMAZ", "Baba"), "iPad", "10.0.0.5");

        Assert.Equal(400, signed.StatusCode);
        Assert.Contains("onay maddeleri", signed.Message);
    }

    [Fact] // 14
    public async Task Sign_RejectsEmptySignatureWhenRequired()
    {
        using var harness = new Harness();
        var token = await DispatchAsync(harness);

        var signed = await harness.Service.SignAsync(token,
            new SignConsentFormRequest([0, 1], null, "Murat YILMAZ", "Baba"), "iPad", "10.0.0.5");

        Assert.Equal(409, signed.StatusCode);
    }

    [Fact] // 14b — imza istemeyen bilgilendirme formu imzasız tamamlanır
    public async Task Sign_AcceptsEmptySignatureWhenNotRequired()
    {
        using var harness = new Harness();
        var templateId = await SeedTemplateAsync(harness, TemplateRequest(requiresSignature: false));
        var form = await SeedFormAsync(harness, templateId);
        await harness.Service.OpenSessionAsync(form.Id, new OpenConsentSessionRequest("Kabin 1", null), null);
        var token = harness.Db.Context.ConsentFormRecords.Single(x => x.Id == form.Id).SessionToken!.Value;

        var signed = await harness.Service.SignAsync(token,
            new SignConsentFormRequest([0, 1], null, "Elif YILMAZ", null), "iPad", "10.0.0.5");

        Assert.True(signed.Ok);
        Assert.Equal(ConsentFormStatus.Signed, signed.Value!.Status);
        Assert.False(signed.Value.HasSignature);
    }

    [Fact] // 15 + 16
    public async Task Sign_StoresEvidence_AndBurnsSessionToken()
    {
        using var harness = new Harness();
        var token = await DispatchAsync(harness);

        var signed = await harness.Service.SignAsync(token,
            new SignConsentFormRequest([0, 1], Png, "Murat YILMAZ", "Baba"), "iPad Safari", "10.0.0.5");

        Assert.True(signed.Ok);
        Assert.Equal(ConsentFormStatus.Signed, signed.Value!.Status);
        Assert.True(signed.Value.HasSignature);
        Assert.NotNull(signed.Value.SignedAtUtc);
        Assert.Equal([0, 1], signed.Value.CheckedItems);

        var record = harness.Db.Context.ConsentFormRecords.Single(x => x.Id == signed.Value.Id);
        Assert.Null(record.SessionToken);
        Assert.Equal("Murat YILMAZ", record.SignerName);
        Assert.Equal("Baba", record.SignerRelation);
        Assert.Equal("iPad Safari", record.SignerDevice);
        Assert.Equal("10.0.0.5", record.SignerIp);
        Assert.StartsWith("data:image/png;base64,", record.SignatureImage);
    }

    [Fact] // 17
    public async Task Sign_WithUsedToken_Returns404()
    {
        using var harness = new Harness();
        var token = await DispatchAsync(harness);
        await harness.Service.SignAsync(token, new SignConsentFormRequest([0, 1], Png, "Murat YILMAZ", null), "iPad", "10.0.0.5");

        var second = await harness.Service.SignAsync(token,
            new SignConsentFormRequest([0, 1], Png, "Başka Kişi", null), "iPad", "10.0.0.5");

        Assert.Equal(404, second.StatusCode);
    }

    [Fact] // 18
    public async Task Sign_WithExpiredSession_Returns409()
    {
        using var harness = new Harness();
        var token = await DispatchAsync(harness);

        var record = harness.Db.Context.ConsentFormRecords.Single(x => x.SessionToken == token);
        record.SessionExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1);
        harness.Db.Context.SaveChanges();

        var signed = await harness.Service.SignAsync(token,
            new SignConsentFormRequest([0, 1], Png, "Murat YILMAZ", null), "iPad", "10.0.0.5");

        Assert.Equal(409, signed.StatusCode);
    }

    [Fact] // 18b — süresi dolan oturum tablete hiç düşmez
    public async Task Station_DoesNotSeeExpiredSession()
    {
        using var harness = new Harness();
        var token = await DispatchAsync(harness);
        var record = harness.Db.Context.ConsentFormRecords.Single(x => x.SessionToken == token);
        record.SessionExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1);
        harness.Db.Context.SaveChanges();

        var polled = await harness.Service.PollStationAsync("Kabin 1", "iPad");

        Assert.Null(polled.Value);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 19-22 — Sonrası
    // ══════════════════════════════════════════════════════════════════════════

    [Fact] // 19
    public async Task AppointmentGate_TurnsCompleteAfterSigning()
    {
        using var harness = new Harness();
        var (appointmentId, packageId) = await SeedDrivingAppointmentAsync(harness);
        var templateId = await SeedTemplateAsync(harness, TemplateRequest(
            bindings: [new ConsentTemplateBindingDto(ConsentContextKind.DrivingLesson, packageId.ToString())]));

        var form = await SeedFormAsync(harness, templateId,
            ConsentContextKind.DrivingLesson, appointmentId, packageId.ToString());
        await harness.Service.OpenSessionAsync(form.Id, new OpenConsentSessionRequest("Kabin 1", null), null);
        var token = harness.Db.Context.ConsentFormRecords.Single(x => x.Id == form.Id).SessionToken!.Value;
        await harness.Service.SignAsync(token, new SignConsentFormRequest([0, 1], Png, "Murat YILMAZ", "Baba"), "iPad", "10.0.0.5");

        var status = await harness.Service.GetAppointmentStatusAsync(appointmentId);

        Assert.True(status.Value!.Complete);
        Assert.Equal(1, status.Value.SignedCount);
        Assert.Equal(ConsentFormStatus.Signed, status.Value.Requirements[0].Status);
    }

    [Fact] // 20
    public async Task StudentEndpoints_ReturnTheRecord()
    {
        using var harness = new Harness();
        var templateId = await SeedTemplateAsync(harness, TemplateRequest(
            bindings: [new ConsentTemplateBindingDto(ConsentContextKind.General, string.Empty)]));
        var form = await SeedFormAsync(harness, templateId, ConsentContextKind.General);

        var list = await harness.Service.ListStudentFormsAsync(harness.Student.Id);
        var status = await harness.Service.GetStatusAsync(harness.Student.Id, null, null, null);

        Assert.Single(list);
        Assert.Equal(form.Id, list[0].Id);
        Assert.Equal(1, status.Value!.RequiredCount);
        Assert.Equal(form.Id, status.Value.Requirements[0].FormId);
    }

    [Fact] // 21
    public async Task SignedForm_CannotBeUpdatedOrCancelled()
    {
        using var harness = new Harness();
        var token = await DispatchAsync(harness);
        var signed = await harness.Service.SignAsync(token,
            new SignConsentFormRequest([0, 1], Png, "Murat YILMAZ", null), "iPad", "10.0.0.5");

        var update = await harness.Service.UpdateFormAsync(signed.Value!.Id, new UpdateConsentFormRequest("yeni not"), null);
        var cancel = await harness.Service.CancelFormAsync(signed.Value.Id, null);
        var redispatch = await harness.Service.OpenSessionAsync(
            signed.Value.Id, new OpenConsentSessionRequest("Kabin 1", null), null);

        Assert.Equal(409, update.StatusCode);
        Assert.Equal(409, cancel.StatusCode);
        Assert.Equal(409, redispatch.StatusCode);
    }

    [Fact] // 22
    public async Task DeletingTemplate_KeepsSignedRecords()
    {
        using var harness = new Harness();
        var templateId = await SeedTemplateAsync(harness, TemplateRequest(
            bindings: [new ConsentTemplateBindingDto(ConsentContextKind.General, string.Empty)]));
        var token = await DispatchAsync(harness, templateId);
        var signed = await harness.Service.SignAsync(token,
            new SignConsentFormRequest([0, 1], Png, "Murat YILMAZ", null), "iPad", "10.0.0.5");

        var deleted = await harness.Service.DeleteTemplateAsync(templateId, null);

        Assert.True(deleted.Ok);
        var record = harness.Db.Context.ConsentFormRecords.Single(x => x.Id == signed.Value!.Id);
        Assert.Equal(ConsentFormStatus.Signed, record.Status);
        Assert.Contains("Elif YILMAZ", record.Body);
        Assert.NotEqual(string.Empty, record.SignatureImage);
        // Şablon ve hizmet bağları kalkar → artık "gerekli form" listesinde çıkmaz.
        Assert.Empty(harness.Db.Context.ConsentFormRequirements.ToList());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 23-24 — Yetki
    // ══════════════════════════════════════════════════════════════════════════

    [Fact] // 23
    public void Controller_UsesRoleAllowList_ExcludingStudentAndParent()
    {
        var authorize = typeof(ConsentController)
            .GetCustomAttributes<AuthorizeAttribute>(inherit: true)
            .Single();

        var roles = (authorize.Roles ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries);

        Assert.NotEmpty(roles);
        Assert.DoesNotContain("Student", roles);
        Assert.DoesNotContain("Parent", roles);
        Assert.Contains("Admin", roles);
    }

    [Fact] // 24
    public void EntitlementGate_AppliesToWritePathsOnly()
    {
        var actions = typeof(ConsentController)
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly);

        foreach (var action in actions)
        {
            var isRead = action.GetCustomAttributes<HttpGetAttribute>().Any();
            var gated = action.GetCustomAttributes<RequireEntitlementAttribute>().Any();

            if (isRead)
            {
                Assert.False(gated, $"{action.Name} bir okuma ucu; paket kapısı olmamalı.");
            }
        }

        // Yazma yollarının kapısı gerçekten var mı?
        Assert.True(typeof(ConsentController).GetMethod(nameof(ConsentController.CreateForm))!
            .GetCustomAttributes<RequireEntitlementAttribute>().Any());
        Assert.True(typeof(ConsentController).GetMethod(nameof(ConsentController.OpenSession))!
            .GetCustomAttributes<RequireEntitlementAttribute>().Any());
    }

    [Fact] // 12 (kural) — imza akışı personel onay kuyruğunun dışında
    public void SignEndpoint_IsNotBehindApprovalQueue()
    {
        var sign = typeof(ConsentController).GetMethod(nameof(ConsentController.Sign))!;

        // İmza ucu paket kapısı dahil hiçbir ek kapıya takılmaz; aksi hâlde
        // form tablete düşse bile imza alınamaz.
        Assert.Empty(sign.GetCustomAttributes<RequireEntitlementAttribute>());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 13-19 — Yüklenmiş PDF kaynaklı formlar
    // ══════════════════════════════════════════════════════════════════════════

    [Fact] // 13
    public async Task Document_RejectsNonPdfContent()
    {
        using var harness = new Harness();

        // Uzantı .pdf ama içerik değil: uzantıya güvenilmediği burada kilitlenir.
        var saved = await harness.Service.SaveDocumentAsync(
            "<?php system($_GET['c']); ?>"u8.ToArray(), "sozlesme.pdf", null);

        Assert.False(saved.Ok);
        Assert.Equal(400, saved.StatusCode);
    }

    [Fact] // 14
    public async Task Document_SameContentUploadedTwice_IsStoredOnce()
    {
        using var harness = new Harness();
        var pdf = SamplePdf(2);

        var first = await harness.Service.SaveDocumentAsync(pdf, "sozlesme.pdf", null);
        var second = await harness.Service.SaveDocumentAsync(pdf, "kopya.pdf", null);

        Assert.True(first.Ok);
        Assert.True(second.Ok);
        Assert.Equal(first.Value!.Id, second.Value!.Id);
        Assert.Equal(2, first.Value.PageCount);
        Assert.Single(harness.Db.Context.ConsentDocuments);
    }

    [Fact] // 15
    public async Task PdfTemplate_WithoutDocument_IsRejected()
    {
        using var harness = new Harness();

        var created = await harness.Service.CreateTemplateAsync(
            TemplateRequest() with { SourceKind = ConsentDocumentSource.Pdf, DocumentId = null }, null);

        Assert.False(created.Ok);
        Assert.Equal(400, created.StatusCode);
    }

    [Fact] // 16
    public async Task PdfTemplate_WithUnknownDocument_IsRejected()
    {
        using var harness = new Harness();

        var created = await harness.Service.CreateTemplateAsync(
            TemplateRequest() with { SourceKind = ConsentDocumentSource.Pdf, DocumentId = Guid.NewGuid() }, null);

        Assert.False(created.Ok);
        Assert.Equal(404, created.StatusCode);
    }

    [Fact] // 17
    public async Task PdfForm_StaysBoundToDocumentItWasCreatedWith()
    {
        using var harness = new Harness();
        var first = await harness.Service.SaveDocumentAsync(SamplePdf(1), "eski.pdf", null);
        var templateId = await SeedPdfTemplateAsync(harness, first.Value!.Id);
        var form = await SeedFormAsync(harness, templateId, ConsentContextKind.SchoolEnrollment);

        // Şablona yeni sürüm yüklenir; imzalanacak kayıt ESKİ belgeye bağlı kalmalı.
        var second = await harness.Service.SaveDocumentAsync(SamplePdf(3), "yeni.pdf", null);
        await harness.Service.UpdateTemplateAsync(templateId,
            TemplateRequest() with { SourceKind = ConsentDocumentSource.Pdf, DocumentId = second.Value!.Id }, null);

        var stored = await harness.Service.GetFormAsync(form.Id);

        Assert.Equal(ConsentDocumentSource.Pdf, stored.Value!.SourceKind);
        Assert.Equal(first.Value.Id, stored.Value.DocumentId);
        Assert.Equal("eski.pdf", stored.Value.DocumentFileName);
    }

    [Fact] // 18
    public async Task TextForm_HasNoUploadedDocument()
    {
        using var harness = new Harness();
        var templateId = await SeedTemplateAsync(harness);
        var form = await SeedFormAsync(harness, templateId);

        var document = await harness.Service.GetFormDocumentAsync(form.Id);

        Assert.False(document.Ok);
        Assert.Equal(404, document.StatusCode);
    }

    [Fact] // 19 — özgün sayfalar korunur, imza AYRI bir tutanak sayfasına basılır
    public void SignedPdf_KeepsOriginalPages_AndAppendsSignaturePage()
    {
        var harness = new ConsentFormPdfService();
        var source = SamplePdf(3);

        var merged = harness.AppendSignaturePage(
            source,
            new ConsentPdfModel(
                InstitutionName: "DEMO KOLEJİ",
                Title: "Kayıt Sözleşmesi",
                Body: string.Empty,
                CheckItems: ["Okudum."],
                CheckedItems: [0],
                StudentName: "Elif YILMAZ",
                ContextLabel: "Okul kaydı",
                StaffName: "Ayşe DEMİR",
                StaffNotes: string.Empty,
                SignerLabel: "Veli imzası",
                SignerName: "Murat YILMAZ",
                SignerRelation: "Baba",
                SignedAtUtc: DateTime.UtcNow),
            new ConsentDocumentStamp("sozlesme.pdf", new string('a', 64), 3));

        Assert.Equal(4, harness.Inspect(merged).PageCount);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Yardımcılar
    // ══════════════════════════════════════════════════════════════════════════

    private static async Task<Guid> SeedPdfTemplateAsync(Harness harness, Guid documentId)
    {
        var created = await harness.Service.CreateTemplateAsync(
            TemplateRequest() with { SourceKind = ConsentDocumentSource.Pdf, DocumentId = documentId },
            null);
        Assert.True(created.Ok);
        return created.Value!.Id;
    }

    /// <summary>Elle kurulmuş en yalın geçerli PDF — dış dosyaya bağımlılık olmasın.</summary>
    private static byte[] SamplePdf(int pageCount)
    {
        var objects = new List<byte[]>();
        var kids = string.Join(' ', Enumerable.Range(0, pageCount).Select(i => $"{3 + i * 2} 0 R"));
        objects.Add("<< /Type /Catalog /Pages 2 0 R >>"u8.ToArray());
        objects.Add(System.Text.Encoding.ASCII.GetBytes($"<< /Type /Pages /Kids [{kids}] /Count {pageCount} >>"));

        for (var index = 0; index < pageCount; index++)
        {
            objects.Add(System.Text.Encoding.ASCII.GetBytes(
                $"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 {3 + pageCount * 2} 0 R >> >> /Contents {4 + index * 2} 0 R >>"));
            var content = System.Text.Encoding.ASCII.GetBytes($"BT /F1 14 Tf 60 760 Td (Sayfa {index + 1}) Tj ET");
            objects.Add([
                .. System.Text.Encoding.ASCII.GetBytes($"<< /Length {content.Length} >>\nstream\n"),
                .. content,
                .. "\nendstream"u8.ToArray(),
            ]);
        }

        objects.Add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"u8.ToArray());

        using var buffer = new MemoryStream();
        buffer.Write("%PDF-1.4\n"u8);
        var offsets = new List<long>();
        for (var index = 0; index < objects.Count; index++)
        {
            offsets.Add(buffer.Length);
            buffer.Write(System.Text.Encoding.ASCII.GetBytes($"{index + 1} 0 obj\n"));
            buffer.Write(objects[index]);
            buffer.Write("\nendobj\n"u8);
        }

        var xref = buffer.Length;
        buffer.Write(System.Text.Encoding.ASCII.GetBytes($"xref\n0 {objects.Count + 1}\n0000000000 65535 f \n"));
        foreach (var offset in offsets)
        {
            buffer.Write(System.Text.Encoding.ASCII.GetBytes($"{offset:D10} 00000 n \n"));
        }
        buffer.Write(System.Text.Encoding.ASCII.GetBytes(
            $"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n"));

        return buffer.ToArray();
    }

    private static async Task<Guid> DispatchAsync(Harness harness, Guid? templateId = null)
    {
        var id = templateId ?? await SeedTemplateAsync(harness);
        var form = await SeedFormAsync(harness, id);
        await harness.Service.OpenSessionAsync(form.Id, new OpenConsentSessionRequest("Kabin 1", null), null);
        return harness.Db.Context.ConsentFormRecords.Single(x => x.Id == form.Id).SessionToken!.Value;
    }

    private static async Task<(Guid AppointmentId, Guid PackageId)> SeedDrivingAppointmentAsync(Harness harness)
    {
        var package = new DrivingPackage { Name = "B Sınıfı Standart", LicenseClass = "B" };
        var profile = new StudentDrivingProfile
        {
            StudentId = harness.Student.Id,
            PackageId = package.Id,
            LicenseClass = "B",
            StudentNumber = 12,
        };
        var vehicle = new DrivingVehicle { PlateNumber = "25 ABC 25", Brand = "Fiat", Model = "Egea" };
        var staff = new StaffProfile { UserId = Guid.NewGuid(), FullName = "Kemal USTA" };
        var instructor = new DrivingInstructorProfile { StaffId = staff.Id, LicenseClasses = "B" };
        var appointment = new DrivingAppointment
        {
            StudentDrivingProfileId = profile.Id,
            InstructorProfileId = instructor.Id,
            VehicleId = vehicle.Id,
            StartsAtUtc = DateTime.UtcNow.AddHours(2),
            EndsAtUtc = DateTime.UtcNow.AddHours(3),
        };

        harness.Db.Context.DrivingPackages.Add(package);
        harness.Db.Context.DrivingVehicles.Add(vehicle);
        harness.Db.Context.Staff.Add(staff);
        harness.Db.Context.DrivingInstructorProfiles.Add(instructor);
        harness.Db.Context.StudentDrivingProfiles.Add(profile);
        harness.Db.Context.DrivingAppointments.Add(appointment);
        await harness.Db.Context.SaveChangesAsync();

        return (appointment.Id, package.Id);
    }
}
