using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using CourseIntellect.Application.DTOs.PlatformOperations;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Auth;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace CourseIntellect.Infrastructure.Services;

public sealed class PlatformOperationsService(
    CourseIntellectDbContext dbContext,
    IPasswordHasher passwordHasher,
    ICaptchaVerificationService captchaVerification,
    ITenantSetupDocumentService setupDocumentService,
    IAuditLogService auditLog,
    IEmailSender emailSender,
    IHostEnvironment environment,
    IConfiguration configuration,
    ILogger<PlatformOperationsService> logger,
    IOnboardingEmailDelivery? emailDelivery = null) : IPlatformOperationsService
{
    /// <summary>Halka açık kayıt formunda kabul edilen planlar.</summary>
    private static readonly string[] PublicPlans = ["Starter", "Business", "Enterprise"];

    /// <summary>
    /// Ücretli paket akışı (plan seçimi + self-servis satın alma) açık mı?
    /// Varsayılan KAPALI: şu an kaydolan her kurum ücretsiz ve paket kısıtı
    /// olmadan kullanır. Akış silinmedi; geri açmak için "Billing:Enabled" = true.
    /// </summary>
    private bool BillingEnabled => configuration.GetValue<bool>("Billing:Enabled");

    /// <summary>Onaylanan aydınlatma/açık rıza metninin sürümü. İstemciden ALINMAZ.</summary>
    private const string CurrentKvkkConsentVersion = "2026-10-kurum-kaydi-v2";

    private static readonly Regex EmailPattern = new(
        @"^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public async Task<PlatformOverviewDto> GetOverviewAsync(CancellationToken cancellationToken = default)
    {
        var tenants = await GetTenantsAsync(cancellationToken);
        var tickets = await GetSupportTicketsAsync(cancellationToken);
        var notifications = await dbContext.Notifications.AsNoTracking().ToListAsync(cancellationToken);
        var threads = await dbContext.StudentQuestionThreads.AsNoTracking().ToListAsync(cancellationToken);
        var contents = await dbContext.ContentItems.AsNoTracking().ToListAsync(cancellationToken);
        var homework = await dbContext.HomeworkAssignments.AsNoTracking().ToListAsync(cancellationToken);
        var meetings = await dbContext.MeetingRequests.AsNoTracking().ToListAsync(cancellationToken);
        var invoices = await dbContext.AccountingInvoices.AsNoTracking().ToListAsync(cancellationToken);
        var collections = await dbContext.FinancePayments.AsNoTracking().ToListAsync(cancellationToken);
        var installments = await dbContext.FinanceInstallments.AsNoTracking().ToListAsync(cancellationToken);
        var nowUtc = DateTime.UtcNow;

        var totalRequests = notifications.Count * 8 + threads.Count * 12 + contents.Count * 6 + homework.Count * 5;
        var errorCount = installments.Count(x => x.Amount - x.PaidAmount > 0 && x.DueDateUtc < nowUtc);

        var aiModels = BuildAiModels(notifications.Count, threads.Count, homework.Count, contents.Count, meetings.Count);
        var aiLogs = BuildAiLogs(notifications, threads);
        var stats = new PlatformOverviewStatsDto(
            tenants.Count,
            tenants.Count(x => string.Equals(x.Status, "active", StringComparison.OrdinalIgnoreCase)),
            tenants.Sum(x => x.Users),
            collections.Sum(x => x.Amount),
            invoices.Where(x => !string.Equals(x.Status, "paid", StringComparison.OrdinalIgnoreCase) && !string.Equals(x.Status, "onaylandi", StringComparison.OrdinalIgnoreCase)).Sum(x => ParseDecimal(x.Amount)),
            installments.Where(x => x.Amount - x.PaidAmount > 0 && x.DueDateUtc < nowUtc).Sum(x => x.Amount - x.PaidAmount),
            tenants.Sum(x => x.Storage),
            tenants.Sum(x => x.Api),
            tickets.Count(x => string.Equals(x.Status, "open", StringComparison.OrdinalIgnoreCase)),
            invoices.Count,
            totalRequests,
            totalRequests > 0 ? decimal.Round(((decimal)(totalRequests - errorCount) / totalRequests) * 100, 1) : 100,
            decimal.Round(1.2m + Math.Min(1.8m, threads.Count * 0.04m), 1),
            decimal.Round(totalRequests * 0.0065m, 2));

        return new PlatformOverviewDto(
            stats,
            tenants.Take(4).ToList(),
            aiModels,
            aiLogs);
    }

    public async Task<IReadOnlyList<TenantWorkspaceDto>> GetTenantsAsync(CancellationToken cancellationToken = default)
    {
        var storedEntities = await dbContext.Set<TenantWorkspace>()
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        // Bekleyen/reddedilen başvurular ayrı tabloda durur ama platform yöneticisi
        // onları aynı listede görür: onay/red akışı ve iki paneldeki mevcut ekranlar
        // tek liste üzerinden çalışıyor. Onaylananlar burada YOK — onların karşılığı
        // artık gerçek kurum satırı.
        var applications = await dbContext.TenantRegistrationApplications
            .AsNoTracking()
            .Where(x => x.Status != "approved")
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        // Every application is visible to platform staff, with its verification state.
        var mapped = await MapTenantDtosAsync(storedEntities, cancellationToken);
        // Preserve the original application dates after approval without duplicating rows.
        var tenantIds = storedEntities.Select(x => x.Id).ToArray();
        var approvedApplications = await dbContext.TenantRegistrationApplications
            .AsNoTracking()
            .Where(x => x.Status == "approved" && x.CreatedTenantId != null && tenantIds.Contains(x.CreatedTenantId.Value))
            .Select(x => new { x.CreatedTenantId, x.CreatedAtUtc, x.VerifiedAtUtc })
            .ToListAsync(cancellationToken);
        var datesByTenant = approvedApplications.GroupBy(x => x.CreatedTenantId!.Value)
            .ToDictionary(x => x.Key, x => x.OrderByDescending(a => a.CreatedAtUtc).First());
        var enriched = mapped.Select(x => datesByTenant.TryGetValue(x.Id, out var dates)
            ? x with { RegistrationCreatedAtUtc = dates.CreatedAtUtc, VerifiedAtUtc = dates.VerifiedAtUtc }
            : x);
        return [.. applications.Select(ToApplicationDto), .. enriched];
    }

    public async Task<TenantWorkspaceDto> UpsertTenantAsync(Guid? id, UpsertTenantWorkspaceRequest request, CancellationToken cancellationToken = default)
    {
        var entity = id.HasValue
            ? await dbContext.Set<TenantWorkspace>().SingleOrDefaultAsync(x => x.Id == id.Value, cancellationToken)
            : null;

        if (entity is null)
        {
            entity = new TenantWorkspace();
            await dbContext.Set<TenantWorkspace>().AddAsync(entity, cancellationToken);
        }

        entity.Name = request.Name;
        entity.Slug = await GenerateUniqueSlugAsync(request.Name, id, cancellationToken);
        entity.ContactEmail = request.Email;
        entity.Plan = request.Plan;
        entity.Status = request.Status;
        entity.UserCount = request.Users;
        entity.BranchCount = request.Branches;
        entity.StudentCount = request.StudentCount;
        entity.StaffCount = request.StaffCount;
        entity.MonthlyFee = request.MonthlyFee;
        entity.CollectedAmount = request.Collected;
        entity.StorageUsedGb = request.Storage;
        entity.ApiUsage = request.Api;
        entity.InstitutionType = ParseInstitutionType(request.InstitutionType);
        entity.DrivingSchoolModuleEnabled = entity.InstitutionType == InstitutionType.DrivingSchool
            && request.DrivingSchoolModuleEnabled;

        await dbContext.SaveChangesAsync(cancellationToken);
        return ToTenantDto(entity);
    }

    public async Task<IReadOnlyList<SupportTicketDto>> GetSupportTicketsAsync(CancellationToken cancellationToken = default)
    {
        var storedEntities = await dbContext.Set<SupportTicket>()
            .AsNoTracking()
            .OrderBy(x => x.Status)
            .ThenByDescending(x => x.UpdatedAtUtc)
            .ToListAsync(cancellationToken);
        return storedEntities.Select(ToTicketDto).ToList();
    }

    public async Task<IReadOnlyList<SupportTicketDto>> GetSupportTicketsByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        if (tenantId == Guid.Empty) return Array.Empty<SupportTicketDto>();
        var rows = await dbContext.Set<SupportTicket>()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        return rows.Select(ToTicketDto).ToList();
    }

    public async Task<SupportTicketDto> CreateSupportTicketAsync(CreateSupportTicketRequest request, CancellationToken cancellationToken = default)
    {
        var entity = new SupportTicket
        {
            TicketNumber = $"SUP-{Guid.NewGuid():N}",
            TenantId = request.TenantId,
            CustomerNumber = request.CustomerNumber,
            ContactEmail = request.ContactEmail,
            Subject = request.Subject,
            TenantName = request.Tenant,
            RequestedBy = request.User,
            RequestedRole = request.UserRole,
            Category = request.Category,
            Priority = request.Priority,
            Status = "open",
            Summary = request.Summary,
            LastMessage = request.LastMessage,
            MessageCount = 1,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        await dbContext.Set<SupportTicket>().AddAsync(entity, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToTicketDto(entity);
    }

    public async Task<SupportTicketDto?> UpdateSupportTicketAsync(Guid id, UpdateSupportTicketRequest request, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.Set<SupportTicket>().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            entity.Status = request.Status;
        }

        if (!string.IsNullOrWhiteSpace(request.Priority))
        {
            entity.Priority = request.Priority;
        }

        if (!string.IsNullOrWhiteSpace(request.LastMessage))
        {
            entity.LastMessage = request.LastMessage;
        }

        if (request.Messages.HasValue)
        {
            entity.MessageCount = request.Messages.Value;
        }

        entity.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        bool? replySent = null;
        if (!string.IsNullOrWhiteSpace(request.LastMessage) && !string.IsNullOrWhiteSpace(entity.ContactEmail))
        {
            replySent = await emailSender.SendAsync(entity.ContactEmail, $"SchoolAsist destek — {entity.TicketNumber}",
                "<h2>Destek talebinize yanıt</h2><p>" + System.Net.WebUtility.HtmlEncode(entity.Subject)
                + "</p><p>" + System.Net.WebUtility.HtmlEncode(request.LastMessage).Replace("\n", "<br>") + "</p>", cancellationToken);
        }
        return ToTicketDto(entity) with { ReplyEmailSent = replySent };
    }

    /// <summary>
    /// Pazarlama sitesindeki ANONİM kurum kaydı. Kontroller ucuzdan pahalıya sıralıdır:
    /// biçim doğrulama → e-posta tekilleştirme/cooldown → günlük tavan → captcha → yazma.
    /// </summary>
    /// <remarks>
    /// IP bazlı rate limit (Program.cs "public-form") en iyi çaba düzeyindedir: ters
    /// vekil <c>X-Forwarded-For</c>'u ÜZERİNE YAZMADIĞI sürece başlık taklit edilebilir.
    /// Taklide karşı gerçekten ayakta kalan iki kontrol captcha ve e-posta cooldown'ıdır;
    /// günlük tavan bu yüzden meşru hacmin çok üstünde tutulur, yoksa tek saldırgan
    /// tavanı bir saniyede yakıp gerçek kurumların kaydını gün boyu engellerdi.
    /// </remarks>
    public async Task<RegisterTenantResult> RegisterTenantAsync(
        RegisterTenantRequest request,
        TenantRegistrationContext context,
        CancellationToken cancellationToken = default)
    {
        var registrationEnabled = configuration.GetValue<bool?>("Registration:Enabled")
            ?? !environment.IsProduction();
        if (!registrationEnabled)
        {
            logger.LogInformation("Halka açık kurum kaydı yapılandırma gereği kapalı.");
            return new RegisterTenantResult(TenantRegistrationOutcome.Disabled);
        }

        var validation = ValidateRegistration(request, BillingEnabled);
        if (validation.Error is not null)
        {
            return new RegisterTenantResult(TenantRegistrationOutcome.Invalid, validation.Error);
        }

        var normalizedEmail = validation.Email;

        // İstemci IP'si TEK yerde normalize edilir: kara liste karşılaştırması, satıra
        // yazılan değer ve şüphe sayımı aynı dizeyi kullanmalı. Üç ayrı ifade kullanmak
        // IPv6'da (büyük/küçük harf) sessiz eşleşmeme üretirdi.
        var clientIp = Truncate(context.IpAddress?.Trim(), 64)?.ToLowerInvariant();

        // Kara liste: engellenen alan adı/IP sessizce yutulur. Reddedildiğini belli
        // etmek, saldırgana hangi alan adının engellendiğini deneyerek öğretirdi.
        var emailDomain = normalizedEmail[(normalizedEmail.IndexOf('@') + 1)..];
        var blocked = await dbContext.RegistrationBlocklistEntries
            .AsNoTracking()
            .AnyAsync(
                x => (x.Kind == "domain" && x.Value == emailDomain)
                     || (x.Kind == "ip" && clientIp != null && x.Value == clientIp),
                cancellationToken);

        if (blocked)
        {
            logger.LogInformation(
                "Kurum kaydı kara liste nedeniyle yutuldu. Alan={Domain} Ip={Ip}",
                emailDomain,
                context.IpAddress);
            return new RegisterTenantResult(TenantRegistrationOutcome.Blocked);
        }

        var cooldownHours = configuration.GetValue<int?>("Registration:EmailCooldownHours") ?? 24;
        var cooldownStart = DateTime.UtcNow.AddHours(-Math.Abs(cooldownHours));

        // Aynı e-posta ile bekleyen başvuru ya da etkin kurum varsa sessizce yut.
        // Çağırana yine 202 döneceğiz; "bu e-posta zaten kayıtlı" demek kayıt
        // varlığını sızdırırdı.
        var duplicatePending = await dbContext.TenantRegistrationApplications
            .FirstOrDefaultAsync(
                x => x.ContactEmailNormalized == normalizedEmail
                     && x.Status == "pending"
                     && x.CreatedAtUtc >= cooldownStart,
                cancellationToken);

        var duplicateTenant = await dbContext.Set<TenantWorkspace>()
            .AsNoTracking()
            .AnyAsync(x => x.ContactEmail.ToLower() == normalizedEmail && x.Status == "active", cancellationToken);

        var duplicate = duplicatePending is not null || duplicateTenant;

        if (duplicate)
        {
            if (duplicatePending is not null
                && duplicatePending.VerifiedAtUtc is null
                && (duplicatePending.VerificationSentAtUtc is null
                    || duplicatePending.VerificationExpiresAtUtc <= DateTime.UtcNow))
            {
                await TryRotateExpiredContactVerificationAsync(duplicatePending, cancellationToken);
            }

            logger.LogInformation(
                "Kurum kaydı yinelenen başvuru olarak yutuldu. Ip={Ip} Ua={UserAgent}",
                context.IpAddress,
                context.UserAgent);
            return new RegisterTenantResult(TenantRegistrationOutcome.Duplicate);
        }

        var dayStart = DateTime.UtcNow.Date;
        var todayCount = await dbContext.TenantRegistrationApplications
            .AsNoTracking()
            .CountAsync(x => x.CreatedAtUtc >= dayStart, cancellationToken);

        var alertThreshold = configuration.GetValue<int?>("Registration:DailyAlertThreshold") ?? 50;
        var hardLimit = configuration.GetValue<int?>("Registration:DailyHardLimit") ?? 500;

        if (todayCount >= hardLimit)
        {
            logger.LogCritical(
                "Kurum kaydı günlük sert tavanı aşıldı ({Count}/{Limit}). Başvurular geçici olarak reddediliyor.",
                todayCount,
                hardLimit);
            return new RegisterTenantResult(TenantRegistrationOutcome.Throttled);
        }

        // Eşit değil, "aşıldı mı": eşzamanlı iki insert sayacı eşik değerinin
        // üstüne atlatabilir ve uyarı hiç düşmezdi.
        if (todayCount >= alertThreshold)
        {
            logger.LogWarning(
                "Kurum kaydı günlük uyarı eşiği aşıldı ({Count}/{Threshold}). Kötüye kullanım olabilir, kuyruk gözden geçirilmeli.",
                todayCount,
                alertThreshold);

            await NotifyRegistrationBurstAsync(todayCount, alertThreshold, cancellationToken);
        }

        var captcha = await captchaVerification.VerifyAsync(request.CaptchaToken, context.IpAddress, cancellationToken);
        if (!captcha.IsAllowed)
        {
            logger.LogInformation(
                "Kurum kaydı captcha nedeniyle reddedildi. Ip={Ip} Detay={Detail}",
                context.IpAddress,
                captcha.Detail);
            return new RegisterTenantResult(
                TenantRegistrationOutcome.CaptchaFailed,
                captcha.Detail ?? "Doğrulama başarısız.");
        }

        // Kurum satırı ONAYDA üretilir. Anonim girdi hiçbir zaman tenant_workspaces'e
        // yazılmaz: slug ad alanı, platform sayaçları ve kurum sorguları başvurulardan
        // tamamen izole kalır.
        var entity = new TenantRegistrationApplication
        {
            InstitutionName = validation.InstitutionName,
            ContactName = validation.ContactName,
            ContactEmail = validation.Email,
            ContactEmailNormalized = normalizedEmail,
            ContactPhone = validation.Phone,
            Plan = validation.Plan,
            InstitutionType = validation.InstitutionType,
            EstimatedStudents = request.EstimatedStudents,
            MebCode = validation.Extended?.MebCode,
            TaxOffice = validation.Extended?.TaxOffice,
            TaxNumber = validation.Extended?.TaxNumber,
            City = validation.Extended?.City,
            District = validation.Extended?.District,
            AddressLine = validation.Extended?.AddressLine,
            PostalCode = validation.Extended?.PostalCode,
            InstitutionPhone = validation.Extended?.InstitutionPhone,
            InstitutionEmail = validation.Extended?.InstitutionEmail,
            Website = validation.Extended?.Website,
            ContactTitle = validation.Extended?.ContactTitle,
            Status = "pending",
            RegistrationIp = clientIp,
            RegistrationUserAgent = Truncate(context.UserAgent, 300),
            RegistrationReferer = Truncate(context.Referer, 300),
            KvkkConsentVersion = CurrentKvkkConsentVersion,
            KvkkConsentAtUtc = DateTime.UtcNow,
            CreatedAtUtc = DateTime.UtcNow,
        };

        var suspicion = await DetectSuspicionAsync(clientIp, captcha.Status, cancellationToken);
        entity.IsSuspicious = suspicion is not null;
        entity.SuspiciousReason = suspicion;

        await dbContext.TenantRegistrationApplications.AddAsync(entity, cancellationToken);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Filtreli benzersiz indeks: iki istek cooldown kontrolünü aynı anda
            // geçtiğinde ikincisi burada durur. Çağırana yine yinelenen davranışı.
            dbContext.Entry(entity).State = EntityState.Detached;
            logger.LogInformation("Kurum kaydı eşzamanlı yinelenen başvuru olarak reddedildi. Ip={Ip}", context.IpAddress);
            return new RegisterTenantResult(TenantRegistrationOutcome.Duplicate);
        }

        await StartContactVerificationAsync(entity, cancellationToken);

        logger.LogInformation(
            "Kurum kaydı başvurusu alındı. Id={Id} Tur={Type} Ip={Ip} Ua={UserAgent} Referer={Referer} Captcha={Captcha}",
            entity.Id,
            entity.InstitutionType,
            context.IpAddress,
            context.UserAgent,
            context.Referer,
            captcha.Status);

        return new RegisterTenantResult(TenantRegistrationOutcome.Accepted);
    }

    private sealed record ExtendedInstitutionInfo(
        string? MebCode, string? TaxOffice, string? TaxNumber,
        string? City, string? District, string? AddressLine, string? PostalCode,
        string? InstitutionPhone, string? InstitutionEmail, string? Website, string? ContactTitle);

    private sealed record RegistrationValidation(
        string? Error,
        string InstitutionName = "",
        string ContactName = "",
        string Email = "",
        string? Phone = null,
        string Plan = "",
        InstitutionType InstitutionType = InstitutionType.PrivateSchool,
        ExtendedInstitutionInfo? Extended = null);

    private static RegistrationValidation ValidateRegistration(RegisterTenantRequest request, bool billingEnabled)
    {
        if (!request.KvkkAccepted)
        {
            return new RegistrationValidation("Devam etmek için aydınlatma metnini onaylamanız gerekir.");
        }

        var institutionName = Sanitize(request.InstitutionName);
        if (institutionName.Length is < 3 or > 150)
        {
            return new RegistrationValidation("Kurum adı 3-150 karakter olmalıdır.");
        }

        var contactName = Sanitize(request.ContactName);
        if (contactName.Length is < 3 or > 150)
        {
            return new RegistrationValidation("Yetkili adı 3-150 karakter olmalıdır.");
        }

        // Küçültme INVARIANT kültürle: tr-TR'de "I" → "ı" olur ve aynı e-posta
        // istemcinin diline göre farklı normalize edilirdi.
        var email = Sanitize(request.Email).ToLowerInvariant();
        if (email.Length is < 6 or > 180 || !EmailPattern.IsMatch(email))
        {
            return new RegistrationValidation("Geçerli bir e-posta adresi girin.");
        }

        string? phone = null;
        var rawPhone = Sanitize(request.Phone);
        if (rawPhone.Length > 0)
        {
            var digits = new string(rawPhone.Where(char.IsDigit).ToArray());
            if (digits.Length is < 10 or > 15)
            {
                return new RegistrationValidation("Geçerli bir telefon numarası girin.");
            }
            phone = rawPhone.Length > 40 ? rawPhone[..40] : rawPhone;
        }

        // Ücretsiz dönemde plan istemciden ALINMAZ: boş plan, EntitlementService'te
        // paket kısıtı olmadan (tüm modüller açık) çözülür. Eski istemcilerin
        // gönderdiği plan değeri de yok sayılır ki kimse ücretli pakete düşmesin.
        var plan = string.Empty;
        if (billingEnabled)
        {
            var selected = PublicPlans.FirstOrDefault(x => string.Equals(x, Sanitize(request.Plan), StringComparison.OrdinalIgnoreCase));
            if (selected is null)
            {
                return new RegistrationValidation("Geçersiz plan seçimi.");
            }
            plan = selected;
        }

        if (request.EstimatedStudents is < 1 or > 100_000)
        {
            return new RegistrationValidation("Tahmini öğrenci sayısı 1-100.000 aralığında olmalıdır.");
        }

        if (!Enum.TryParse<InstitutionType>(request.InstitutionType, true, out var institutionType)
            || !Enum.IsDefined(institutionType))
        {
            return new RegistrationValidation("Geçersiz kurum türü.");
        }

        // Sürücü kursları ayrı ürün (DrivingAsist) üzerinden kaydolur.
        if (institutionType == InstitutionType.DrivingSchool)
        {
            return new RegistrationValidation("Sürücü kursu kayıtları DrivingAsist üzerinden alınmaktadır.");
        }

        // Genişletilmiş alanlar opsiyoneldir; dolu gelenler biçim/checksum doğrulamasından
        // geçer. Geçersiz bir alan varsa tüm başvuru reddedilir (istemci de doğrular).
        ExtendedInstitutionInfo extended;
        try
        {
            extended = new ExtendedInstitutionInfo(
                InstitutionFieldRules.NormalizeMebCode(request.MebCode),
                InstitutionFieldRules.NormalizeText(request.TaxOffice, 120, label: "Vergi dairesi"),
                InstitutionFieldRules.NormalizeTaxNumber(request.TaxNumber),
                InstitutionFieldRules.NormalizeProvince(request.City),
                InstitutionFieldRules.NormalizeText(request.District, 80, label: "İlçe"),
                InstitutionFieldRules.NormalizeText(request.AddressLine, 400, label: "Adres"),
                InstitutionFieldRules.NormalizePostalCode(request.PostalCode),
                InstitutionFieldRules.NormalizeInstitutionPhone(request.InstitutionPhone),
                InstitutionFieldRules.NormalizeEmail(request.InstitutionEmail, label: "Kurum e-postası"),
                InstitutionFieldRules.NormalizeWebsite(request.Website),
                InstitutionFieldRules.NormalizeText(request.ContactTitle, 80, label: "Yetkili görevi"));
        }
        catch (InvalidOperationException ex)
        {
            return new RegistrationValidation(ex.Message);
        }

        return new RegistrationValidation(null, institutionName, contactName, email, phone, plan, institutionType, extended);
    }

    /// <summary>Kontrol karakterlerini atar, kırpar. Serbest metin alanları için.</summary>
    private static string Sanitize(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : new string(value.Where(ch => !char.IsControl(ch)).ToArray()).Trim();

    private static string? Truncate(string? value, int maxLength)
        => string.IsNullOrWhiteSpace(value)
            ? null
            : value.Length <= maxLength ? value : value[..maxLength];

    public async Task<TenantWorkspaceDto?> ApproveTenantAsync(Guid id, CancellationToken cancellationToken = default)
    {
        // Approved applications are deliberately retained. A retry after a lost
        // approval response rotates and redelivers bootstrap credentials without
        // creating a second tenant.
        var application = await dbContext.TenantRegistrationApplications
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (application is not null)
        {
            if (application.Status == "approved" && application.CreatedTenantId is Guid createdTenantId)
            {
                var recovered = await RegenerateSetupDocumentAsync(createdTenantId, cancellationToken);
                return recovered.Outcome == SetupDocumentOutcome.Ready ? recovered.Tenant : null;
            }

            return await ApproveApplicationAsync(application, cancellationToken);
        }

        var entity = await dbContext.Set<TenantWorkspace>().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        entity.Status = "active";
        entity.ApprovedAtUtc ??= DateTime.UtcNow;

        // Eski (P1 öncesi) bekleyen kurum satırları için: okunabilir slug onayda üretilir.
        if (entity.Slug.StartsWith("pending-", StringComparison.Ordinal))
        {
            entity.Slug = await GenerateUniqueSlugAsync(entity.Name, entity.Id, cancellationToken);
        }

        AppUser? adminUser = null;
        if (entity.AdminUserId.HasValue)
        {
            adminUser = await dbContext.Users.SingleOrDefaultAsync(x => x.Id == entity.AdminUserId.Value, cancellationToken);
        }

        string? temporaryPassword = null;
        if (adminUser is null)
        {
            var created = await CreateTenantAdminUserAsync(entity, cancellationToken);
            adminUser = created.User;
            temporaryPassword = created.TemporaryPassword;
            entity.AdminUserId = adminUser.Id;
            entity.UserCount = Math.Max(entity.UserCount, 1);
            entity.PendingAdminPasswordHash = null;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await SendApprovalEmailAsync(entity, adminUser, temporaryPassword, cancellationToken);
        return ToTenantDto(entity, adminUser.Username, temporaryPassword);
    }

    public async Task<TenantWorkspaceDto?> RejectTenantAsync(Guid id, string? reason = null, CancellationToken cancellationToken = default)
    {
        var application = await dbContext.TenantRegistrationApplications
            .SingleOrDefaultAsync(x => x.Id == id && x.Status != "approved", cancellationToken);

        if (application is not null)
        {
            var rejectedAt = DateTime.UtcNow;
            var rejectionReason = string.IsNullOrWhiteSpace(reason) ? null : Truncate(reason.Trim(), 500);
            var affected = await dbContext.TenantRegistrationApplications
                .Where(a => a.Id == id && (a.Status == "pending" || a.Status == "rejected"))
                .ExecuteUpdateAsync(setters => setters.SetProperty(a => a.Status, "rejected")
                    .SetProperty(a => a.RejectedAtUtc, rejectedAt)
                    .SetProperty(a => a.RejectionReason, rejectionReason), cancellationToken);
            if (affected == 0) return null;
            await dbContext.Entry(application).ReloadAsync(cancellationToken);
            return ToApplicationDto(application);
        }

        var entity = await dbContext.Set<TenantWorkspace>().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        entity.Status = "rejected";
        entity.RejectedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToTenantDto(entity);
    }

    public async Task<bool> DeleteTenantAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var application = await dbContext.TenantRegistrationApplications
            .SingleOrDefaultAsync(x => x.Id == id && x.Status != "approved", cancellationToken);

        if (application is not null)
        {
            // Başvurunun altında hiç veri yok; satırı silmek yeterli.
            dbContext.TenantRegistrationApplications.Remove(application);
            await dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }

        var tenant = await dbContext.Set<TenantWorkspace>()
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (tenant is null)
        {
            return false;
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var tenantUserIds = await dbContext.Users
            .IgnoreQueryFilters()
            .Where(x => x.TenantId == id)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        if (tenantUserIds.Count > 0)
        {
            await dbContext.RefreshTokenSessions
                .Where(x => tenantUserIds.Contains(x.UserId))
                .ExecuteDeleteAsync(cancellationToken);

            await dbContext.Set<AuthorizationCode>()
                .Where(x => tenantUserIds.Contains(x.UserId))
                .ExecuteDeleteAsync(cancellationToken);

            await dbContext.LoginAttempts
                .Where(x => x.UserId.HasValue && tenantUserIds.Contains(x.UserId.Value))
                .ExecuteDeleteAsync(cancellationToken);
        }

        await DeleteTenantScopedAsync<AccountingApproval>(id, cancellationToken);
        await DeleteTenantScopedAsync<AccountingAuditLog>(id, cancellationToken);
        await DeleteTenantScopedAsync<FinancePayment>(id, cancellationToken);
        await DeleteTenantScopedAsync<FinanceInstallment>(id, cancellationToken);
        await DeleteTenantScopedAsync<EnrollmentContract>(id, cancellationToken);
        await DeleteTenantScopedAsync<AccountingInvoice>(id, cancellationToken);
        await DeleteTenantScopedAsync<AccountingNotification>(id, cancellationToken);
        await DeleteTenantScopedAsync<AccountingSalary>(id, cancellationToken);
        await DeleteTenantScopedAsync<AnnouncementItem>(id, cancellationToken);
        await DeleteTenantScopedAsync<AttendanceEntry>(id, cancellationToken);
        await DeleteTenantScopedAsync<ContentItem>(id, cancellationToken);
        await DeleteTenantScopedAsync<ExamResult>(id, cancellationToken);
        await DeleteTenantScopedAsync<HomeworkSubmission>(id, cancellationToken);
        await DeleteTenantScopedAsync<HomeworkAssignment>(id, cancellationToken);
        await DeleteTenantScopedAsync<MeetingRequest>(id, cancellationToken);
        await DeleteTenantScopedAsync<MessageItem>(id, cancellationToken);
        await DeleteTenantScopedAsync<MessageThread>(id, cancellationToken);
        await DeleteTenantScopedAsync<NotificationItem>(id, cancellationToken);
        await DeleteTenantScopedAsync<PlatformConfiguration>(id, cancellationToken);
        await DeleteTenantScopedAsync<QuestionPracticeAttempt>(id, cancellationToken);
        await DeleteTenantScopedAsync<QuestionBankItem>(id, cancellationToken);
        await DeleteTenantScopedAsync<SiteContentItem>(id, cancellationToken);
        await DeleteTenantScopedAsync<StaffProfile>(id, cancellationToken);
        await DeleteTenantScopedAsync<StudentQuestionReply>(id, cancellationToken);
        await DeleteTenantScopedAsync<StudentQuestionThread>(id, cancellationToken);
        await DeleteTenantScopedAsync<StudyPlanState>(id, cancellationToken);
        await DeleteTenantScopedAsync<StudentProfile>(id, cancellationToken);
        await DeleteTenantScopedAsync<AppUser>(id, cancellationToken);

        await dbContext.Set<PlatformSubscriptionInvoice>()
            .Where(x => x.TenantId == id)
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.Set<SupportTicket>()
            .Where(x => x.TenantName == tenant.Name)
            .ExecuteDeleteAsync(cancellationToken);

        var deleted = await dbContext.Set<TenantWorkspace>()
            .Where(x => x.Id == id)
            .ExecuteDeleteAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);
        return deleted > 0;
    }

    public async Task<ResetTenantDataResult?> ResetTenantDataAsync(
        Guid id,
        string preserveUsername,
        CancellationToken cancellationToken = default)
    {
        var tenant = await dbContext.Set<TenantWorkspace>()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (tenant is null)
        {
            return null;
        }

        var normalizedUsername = preserveUsername.Trim();
        var preservedUser = await dbContext.Users
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(
                x => x.TenantId == id
                     && x.Username == normalizedUsername
                     && x.PrimaryRole == UserRole.Admin,
                cancellationToken);
        if (preservedUser is null)
        {
            throw new InvalidOperationException(
                $"Korunacak aktif kurum yöneticisi bulunamadı: {normalizedUsername}");
        }

        var preservedContentCount = await dbContext.ContentItems
            .IgnoreQueryFilters()
            .CountAsync(x => x.TenantId == id, cancellationToken);
        var preservedQuestionCount = await dbContext.QuestionBankItems
            .IgnoreQueryFilters()
            .CountAsync(x => x.TenantId == id, cancellationToken);
        var usersToDelete = await dbContext.Users
            .IgnoreQueryFilters()
            .Where(x => x.TenantId == id && x.Id != preservedUser.Id)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        var preservedTypes = new HashSet<Type>
        {
            typeof(ContentItem),
            typeof(QuestionBankItem),
            typeof(AppUser)
        };
        var tenantTables = GetTenantScopedTables(preservedTypes);
        var orderedTables = OrderTenantTablesForDeletion(tenantTables);
        var deletedByTable = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var dbTransaction = transaction.GetDbTransaction();
        var connection = (NpgsqlConnection)dbContext.Database.GetDbConnection();

        foreach (var table in orderedTables)
        {
            var deleted = await DeleteTenantRowsAsync(
                connection,
                dbTransaction,
                table,
                id,
                cancellationToken);
            if (deleted > 0)
            {
                deletedByTable[table.Name] = deleted;
            }
        }

        if (usersToDelete.Count > 0)
        {
            foreach (var dependency in GetDirectUserDependencies())
            {
                var deleted = await DeleteUserDependenciesAsync(
                    connection,
                    dbTransaction,
                    dependency,
                    usersToDelete,
                    cancellationToken);
                if (deleted > 0)
                {
                    deletedByTable[dependency.Name] =
                        deletedByTable.GetValueOrDefault(dependency.Name) + deleted;
                }
            }

            var usersTable = GetMappedTable(typeof(AppUser), nameof(AppUser.TenantId));
            var deletedUsers = await DeleteOtherTenantUsersAsync(
                connection,
                dbTransaction,
                usersTable,
                id,
                preservedUser.Id,
                cancellationToken);
            if (deletedUsers > 0)
            {
                deletedByTable[usersTable.Name] =
                    deletedByTable.GetValueOrDefault(usersTable.Name) + deletedUsers;
            }
        }

        tenant.AdminUserId = preservedUser.Id;
        tenant.UserCount = 1;
        tenant.BranchCount = 0;
        tenant.StudentCount = 0;
        tenant.StaffCount = 0;
        tenant.CollectedAmount = 0;
        tenant.StorageUsedGb = 0;
        tenant.ApiUsage = 0;
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var deletedRecordCount = deletedByTable.Values.Sum();
        return new ResetTenantDataResult(
            id,
            tenant.Name,
            preservedUser.Username,
            preservedContentCount,
            preservedQuestionCount,
            usersToDelete.Count,
            deletedRecordCount,
            deletedByTable);
    }

    private async Task<IReadOnlyList<TenantWorkspaceDto>> MapTenantDtosAsync(IReadOnlyList<TenantWorkspace> entities, CancellationToken cancellationToken)
    {
        var adminUserIds = entities
            .Where(x => x.AdminUserId.HasValue)
            .Select(x => x.AdminUserId!.Value)
            .Distinct()
            .ToList();

        Dictionary<Guid, string> adminUsernames = [];
        if (adminUserIds.Count > 0)
        {
            adminUsernames = await dbContext.Users
                .AsNoTracking()
                .Where(x => adminUserIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.Username, cancellationToken);
        }

        return entities
            .Select(entity =>
            {
                var adminUsername = entity.AdminUserId.HasValue && adminUsernames.TryGetValue(entity.AdminUserId.Value, out var resolvedUsername)
                    ? resolvedUsername
                    : null;
                return ToTenantDto(entity, adminUsername);
            })
            .ToList();
    }

    private Task<int> DeleteTenantScopedAsync<TEntity>(Guid tenantId, CancellationToken cancellationToken)
        where TEntity : class, ITenantScopedEntity
    {
        return dbContext.Set<TEntity>()
            .IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId)
            .ExecuteDeleteAsync(cancellationToken);
    }

    private IReadOnlyList<MappedTable> GetTenantScopedTables(IReadOnlySet<Type> preservedTypes)
    {
        return dbContext.Model.GetEntityTypes()
            .Where(entityType =>
                typeof(ITenantScopedEntity).IsAssignableFrom(entityType.ClrType)
                && !preservedTypes.Contains(entityType.ClrType))
            .Select(entityType => TryGetMappedTable(entityType, nameof(ITenantScopedEntity.TenantId)))
            .Where(table => table is not null)
            .Select(table => table!)
            .DistinctBy(table => table.Key)
            .ToList();
    }

    private IReadOnlyList<MappedTable> OrderTenantTablesForDeletion(IReadOnlyList<MappedTable> tables)
    {
        var byKey = tables.ToDictionary(table => table.Key);
        var edges = tables.ToDictionary(table => table.Key, _ => new HashSet<string>());
        var incoming = tables.ToDictionary(table => table.Key, _ => 0);

        foreach (var entityType in dbContext.Model.GetEntityTypes())
        {
            var dependent = TryGetMappedTable(entityType, nameof(ITenantScopedEntity.TenantId));
            if (dependent is null || !byKey.ContainsKey(dependent.Key))
            {
                continue;
            }

            foreach (var foreignKey in entityType.GetForeignKeys())
            {
                var principal = TryGetMappedTable(
                    foreignKey.PrincipalEntityType,
                    nameof(ITenantScopedEntity.TenantId));
                if (principal is null
                    || principal.Key == dependent.Key
                    || !byKey.ContainsKey(principal.Key)
                    || !edges[dependent.Key].Add(principal.Key))
                {
                    continue;
                }

                incoming[principal.Key]++;
            }
        }

        var queue = new Queue<string>(incoming.Where(item => item.Value == 0).Select(item => item.Key));
        var ordered = new List<MappedTable>(tables.Count);
        while (queue.TryDequeue(out var key))
        {
            ordered.Add(byKey[key]);
            foreach (var principalKey in edges[key])
            {
                incoming[principalKey]--;
                if (incoming[principalKey] == 0)
                {
                    queue.Enqueue(principalKey);
                }
            }
        }

        foreach (var table in tables.Where(table => ordered.All(item => item.Key != table.Key)))
        {
            ordered.Add(table);
        }

        return ordered;
    }

    private IReadOnlyList<UserDependency> GetDirectUserDependencies()
    {
        var userEntity = dbContext.Model.FindEntityType(typeof(AppUser))
            ?? throw new InvalidOperationException("AppUser eşlemesi bulunamadı.");
        var dependencies = new List<UserDependency>();

        foreach (var foreignKey in dbContext.Model.GetEntityTypes()
                     .SelectMany(entityType => entityType.GetForeignKeys())
                     .Where(foreignKey => foreignKey.PrincipalEntityType == userEntity
                                          && foreignKey.Properties.Count == 1))
        {
            var tableName = foreignKey.DeclaringEntityType.GetTableName();
            if (string.IsNullOrWhiteSpace(tableName))
            {
                continue;
            }

            var schema = foreignKey.DeclaringEntityType.GetSchema() ?? "public";
            var store = StoreObjectIdentifier.Table(tableName, schema);
            var column = foreignKey.Properties[0].GetColumnName(store);
            if (!string.IsNullOrWhiteSpace(column))
            {
                dependencies.Add(new UserDependency(schema, tableName, column));
            }
        }

        return dependencies.DistinctBy(item => item.Key).ToList();
    }

    private MappedTable GetMappedTable(Type clrType, string tenantProperty)
    {
        var entityType = dbContext.Model.FindEntityType(clrType)
            ?? throw new InvalidOperationException($"{clrType.Name} eşlemesi bulunamadı.");
        return TryGetMappedTable(entityType, tenantProperty)
            ?? throw new InvalidOperationException($"{clrType.Name} tablo eşlemesi bulunamadı.");
    }

    private static MappedTable? TryGetMappedTable(IEntityType entityType, string tenantProperty)
    {
        var tableName = entityType.GetTableName();
        if (string.IsNullOrWhiteSpace(tableName))
        {
            return null;
        }

        var schema = entityType.GetSchema() ?? "public";
        var store = StoreObjectIdentifier.Table(tableName, schema);
        var property = entityType.FindProperty(tenantProperty);
        var column = property?.GetColumnName(store);
        return string.IsNullOrWhiteSpace(column)
            ? null
            : new MappedTable(schema, tableName, column);
    }

    private static async Task<int> DeleteTenantRowsAsync(
        NpgsqlConnection connection,
        System.Data.Common.DbTransaction transaction,
        MappedTable table,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = (NpgsqlTransaction)transaction;
        command.CommandText =
            $"DELETE FROM {Quote(table.Schema)}.{Quote(table.Name)} WHERE {Quote(table.TenantColumn)} = @tenantId";
        command.Parameters.AddWithValue("tenantId", tenantId);
        return await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<int> DeleteUserDependenciesAsync(
        NpgsqlConnection connection,
        System.Data.Common.DbTransaction transaction,
        UserDependency dependency,
        IReadOnlyList<Guid> userIds,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = (NpgsqlTransaction)transaction;
        command.CommandText =
            $"DELETE FROM {Quote(dependency.Schema)}.{Quote(dependency.Name)} " +
            $"WHERE {Quote(dependency.UserColumn)} = ANY(@userIds)";
        command.Parameters.AddWithValue("userIds", userIds.ToArray());
        return await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<int> DeleteOtherTenantUsersAsync(
        NpgsqlConnection connection,
        System.Data.Common.DbTransaction transaction,
        MappedTable usersTable,
        Guid tenantId,
        Guid preservedUserId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = (NpgsqlTransaction)transaction;
        command.CommandText =
            $"DELETE FROM {Quote(usersTable.Schema)}.{Quote(usersTable.Name)} " +
            $"WHERE {Quote(usersTable.TenantColumn)} = @tenantId AND {Quote("id")} <> @preservedUserId";
        command.Parameters.AddWithValue("tenantId", tenantId);
        command.Parameters.AddWithValue("preservedUserId", preservedUserId);
        return await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static string Quote(string identifier) => $"\"{identifier.Replace("\"", "\"\"")}\"";

    private sealed record MappedTable(string Schema, string Name, string TenantColumn)
    {
        public string Key => $"{Schema}.{Name}";
    }

    private sealed record UserDependency(string Schema, string Name, string UserColumn)
    {
        public string Key => $"{Schema}.{Name}.{UserColumn}";
    }

    /// <summary>
    /// Kurulum belgesini yeniden üretir: yeni geçici parola, eski parola geçersiz.
    /// </summary>
    /// <remarks>
    /// Kurum yöneticisi KENDİ parolasını belirlemişse reddedilir — bu noktadan sonra
    /// "belge yenilemek" aslında kurumun parolasını habersiz sıfırlamak olurdu. O
    /// durumun doğru yolu parola sıfırlama akışıdır.
    /// </remarks>
    public async Task<SetupDocumentResult> RegenerateSetupDocumentAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        var tenant = await dbContext.Set<TenantWorkspace>()
            .SingleOrDefaultAsync(x => x.Id == tenantId, cancellationToken);

        if (tenant?.AdminUserId is null)
        {
            return new SetupDocumentResult(SetupDocumentOutcome.NotFound);
        }

        var adminUser = await dbContext.Users
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(x => x.Id == tenant.AdminUserId.Value, cancellationToken);

        if (adminUser is null)
        {
            return new SetupDocumentResult(SetupDocumentOutcome.NotFound);
        }

        if (!adminUser.MustChangePassword)
        {
            return new SetupDocumentResult(SetupDocumentOutcome.AlreadyActivated);
        }

        var temporaryPassword = PasswordGenerator.Generate(10);
        adminUser.PasswordHash = passwordHasher.Hash(temporaryPassword);
        adminUser.MustChangePassword = true;
        adminUser.SecurityVersion++;
        adminUser.TemporaryPasswordExpiresAtUtc = DateTime.UtcNow.AddDays(
            configuration.GetValue<int?>("Registration:TemporaryPasswordValidDays") ?? 7);

        // Eski belgeyle açılmış oturumlar da düşsün: parola değişti.
        var sessions = await dbContext.RefreshTokenSessions
            .Where(x => x.UserId == adminUser.Id && x.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);
        foreach (var session in sessions)
        {
            session.RevokedAtUtc = DateTime.UtcNow;
        }

        var document = BuildSetupDocument(tenant, adminUser, temporaryPassword);

        if (emailDelivery is null) await dbContext.SaveChangesAsync(cancellationToken);
        await SendApprovalEmailAsync(tenant, adminUser, temporaryPassword, cancellationToken);

        await auditLog.LogAsync(
            "Kurum kurulum belgesi yeniden üretildi",
            "Platform",
            nameof(TenantWorkspace),
            tenant.Id.ToString(),
            $"{tenant.Name} · {adminUser.Username} · eski parola geçersiz kılındı",
            cancellationToken);

        return new SetupDocumentResult(
            SetupDocumentOutcome.Ready,
            ToTenantDto(
                tenant,
                adminUser.Username,
                temporaryPassword,
                adminUser.TemporaryPasswordExpiresAtUtc,
                document.Base64,
                document.FileName));
    }

    private async Task SendApprovalEmailAsync(TenantWorkspace tenant, AppUser admin, string? password, CancellationToken ct)
    {
        static string E(string? value) => System.Net.WebUtility.HtmlEncode(value ?? "");
        var downloadUrl = RegistrationUrl("Registration:ApplicationDownloadUrl", "https://schoolasist.com/indir");
        var credentials = password is null ? "<p>Mevcut parolanızla giriş yapabilirsiniz.</p>"
            : $"<p>Geçici parolanız: <strong>{E(password)}</strong></p><p>İlk girişte parolanızı değiştirin. Son kullanım: {admin.TemporaryPasswordExpiresAtUtc:dd.MM.yyyy HH:mm} UTC.</p>";
        var html = $"<h2>Kurumunuz onaylandı</h2><p>{E(tenant.Name)}, SchoolAsist'e hoş geldiniz.</p>"
            + $"<p>Müşteri numaranız: <strong>{E(tenant.CustomerNumber)}</strong></p>"
            + $"<p>Kullanıcı adınız: <strong>{E(admin.Username)}</strong></p>{credentials}"
            + "<p>Hesabınıza SchoolAsist masaüstü veya mobil uygulamasından giriş yapın.</p>"
            + $"<p><a href=\"{E(downloadUrl)}\">Masaüstü ve mobil uygulamaları indirin</a></p><p>Ücretsiz kullanım için paket seçmeniz veya ödeme yapmanız gerekmez.</p>";
        html = OnboardingEmailTemplate.Wrap("Kurumunuz onaylandı", html);
        if (emailDelivery is not null && password is not null)
        {
            tenant.ApprovalEmailSentAtUtc = null;
            emailDelivery.Queue($"approval:{admin.Id}:{admin.SecurityVersion}", "approval", admin.Id,
                admin.SecurityVersion.ToString(), admin.TemporaryPasswordExpiresAtUtc ?? DateTime.UtcNow.AddDays(7),
                tenant.ContactEmail, "SchoolAsist — Kurumunuz onaylandı", html);
            await dbContext.SaveChangesAsync(ct);
            await TryDispatchOnboardingAsync(ct);
            // Dispatcher uses ExecuteUpdate; refresh delivery status without overwriting tracked fields.
            if (dbContext.Database.CurrentTransaction is null) await dbContext.Entry(tenant).ReloadAsync(ct);
            return;
        }
        var sent = emailSender.IsConfigured && await emailSender.SendAsync(tenant.ContactEmail,
            "SchoolAsist — Kurumunuz onaylandı", html, ct);
        tenant.ApprovalEmailSentAtUtc = sent ? DateTime.UtcNow : null;
        await dbContext.SaveChangesAsync(ct);
        if (!sent) logger.LogWarning("Kurum onay e-postası gönderilemedi. KurumId={TenantId}", tenant.Id);
    }

    private (string Base64, string FileName) BuildSetupDocument(
        TenantWorkspace tenant,
        AppUser adminUser,
        string temporaryPassword)
    {
        var bytes = setupDocumentService.Generate(new TenantSetupDocumentModel(
            tenant.Name,
            tenant.Plan,
            tenant.InstitutionType.ToString(),
            RegistrationUrl("Registration:ApplicationDownloadUrl", "https://schoolasist.com/indir"),
            adminUser.Username,
            temporaryPassword,
            adminUser.TemporaryPasswordExpiresAtUtc,
            "Platform yönetimi",
            DateTime.UtcNow));

        return (Convert.ToBase64String(bytes), $"kurulum-belgesi-{tenant.Slug}.pdf");
    }

    /// <summary>
    /// İletişim adresine tek kullanımlık doğrulama bağlantısı gönderir.
    /// </summary>
    /// <remarks>
    /// SMTP yoksa davranış ortama göre değişir ve HİÇBİR ZAMAN "doğrulanmış" varsayılmaz
    /// (üretimde): başvuru kuyrukta <c>unproven</c> olarak görünür, yönetici adresin
    /// kanıtlanmadığını görür. Gönderilemeyen bir doğrulama gerçek kurumu görünmez
    /// yapmamalı; eksik yapılandırma da bir kapıyı sessizce kaldırmamalı.
    /// </remarks>
    private async Task StartContactVerificationAsync(
        TenantRegistrationApplication application,
        CancellationToken cancellationToken)
    {
        if (!emailSender.IsConfigured)
        {
            if (environment.IsProduction())
            {
                logger.LogWarning(
                    "SMTP yapılandırılmadığı için {Email} adresi doğrulanamadı; başvuru kuyrukta kanıtlanmamış olarak duruyor.",
                    application.ContactEmail);
                return;
            }

            application.VerifiedAtUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            return;
        }

        await using var transaction = emailDelivery is null ? null
            : await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var token = GenerateVerificationToken();
        application.VerificationTokenHash = HashVerificationToken(token);
        application.VerificationExpiresAtUtc = DateTime.UtcNow.AddHours(
            configuration.GetValue<int?>("Registration:VerificationValidHours") ?? 48);
        application.VerificationSentAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        var sent = await SendContactVerificationEmailAsync(application, token, cancellationToken);

        if (!sent)
        {
            // Gönderilemedi: "yanıt bekleniyor" durumunda bırakırsak başvuru kuyrukta
            // hiç görünmez ve kimse fark etmez. Kanıtlanmamış duruma geri al.
            application.VerificationTokenHash = null;
            application.VerificationExpiresAtUtc = null;
            application.VerificationSentAtUtc = null;
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
            await transaction.DisposeAsync();
            await TryDispatchOnboardingAsync(cancellationToken);
        }

    }

    /// <summary>
    /// Expired/unproven resend is a database compare-and-set. Only the transaction
    /// that replaces the expired state may send its token; losing requests remain
    /// non-enumerating duplicates and never email a stale token.
    /// </summary>
    private async Task TryRotateExpiredContactVerificationAsync(
        TenantRegistrationApplication application,
        CancellationToken cancellationToken)
    {
        if (!emailSender.IsConfigured)
        {
            return;
        }

        await using var transaction = emailDelivery is null ? null
            : await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var now = DateTime.UtcNow;
        var token = GenerateVerificationToken();
        var tokenHash = HashVerificationToken(token);
        var expiresAtUtc = now.AddHours(
            configuration.GetValue<int?>("Registration:VerificationValidHours") ?? 48);

        var claimed = await dbContext.TenantRegistrationApplications
            .Where(x => x.Id == application.Id
                        && x.Status == "pending"
                        && x.VerifiedAtUtc == null
                        && (x.VerificationSentAtUtc == null || x.VerificationExpiresAtUtc <= now))
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(x => x.VerificationTokenHash, tokenHash)
                    .SetProperty(x => x.VerificationExpiresAtUtc, expiresAtUtc)
                    .SetProperty(x => x.VerificationSentAtUtc, now),
                cancellationToken);

        if (claimed == 0)
        {
            return;
        }

        // ExecuteUpdate bypasses the change tracker. Keep this scoped context's
        // identity map aligned so a subsequent verification query cannot rematerialize
        // the row with the expired token values.
        application.VerificationTokenHash = tokenHash;
        application.VerificationExpiresAtUtc = expiresAtUtc;
        application.VerificationSentAtUtc = now;
        dbContext.Entry(application).State = EntityState.Unchanged;

        if (await SendContactVerificationEmailAsync(application, token, cancellationToken))
        {
            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
                await transaction.DisposeAsync();
                await TryDispatchOnboardingAsync(cancellationToken);
            }
            return;
        }

        // Clear only our own failed rotation. This preserves a newer winner if the
        // row changes between the transport failure and cleanup.
        await dbContext.TenantRegistrationApplications
            .Where(x => x.Id == application.Id && x.VerificationTokenHash == tokenHash)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(x => x.VerificationTokenHash, (string?)null)
                    .SetProperty(x => x.VerificationExpiresAtUtc, (DateTime?)null)
                    .SetProperty(x => x.VerificationSentAtUtc, (DateTime?)null),
                cancellationToken);
        application.VerificationTokenHash = null;
        application.VerificationExpiresAtUtc = null;
        application.VerificationSentAtUtc = null;
        dbContext.Entry(application).State = EntityState.Unchanged;
    }

    private async Task<bool> SendContactVerificationEmailAsync(
        TenantRegistrationApplication application,
        string token,
        CancellationToken cancellationToken)
    {
        var baseUrl = RegistrationUrl("Registration:VerificationUrl", "https://schoolasist.com/kurum-kaydi/dogrula").TrimEnd('/');
        var link = $"{baseUrl}#token={Uri.EscapeDataString(token)}";

        var html = $"<p>Merhaba {System.Net.WebUtility.HtmlEncode(application.ContactName)},</p>"
            + $"<p><strong>{System.Net.WebUtility.HtmlEncode(application.InstitutionName)}</strong> için kurum başvurunuzu doğrulayın.</p>"
            + $"<p><a href=\"{System.Net.WebUtility.HtmlEncode(link)}\">E-posta adresimi doğrula</a></p>"
            + $"<p>Bağlantı {configuration.GetValue<int?>("Registration:VerificationValidHours") ?? 48} saat geçerlidir. Başvuruyu siz yapmadıysanız e-postayı yok sayın.</p>";
        html = OnboardingEmailTemplate.Wrap("E-posta doğrulaması", html);
        if (emailDelivery is null) return await emailSender.SendAsync(application.ContactEmail,
            "Kurum kaydı başvurunuzu doğrulayın", html, cancellationToken);
        emailDelivery.Queue($"verification:{application.Id}:{application.VerificationTokenHash}", "verification",
            application.Id, application.VerificationTokenHash, application.VerificationExpiresAtUtc!.Value,
            application.ContactEmail, "Kurum kaydı başvurunuzu doğrulayın", html);
        await dbContext.SaveChangesAsync(cancellationToken);
        await TryDispatchOnboardingAsync(cancellationToken);
        return true;
    }

    private string RegistrationUrl(string key, string fallback)
    {
        var value = configuration[key] ?? fallback;
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
            || !string.IsNullOrEmpty(uri.UserInfo) || !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment)
            || (uri.Scheme != Uri.UriSchemeHttps && !(environment.IsDevelopment() && uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback)))
            throw new InvalidOperationException($"{key} güvenli ve mutlak bir web adresi olmalıdır.");
        return uri.AbsoluteUri;
    }

    private async Task TryDispatchOnboardingAsync(CancellationToken cancellationToken)
    {
        if (emailDelivery is null) return;
        try { await emailDelivery.DispatchAsync(cancellationToken); }
        catch (Exception ex) when (ex is not OperationCanceledException)
        { logger.LogWarning(ex, "Onboarding mail is queued; background worker will retry."); }
    }

    /// <summary>
    /// Doğrulama bağlantısındaki kodu işler. Geçersiz, süresi dolmuş ve bilinmeyen
    /// kodlar AYNI sonucu verir — aksi hâlde uç bir jeton kâhinine dönüşürdü.
    /// </summary>
    public async Task<bool> VerifyRegistrationContactAsync(
        string? token,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Trim().Length != 43)
        {
            return false;
        }

        var hash = HashVerificationToken(token.Trim());
        var application = await dbContext.TenantRegistrationApplications
            .SingleOrDefaultAsync(x => x.VerificationTokenHash == hash, cancellationToken);

        if (application is not null)
        {
            // A resend CAS uses ExecuteUpdate and may have bypassed this scoped
            // context's identity map. Reload before evaluating expiry/status so a
            // previously tracked expired token cannot shadow the committed winner.
            await dbContext.Entry(application).ReloadAsync(cancellationToken);
        }

        if (application is null
            || application.VerificationTokenHash != hash
            || application.Status != "pending")
        {
            return false;
        }

        // Bağlantıya ikinci kez tıklamak hata göstermez: jeton zaten yalnız adresin
        // sahibinde, tekrar doğrulamak yeni bilgi sızdırmaz.
        if (application.VerifiedAtUtc is not null)
        {
            return true;
        }

        if (application.VerificationExpiresAtUtc is null || application.VerificationExpiresAtUtc < DateTime.UtcNow)
        {
            return false;
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var now = DateTime.UtcNow;
        var claimed = await dbContext.TenantRegistrationApplications
            .Where(x => x.Id == application.Id && x.VerificationTokenHash == hash
                && x.Status == "pending" && x.VerifiedAtUtc == null && x.VerificationExpiresAtUtc >= now)
            .ExecuteUpdateAsync(update => update.SetProperty(x => x.VerifiedAtUtc, now), cancellationToken);
        if (claimed == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            await dbContext.Entry(application).ReloadAsync(cancellationToken);
            return application.VerifiedAtUtc != null && application.VerificationTokenHash == hash;
        }
        application.VerifiedAtUtc = now;
        dbContext.Entry(application).State = EntityState.Unchanged;
        var receiptHtml = $"<h2>Başvurunuz başarıyla alınmıştır</h2><p>Merhaba {System.Net.WebUtility.HtmlEncode(application.ContactName)},</p>"
            + $"<p>{System.Net.WebUtility.HtmlEncode(application.InstitutionName)} için e-posta adresiniz doğrulandı. Başvurunuz platform yöneticisinin incelemesine alındı.</p>"
            + "<p>Onaydan sonra müşteri numaranız, kullanıcı adınız ve süreli geçici parolanız ayrı bir e-posta ile gönderilecektir. Şu anda ödeme veya paket seçimi gerekmez.</p>";
        receiptHtml = OnboardingEmailTemplate.Wrap("Başvurunuz alındı", receiptHtml);
        if (emailDelivery is not null)
        {
            emailDelivery.Queue($"received:{application.Id}", "received", application.Id, null,
                now.AddDays(7), application.ContactEmail, "SchoolAsist — Başvurunuz başarıyla alınmıştır", receiptHtml);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);
        await transaction.DisposeAsync();
        if (emailDelivery is not null) await TryDispatchOnboardingAsync(cancellationToken);
        else if (emailSender.IsConfigured) await emailSender.SendAsync(application.ContactEmail,
            "SchoolAsist — Başvurunuz başarıyla alınmıştır", receiptHtml, cancellationToken);

        logger.LogInformation("Kurum kaydı iletişim adresi doğrulandı. Id={Id}", application.Id);
        return true;
    }

    private static string GenerateVerificationToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    private static string HashVerificationToken(string token)
        => Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    /// <summary>
    /// Kuyrukta işaretlenecek başvuruları yakalayan sezgiseller. Hiçbiri kaydı
    /// ENGELLEMEZ — yanlış pozitif gerçek kurumu kapıda bırakmasın diye yalnız
    /// platform yöneticisine "önce buna bak" der.
    /// </summary>
    private async Task<string?> DetectSuspicionAsync(
        string? normalizedIp,
        CaptchaVerificationStatus captchaStatus,
        CancellationToken cancellationToken)
    {
        if (captchaStatus == CaptchaVerificationStatus.SkippedNotConfigured)
        {
            // Üretim dışı ortam; işaretlemeye gerek yok.
            return null;
        }

        if (string.IsNullOrWhiteSpace(normalizedIp))
        {
            return null;
        }

        var since = DateTime.UtcNow.AddHours(-24);
        var sameIpCount = await dbContext.TenantRegistrationApplications
            .AsNoTracking()
            .CountAsync(x => x.RegistrationIp == normalizedIp && x.CreatedAtUtc >= since, cancellationToken);

        // Eşik "kaçıncı başvuru işaretlensin" demektir: 3 ise aynı IP'den gelen
        // ÜÇÜNCÜ başvuru işaretlenir (mevcut sayı + bu istek).
        var threshold = configuration.GetValue<int?>("Registration:SuspiciousIpThreshold") ?? 3;
        var totalWithCurrent = sameIpCount + 1;
        return totalWithCurrent >= threshold
            ? $"Aynı IP'den son 24 saatte {totalWithCurrent} başvuru."
            : null;
    }

    /// <summary>
    /// Günlük eşik aşıldığında platform yöneticilerine bildirim. Günde bir kez
    /// (dedupe anahtarı tarihli) ve hata durumunda kaydı bloklamadan.
    /// </summary>
    private async Task NotifyRegistrationBurstAsync(int todayCount, int threshold, CancellationToken cancellationToken)
    {
        try
        {
            var dedupeKey = $"registration-burst:{DateTime.UtcNow:yyyy-MM-dd}";
            var alreadySent = await dbContext.Notifications
                .IgnoreQueryFilters()
                .AnyAsync(x => x.DedupeKey == dedupeKey, cancellationToken);

            if (alreadySent)
            {
                return;
            }

            // Platform yöneticisi = kurumu olmayan Developer (bkz. JwtTokenService).
            var adminIds = await dbContext.Users
                .IgnoreQueryFilters()
                .Where(x => x.TenantId == null
                            && x.PrimaryRole == UserRole.Developer
                            && x.Status == UserStatus.Active)
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);

            if (adminIds.Count == 0)
            {
                return;
            }

            foreach (var adminId in adminIds)
            {
                dbContext.Notifications.Add(new NotificationItem
                {
                    TenantId = null,
                    TargetUserId = adminId,
                    TargetRole = UserRole.Developer.ToString(),
                    Audience = "User",
                    Title = "Kurum kaydında olağandışı yoğunluk",
                    Message = $"Bugün {todayCount} kurum kaydı başvurusu alındı (eşik: {threshold}). Başvuru kuyruğunu gözden geçirin.",
                    Category = "Security",
                    TimeLabel = "Az önce",
                    DedupeKey = dedupeKey,
                });
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception exception)
        {
            // Bildirim, kaydın kendisini asla bloklamamalı.
            logger.LogWarning(exception, "Kurum kaydı yoğunluk bildirimi yazılamadı.");
        }
    }

    public async Task<IReadOnlyList<RegistrationBlocklistEntryDto>> GetRegistrationBlocklistAsync(
        CancellationToken cancellationToken = default)
        => await dbContext.RegistrationBlocklistEntries
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new RegistrationBlocklistEntryDto(
                x.Id, x.Kind, x.Value, x.Reason, x.CreatedByName, x.CreatedAtUtc))
            .ToListAsync(cancellationToken);

    public async Task<RegistrationBlocklistEntryDto?> AddRegistrationBlocklistEntryAsync(
        AddRegistrationBlocklistRequest request,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var kind = request.Kind?.Trim().ToLowerInvariant();
        if (kind != "domain" && kind != "ip")
        {
            return null;
        }

        var value = Sanitize(request.Value).ToLowerInvariant();
        // "@ornek.com" ya da "info@ornek.com" yazılırsa alan adına indir.
        if (kind == "domain")
        {
            var atIndex = value.LastIndexOf('@');
            if (atIndex >= 0) value = value[(atIndex + 1)..];
        }

        if (value.Length is < 3 or > 180)
        {
            return null;
        }

        var existing = await dbContext.RegistrationBlocklistEntries
            .SingleOrDefaultAsync(x => x.Kind == kind && x.Value == value, cancellationToken);

        if (existing is not null)
        {
            return new RegistrationBlocklistEntryDto(
                existing.Id, existing.Kind, existing.Value, existing.Reason, existing.CreatedByName, existing.CreatedAtUtc);
        }

        var entry = new RegistrationBlocklistEntry
        {
            Kind = kind,
            Value = value,
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? null : Truncate(request.Reason.Trim(), 300),
            CreatedByUserId = actorUserId,
            CreatedByName = string.IsNullOrWhiteSpace(actorName) ? "Sistem" : Truncate(actorName.Trim(), 150)!,
            CreatedAtUtc = DateTime.UtcNow,
        };

        await dbContext.RegistrationBlocklistEntries.AddAsync(entry, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Kurum kaydı kara listesine eklendi: {Kind}={Value} ({Actor})", kind, value, entry.CreatedByName);
        return new RegistrationBlocklistEntryDto(
            entry.Id, entry.Kind, entry.Value, entry.Reason, entry.CreatedByName, entry.CreatedAtUtc);
    }

    public async Task<bool> RemoveRegistrationBlocklistEntryAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entry = await dbContext.RegistrationBlocklistEntries
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (entry is null)
        {
            return false;
        }

        dbContext.RegistrationBlocklistEntries.Remove(entry);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<TenantWorkspaceDto?> SetApplicationSuspiciousAsync(
        Guid id,
        bool isSuspicious,
        string? reason = null,
        CancellationToken cancellationToken = default)
    {
        var application = await dbContext.TenantRegistrationApplications
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (application is null)
        {
            return null;
        }

        application.IsSuspicious = isSuspicious;
        application.SuspiciousReason = isSuspicious
            ? Truncate(string.IsNullOrWhiteSpace(reason) ? "Platform yöneticisi işaretledi." : reason.Trim(), 300)
            : null;

        await dbContext.SaveChangesAsync(cancellationToken);
        return ToApplicationDto(application);
    }

    /// <summary>
    /// Başvuruyu gerçek kuruma çevirir: kurum satırı, okunabilir slug ve yönetici
    /// hesabı bu anda üretilir. Başvuru satırı silinmez, "approved" olarak iz kalır.
    /// </summary>
    private async Task<TenantWorkspaceDto?> ApproveApplicationAsync(
        TenantRegistrationApplication application,
        CancellationToken cancellationToken)
    {
        // Anonymous contact ownership must be proven before activating a production tenant.
        if (environment.IsProduction() && application.VerifiedAtUtc is null) return null;

        var tenantId = Guid.NewGuid();
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        // CreatedTenantId is an existing nullable field and serves as the transaction-local
        // compare-and-set claim. PostgreSQL locks the matching row for this UPDATE; a
        // concurrent transaction waits, then affects zero rows after the winner commits.
        // Because the claim is inside this same transaction, rollback restores NULL and a
        // later request can safely retry. No process-local lock or new schema state is used.
        var claimed = await dbContext.TenantRegistrationApplications
            .Where(x => x.Id == application.Id
                        && (x.Status == "pending" || x.Status == "rejected")
                        && x.CreatedTenantId == null)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(x => x.CreatedTenantId, tenantId),
                cancellationToken);

        if (claimed == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            dbContext.Entry(application).State = EntityState.Detached;
            return null;
        }

        var tenant = new TenantWorkspace
        {
            Id = tenantId,
            Name = application.InstitutionName,
            Slug = await GenerateUniqueSlugAsync(application.InstitutionName, null, cancellationToken),
            ContactEmail = application.ContactEmail,
            ContactName = application.ContactName,
            ContactPhone = application.ContactPhone,
            Plan = application.Plan,
            Status = "active",
            BranchCount = 1,
            InstitutionType = application.InstitutionType,
            DrivingSchoolModuleEnabled = application.InstitutionType == InstitutionType.DrivingSchool,
            RegistrationIp = application.RegistrationIp,
            RegistrationUserAgent = application.RegistrationUserAgent,
            RegistrationReferer = application.RegistrationReferer,
            RegistrationEstimatedStudents = application.EstimatedStudents,
            // Başvuruda toplanan genişletilmiş kurum bilgileri kuruma taşınır.
            MebCode = application.MebCode,
            TaxOffice = application.TaxOffice,
            TaxNumber = application.TaxNumber,
            City = application.City,
            District = application.District,
            AddressLine = application.AddressLine,
            PostalCode = application.PostalCode,
            InstitutionPhone = application.InstitutionPhone,
            InstitutionEmail = application.InstitutionEmail,
            Website = application.Website,
            ContactTitle = application.ContactTitle,
            KvkkConsentVersion = application.KvkkConsentVersion,
            KvkkConsentAtUtc = application.KvkkConsentAtUtc,
            CreatedAtUtc = DateTime.UtcNow,
            ApprovedAtUtc = DateTime.UtcNow,
        };

        // İKİ AŞAMALI KAYIT ŞART: kurum ile yönetici birbirini işaret ediyor
        // (tenant.AdminUserId → user, user.TenantId → tenant). İkisi tek SaveChanges'te
        // eklenirse EF dairesel bağımlılık hatası verir. Önce kurum yazılır.
        await dbContext.Set<TenantWorkspace>().AddAsync(tenant, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        var created = await CreateTenantAdminUserAsync(tenant, cancellationToken);
        created.User.IsEmailVerified = application.VerifiedAtUtc is not null;
        await dbContext.SaveChangesAsync(cancellationToken);

        tenant.AdminUserId = created.User.Id;
        tenant.UserCount = 1;

        application.Status = "approved";
        application.ApprovedAtUtc = DateTime.UtcNow;
        application.CreatedTenantId = tenant.Id;

        // Render before commit. If rendering fails, disposal rolls the transaction
        // back and no unusable bootstrap password or claim is persisted.
        var document = BuildSetupDocument(tenant, created.User, created.TemporaryPassword);

        if (emailDelivery is not null)
            await SendApprovalEmailAsync(tenant, created.User, created.TemporaryPassword, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await transaction.DisposeAsync();
        if (emailDelivery is not null)
        {
            await TryDispatchOnboardingAsync(cancellationToken);
            await dbContext.Entry(tenant).ReloadAsync(cancellationToken);
        }
        else await SendApprovalEmailAsync(tenant, created.User, created.TemporaryPassword, cancellationToken);

        logger.LogInformation(
            "Kurum başvurusu onaylandı. BasvuruId={ApplicationId} KurumId={TenantId} Slug={Slug}",
            application.Id,
            tenant.Id,
            tenant.Slug);

        await auditLog.LogAsync(
            "Kurum onaylandı, kurulum belgesi üretildi",
            "Platform",
            nameof(TenantWorkspace),
            tenant.Id.ToString(),
            $"{tenant.Name} · {created.User.Username}",
            cancellationToken);

        return ToTenantDto(
            tenant,
            created.User.Username,
            created.TemporaryPassword,
            created.User.TemporaryPasswordExpiresAtUtc,
            document.Base64,
            document.FileName);
    }

    private async Task<(AppUser User, string TemporaryPassword)> CreateTenantAdminUserAsync(TenantWorkspace tenant, CancellationToken cancellationToken)
    {
        var username = await GenerateUniqueTenantAdminUsernameAsync(tenant, cancellationToken);
        // Kimlik bilgisi üretimi kriptografik üreteçle olmalı; System.Random değil.
        // Ortak PasswordGenerator (RandomNumberGenerator) parola sıfırlamada da kullanılıyor.
        var temporaryPassword = PasswordGenerator.Generate(10);
        var passwordHash = passwordHasher.Hash(temporaryPassword);
        var fullName = string.IsNullOrWhiteSpace(tenant.ContactName)
            ? $"{tenant.Name} Yonetici"
            : tenant.ContactName.Trim();

        var user = new AppUser
        {
            TenantId = tenant.Id,
            FullName = fullName,
            Username = username,
            PasswordHash = passwordHash,
            PrimaryRole = UserRole.Admin,
            Status = UserStatus.Active,
            Phone = tenant.ContactPhone,
            IsEmailVerified = false,
            // Süresiz geçici parola, teslim edilen belge kaybolduğunda aylarca açık
            // bir kapı bırakırdı. Süre dolarsa yeni belge üretilir.
            TemporaryPasswordExpiresAtUtc = DateTime.UtcNow.AddDays(
                configuration.GetValue<int?>("Registration:TemporaryPasswordValidDays") ?? 7),
            Campus = tenant.Name,
            DepartmentOrBranch = "Yonetim",
            CreatedAtUtc = DateTime.UtcNow,
            MustChangePassword = true
        };

        await dbContext.Users.AddAsync(user, cancellationToken);
        return (user, temporaryPassword);
    }

    private async Task<string> GenerateUniqueSlugAsync(string value, Guid? currentId, CancellationToken cancellationToken)
    {
        var baseSlug = NormalizeSlug(value);
        var slug = baseSlug;
        var suffix = 2;

        while (await dbContext.Set<TenantWorkspace>()
            .AnyAsync(x => x.Slug == slug && (!currentId.HasValue || x.Id != currentId.Value), cancellationToken))
        {
            slug = $"{baseSlug}.{suffix++}";
        }

        return slug;
    }

    private async Task<string> GenerateUniqueTenantAdminUsernameAsync(TenantWorkspace tenant, CancellationToken cancellationToken)
    {
        var emailCandidate = tenant.ContactEmail.Trim().ToLowerInvariant();
        var baseUsername = string.IsNullOrWhiteSpace(emailCandidate)
            ? $"{tenant.Slug}.admin"
            : emailCandidate;

        if (!await dbContext.Users.AnyAsync(x => x.Username == baseUsername, cancellationToken))
        {
            return baseUsername;
        }

        var atIndex = baseUsername.IndexOf('@');
        var localPart = atIndex > 0 ? baseUsername[..atIndex] : baseUsername;
        var domainPart = atIndex > 0 ? baseUsername[atIndex..] : string.Empty;
        var counter = 2;

        while (true)
        {
            var candidate = $"{localPart}{counter}{domainPart}";
            if (!await dbContext.Users.AnyAsync(x => x.Username == candidate, cancellationToken))
            {
                return candidate;
            }

            counter++;
        }
    }

    /// <summary>
    /// Başvuruyu kurum listesindeki satır biçimine çevirir. Sayaçlar sıfırdır:
    /// başvurudaki beyan hiçbir toplama girmez. Slug boştur — başvurunun slug'ı yoktur.
    /// </summary>
    private static TenantWorkspaceDto ToApplicationDto(TenantRegistrationApplication entity) => new(
        entity.Id,
        entity.InstitutionName,
        entity.ContactEmail,
        entity.Plan,
        entity.Status,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        entity.CreatedAtUtc,
        string.Empty,
        entity.ContactName,
        entity.ContactPhone ?? string.Empty,
        null,
        null,
        null,
        entity.ApprovedAtUtc,
        entity.InstitutionType.ToString(),
        entity.InstitutionType == InstitutionType.DrivingSchool,
        entity.IsSuspicious,
        entity.SuspiciousReason,
        entity.VerificationState,
        City: entity.City,
        District: entity.District,
        AddressLine: entity.AddressLine,
        EstimatedStudents: entity.EstimatedStudents,
        ContactTitle: entity.ContactTitle,
        VerifiedAtUtc: entity.VerifiedAtUtc,
        RejectedAtUtc: entity.RejectedAtUtc,
        RejectionReason: entity.RejectionReason,
        RegistrationCreatedAtUtc: entity.CreatedAtUtc);

    private static TenantWorkspaceDto ToTenantDto(
        TenantWorkspace entity,
        string? adminUsername = null,
        string? temporaryPassword = null,
        DateTime? temporaryPasswordExpiresAtUtc = null,
        string? setupDocumentBase64 = null,
        string? setupDocumentFileName = null) => new(
        entity.Id,
        entity.Name,
        entity.ContactEmail,
        entity.Plan,
        entity.Status,
        entity.UserCount,
        entity.BranchCount,
        entity.StudentCount,
        entity.StaffCount,
        entity.MonthlyFee,
        entity.CollectedAmount,
        entity.StorageUsedGb,
        entity.ApiUsage,
        entity.CreatedAtUtc,
        entity.Slug,
        entity.ContactName,
        entity.ContactPhone ?? string.Empty,
        entity.AdminUserId,
        adminUsername,
        temporaryPassword,
        entity.ApprovedAtUtc,
        entity.InstitutionType.ToString(),
        entity.DrivingSchoolModuleEnabled,
        false,
        null,
        "verified",
        temporaryPasswordExpiresAtUtc,
        setupDocumentBase64,
        setupDocumentFileName,
        entity.CustomerNumber,
        entity.ApprovalEmailSentAtUtc,
        City: entity.City,
        District: entity.District,
        AddressLine: entity.AddressLine,
        EstimatedStudents: entity.RegistrationEstimatedStudents,
        ContactTitle: entity.ContactTitle,
        RejectedAtUtc: entity.RejectedAtUtc);

    private static InstitutionType ParseInstitutionType(string? value)
    {
        if (!Enum.TryParse<InstitutionType>(value, true, out var type) || !Enum.IsDefined(type))
        {
            throw new ArgumentException("Geçersiz kurum türü.", nameof(value));
        }
        return type;
    }

    private static SupportTicketDto ToTicketDto(SupportTicket entity) => new(
        entity.Id,
        entity.TicketNumber,
        entity.Subject,
        entity.TenantName,
        entity.RequestedBy,
        entity.RequestedRole,
        entity.Category,
        entity.Priority,
        entity.Status,
        entity.Summary,
        entity.LastMessage,
        entity.MessageCount,
        entity.CreatedAtUtc,
        entity.UpdatedAtUtc,
        entity.CustomerNumber,
        entity.ContactEmail);

    private static IReadOnlyList<PlatformAiModelDto> BuildAiModels(int notifications, int threads, int homework, int contents, int meetings)
    {
        var total = Math.Max(1, notifications + threads + homework + contents + meetings);
        return
        [
            new PlatformAiModelDto("learning-copilot", "Ogrenme Copilot", "OpenAI", threads > 0 ? "active" : "standby", (int)Math.Round((double)threads / total * 100), 0.03m),
            new PlatformAiModelDto("content-insight", "Icerik Analizi", "OpenAI", contents > 0 ? "active" : "standby", (int)Math.Round((double)contents / total * 100), 0.018m),
            new PlatformAiModelDto("ops-summary", "Operasyon Ozetleyici", "Internal", notifications > 0 ? "active" : "standby", (int)Math.Round((double)notifications / total * 100), 0.004m),
            new PlatformAiModelDto("parent-assist", "Veli Destek Asistani", "OpenAI", meetings > 0 || homework > 0 ? "active" : "inactive", (int)Math.Round((double)(meetings + homework) / total * 100), 0.009m),
        ];
    }

    private static IReadOnlyList<PlatformAiLogDto> BuildAiLogs(IReadOnlyList<NotificationItem> notifications, IReadOnlyList<StudentQuestionThread> threads)
    {
        var notificationLogs = notifications.Take(3).Select((item, index) => new PlatformAiLogDto(
            $"N-{index}",
            DateTime.Now.ToString("HH:mm"),
            item.TargetRole,
            "Platform",
            "Operasyon Ozetleyici",
            400 + index * 120,
            "1.1s",
            item.IsRead ? "success" : "queued"));

        var threadLogs = threads.Take(4).Select((item, index) => new PlatformAiLogDto(
            $"Q-{item.Id}",
            DateTime.Now.ToString("HH:mm"),
            item.StudentName,
            item.Subject,
            "Ogrenme Copilot",
            900 + index * 160,
            "1.8s",
            "success"));

        return threadLogs.Concat(notificationLogs).Take(7).ToList();
    }


    private static string NormalizeSlug(string value)
    {
        var normalized = new string(value
            .Trim()
            .ToLowerInvariant()
            .Select(ch => ch switch
            {
                '\u00E7' => 'c',
                '\u011F' => 'g',
                '\u0131' => 'i',
                '\u00F6' => 'o',
                '\u015F' => 's',
                '\u00FC' => 'u',
                _ => ch
            })
            .ToArray());

        var parts = normalized
            .Split(new[] { ' ', '/', '\\', '-', '_' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(part => new string(part.Where(char.IsLetterOrDigit).ToArray()))
            .Where(part => !string.IsNullOrWhiteSpace(part));

        return string.Join('.', parts);
    }

    private static decimal ParseDecimal(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return 0;
        }

        var normalized = raw.Replace("₺", string.Empty).Replace(".", string.Empty).Replace(",", ".").Trim();
        return decimal.TryParse(normalized, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var result)
            ? result
            : 0;
    }

    private static DateTime ParseDate(string? raw)
    {
        if (DateTime.TryParse(raw, out var parsed))
        {
            return parsed;
        }

        return DateTime.MaxValue;
    }
}
