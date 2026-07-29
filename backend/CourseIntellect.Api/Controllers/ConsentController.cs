using System.Security.Claims;
using System.Text;
using System.Text.Json;
using CourseIntellect.Api.Authorization;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Onam/izin formu modülü: şablon yönetimi, öğrenci kaydı, tablete aktarma,
/// tablet yoklaması, imzalama ve imzalı belgenin PDF çıktısı.
///
/// Yetki kuralları:
///  • Rol BEYAZ LİSTESİ kullanılır (kara liste değil): yeni bir rol eklendiğinde
///    bu uçlar sessizce açılmaz. Öğrenci/veli rolleri hiçbir uca erişemez —
///    aksi hâlde portal kullanıcısı başkasının belgesini okuyabilirdi.
///  • Paket (entitlement) kapısı yalnız YAZMA yollarındadır: paket düşse bile
///    daha önce imzalanmış belgeler görüntülenip indirilebilmelidir.
///  • İmza akışı personel onay kuyruğunun DIŞINDADIR; onaya düşerse form
///    tablete hiç gitmez ve imza alınamaz.
/// </summary>
[ApiController]
[Authorize(Roles = "Admin,Administrative,Teacher,Accounting")]
[Route("api/consent")]
public sealed class ConsentController(
    IConsentFormService consentFormService,
    IConsentFormPdfService consentFormPdfService,
    IInstitutionProfileService institutionProfileService,
    IPlatformConfigurationService platformConfigurationService,
    IFileStorageService fileStorageService,
    ITenantContext tenantContext,
    IWebHostEnvironment environment) : ControllerBase
{
    /// <summary>Şablon yazma yetkisi yönetimdedir; öğretmen yalnız imza akışını kullanır.</summary>
    private const string TemplateManagerRoles = "Admin,Administrative";

    /// <summary>Yüklenen PDF için istek gövdesi üst sınırı (servis 12 MB'da keser).</summary>
    private const long MaxDocumentRequestBytes = 16L * 1024 * 1024;

    // ══════════════════════════════════════════════════════════════════════════
    // Şablon yönetimi
    // ══════════════════════════════════════════════════════════════════════════

    [HttpGet("catalog")]
    public IActionResult GetCatalog() => Ok(new { contextKinds = consentFormService.ContextKinds });

    // ══════════════════════════════════════════════════════════════════════════
    // Yüklenen PDF belgeleri
    // ══════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Hazır PDF yükler (matbu sözleşme, taahhütname…). Dosya, statik /uploads
    /// klasörüne DEĞİL veritabanına yazılır: onam belgeleri kişisel veri taşır ve
    /// yalnız kimlik doğrulanmış, kurum süzgecinden geçen uçtan okunmalıdır.
    /// </summary>
    [HttpPost("documents")]
    [Authorize(Roles = TemplateManagerRoles)]
    [RequireEntitlement("settings", "consent-manage")]
    [RequestSizeLimit(MaxDocumentRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxDocumentRequestBytes)]
    public async Task<IActionResult> UploadDocument([FromForm] IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Yüklenecek PDF seçilmedi." });
        }
        if (file.Length > MaxDocumentRequestBytes)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge, new { message = "Dosya çok büyük." });
        }

        using var buffer = new MemoryStream();
        await using (var stream = file.OpenReadStream())
        {
            await stream.CopyToAsync(buffer, cancellationToken);
        }

        return Result(await consentFormService.SaveDocumentAsync(
            buffer.ToArray(), file.FileName, CurrentUserId(), cancellationToken));
    }

    /// <summary>Yüklenmiş belgenin kendisi — şablon düzenleme ekranındaki önizleme.</summary>
    [HttpGet("documents/{id:guid}")]
    public async Task<IActionResult> GetDocument(Guid id, CancellationToken cancellationToken)
    {
        var document = await consentFormService.GetDocumentAsync(id, cancellationToken);
        return DocumentFile(document);
    }

    /// <summary>
    /// Kaydın dayandığı özgün PDF — tabletin imzadan önce gösterdiği belge.
    /// İmza görselini içermez; imzalı çıktı için forms/{id}/pdf kullanılır.
    /// </summary>
    [HttpGet("forms/{id:guid}/document")]
    public async Task<IActionResult> GetFormDocument(Guid id, CancellationToken cancellationToken)
    {
        var document = await consentFormService.GetFormDocumentAsync(id, cancellationToken);
        return DocumentFile(document);
    }

    private IActionResult DocumentFile(ConsentResult<ConsentDocumentContent> document)
    {
        if (!document.Ok || document.Value is null) return Result(document);

        // Dosya adı Türkçe karakterden arındırılır (Content-Disposition güvenli).
        var name = Slug(Path.GetFileNameWithoutExtension(document.Value.FileName));
        return File(document.Value.Content, "application/pdf", $"{name}.pdf");
    }

    [HttpGet("templates")]
    public async Task<IActionResult> ListTemplates([FromQuery] bool includeInactive, CancellationToken cancellationToken)
        => Ok(await consentFormService.ListTemplatesAsync(includeInactive, cancellationToken));

    [HttpGet("templates/{id:guid}")]
    public async Task<IActionResult> GetTemplate(Guid id, CancellationToken cancellationToken)
        => Result(await consentFormService.GetTemplateAsync(id, cancellationToken));

    [HttpPost("templates")]
    [Authorize(Roles = TemplateManagerRoles)]
    [RequireEntitlement("settings", "consent-manage")]
    public async Task<IActionResult> CreateTemplate(
        [FromBody] SaveConsentTemplateRequest request, CancellationToken cancellationToken)
        => Result(await consentFormService.CreateTemplateAsync(request, CurrentUserId(), cancellationToken));

    [HttpPut("templates/{id:guid}")]
    [Authorize(Roles = TemplateManagerRoles)]
    [RequireEntitlement("settings", "consent-manage")]
    public async Task<IActionResult> UpdateTemplate(
        Guid id, [FromBody] SaveConsentTemplateRequest request, CancellationToken cancellationToken)
        => Result(await consentFormService.UpdateTemplateAsync(id, request, CurrentUserId(), cancellationToken));

    [HttpDelete("templates/{id:guid}")]
    [Authorize(Roles = TemplateManagerRoles)]
    [RequireEntitlement("settings", "consent-manage")]
    public async Task<IActionResult> DeleteTemplate(Guid id, CancellationToken cancellationToken)
        => Result(await consentFormService.DeleteTemplateAsync(id, CurrentUserId(), cancellationToken));

    /// <summary>Şablonun boş (ıslak imzalı) PDF önizlemesi — yönetici metni basılı hâliyle görsün.</summary>
    [HttpGet("templates/{id:guid}/preview")]
    public async Task<IActionResult> PreviewTemplate(Guid id, CancellationToken cancellationToken)
    {
        var template = await consentFormService.GetTemplateAsync(id, cancellationToken);
        if (!template.Ok || template.Value is null) return Result(template);

        // PDF kaynaklı şablonda önizleme, yüklenen belgenin ta kendisidir:
        // yeniden üretmek matbu evrakın düzenini bozar.
        if (template.Value.SourceKind == ConsentDocumentSource.Pdf && template.Value.DocumentId is Guid documentId)
        {
            return DocumentFile(await consentFormService.GetDocumentAsync(documentId, cancellationToken));
        }

        var branding = await ResolveBrandingAsync(cancellationToken);
        var pdf = consentFormPdfService.Generate(new ConsentPdfModel(
            InstitutionName: branding.InstitutionName,
            Title: template.Value.Title,
            Body: template.Value.Body,
            CheckItems: template.Value.CheckItems,
            CheckedItems: [],
            StudentName: string.Empty,
            ContextLabel: string.Empty,
            StaffName: string.Empty,
            StaffNotes: string.Empty,
            SignerLabel: SignerLabel(template.Value.SignerRole),
            SignerName: string.Empty,
            SignerRelation: string.Empty,
            SignedAtUtc: null,
            SignatureImage: null,
            LogoBytes: branding.LogoBytes,
            AccentColor: branding.AccentColor,
            FooterNote: branding.FooterNote));

        return File(pdf, "application/pdf", $"{Slug(template.Value.Title)}-onizleme.pdf");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Öğrenci kayıtları
    // ══════════════════════════════════════════════════════════════════════════

    [HttpGet("students/{studentProfileId:guid}")]
    public async Task<IActionResult> ListStudentForms(Guid studentProfileId, CancellationToken cancellationToken)
        => Ok(await consentFormService.ListStudentFormsAsync(studentProfileId, cancellationToken));

    [HttpGet("students/{studentProfileId:guid}/status")]
    public async Task<IActionResult> GetStudentStatus(
        Guid studentProfileId,
        [FromQuery] ConsentContextKind? contextKind,
        [FromQuery] string? contextKey,
        [FromQuery] Guid? contextRefId,
        CancellationToken cancellationToken)
        => Result(await consentFormService.GetStatusAsync(
            studentProfileId, contextKind, contextKey, contextRefId, cancellationToken));

    [HttpGet("appointments/{appointmentId:guid}/status")]
    public async Task<IActionResult> GetAppointmentStatus(Guid appointmentId, CancellationToken cancellationToken)
        => Result(await consentFormService.GetAppointmentStatusAsync(appointmentId, cancellationToken));

    [HttpGet("forms/{id:guid}")]
    public async Task<IActionResult> GetForm(Guid id, CancellationToken cancellationToken)
        => Result(await consentFormService.GetFormAsync(id, cancellationToken));

    [HttpPost("forms")]
    [RequireEntitlement("students", "consent")]
    public async Task<IActionResult> CreateForm(
        [FromBody] CreateConsentFormRequest request, CancellationToken cancellationToken)
        => Result(await consentFormService.CreateFormAsync(request, CurrentUserId(), CallerName, cancellationToken));

    [HttpPut("forms/{id:guid}")]
    [RequireEntitlement("students", "consent")]
    public async Task<IActionResult> UpdateForm(
        Guid id, [FromBody] UpdateConsentFormRequest request, CancellationToken cancellationToken)
        => Result(await consentFormService.UpdateFormAsync(id, request, CurrentUserId(), cancellationToken));

    [HttpDelete("forms/{id:guid}")]
    [RequireEntitlement("students", "consent")]
    public async Task<IActionResult> CancelForm(Guid id, CancellationToken cancellationToken)
        => Result(await consentFormService.CancelFormAsync(id, CurrentUserId(), cancellationToken));

    /// <summary>İmzalı (veya hazırlanan) belgenin PDF çıktısı. Okuma yolu — paket kapısı yok.</summary>
    [HttpGet("forms/{id:guid}/pdf")]
    public async Task<IActionResult> DownloadForm(Guid id, CancellationToken cancellationToken)
    {
        var form = await consentFormService.GetFormAsync(id, cancellationToken);
        if (!form.Ok || form.Value is null) return Result(form);

        var signature = await consentFormService.GetSignatureImageAsync(id, cancellationToken);
        var branding = await ResolveBrandingAsync(cancellationToken);
        var model = new ConsentPdfModel(
            InstitutionName: branding.InstitutionName,
            Title: form.Value.Title,
            Body: form.Value.Body,
            CheckItems: form.Value.CheckItems,
            CheckedItems: form.Value.CheckedItems,
            StudentName: form.Value.StudentName,
            ContextLabel: form.Value.ContextLabel,
            StaffName: form.Value.StaffName,
            StaffNotes: form.Value.StaffNotes,
            SignerLabel: SignerLabel(form.Value.SignerRole),
            SignerName: form.Value.SignerName,
            SignerRelation: form.Value.SignerRelation,
            SignedAtUtc: form.Value.SignedAtUtc,
            SignatureImage: DecodeInlineImage(signature),
            LogoBytes: branding.LogoBytes,
            AccentColor: branding.AccentColor,
            FooterNote: branding.FooterNote);

        byte[] pdf;
        if (form.Value.SourceKind == ConsentDocumentSource.Pdf)
        {
            // Matbu belge yeniden üretilmez: özgün sayfalar korunur, imza bilgisi
            // sona eklenen tutanak sayfasına basılır.
            var document = await consentFormService.GetFormDocumentAsync(id, cancellationToken);
            if (!document.Ok || document.Value is null) return Result(document);

            pdf = consentFormPdfService.AppendSignaturePage(
                document.Value.Content,
                model,
                new ConsentDocumentStamp(document.Value.FileName, document.Value.Sha256, document.Value.PageCount));
        }
        else
        {
            pdf = consentFormPdfService.Generate(model);
        }

        var date = (form.Value.SignedAtUtc?.ToLocalTime() ?? form.Value.CreatedAtUtc.ToLocalTime()).ToString("yyyy-MM-dd");
        return File(pdf, "application/pdf", $"{Slug(form.Value.StudentName)}-{Slug(form.Value.Title)}-{date}.pdf");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // İmza oturumu
    // ══════════════════════════════════════════════════════════════════════════

    [HttpPost("forms/{id:guid}/session")]
    [RequireEntitlement("students", "consent")]
    public async Task<IActionResult> OpenSession(
        Guid id, [FromBody] OpenConsentSessionRequest request, CancellationToken cancellationToken)
        => Result(await consentFormService.OpenSessionAsync(id, request, CurrentUserId(), cancellationToken));

    [HttpDelete("forms/{id:guid}/session")]
    [RequireEntitlement("students", "consent")]
    public async Task<IActionResult> RevokeSession(Guid id, CancellationToken cancellationToken)
        => Result(await consentFormService.RevokeSessionAsync(id, CurrentUserId(), cancellationToken));

    // ══════════════════════════════════════════════════════════════════════════
    // Tablet
    // ══════════════════════════════════════════════════════════════════════════

    [HttpGet("stations")]
    public async Task<IActionResult> ListStations(CancellationToken cancellationToken)
        => Ok(await consentFormService.ListStationsAsync(cancellationToken));

    /// <summary>
    /// Tabletin yoklaması: yalnız KENDİ adına gönderilmiş formu döndürür.
    /// Bekleyen form yoksa 204 döner (istemci ekranı sıfırlamaz).
    /// </summary>
    [HttpGet("station/pending")]
    public async Task<IActionResult> PollStation(
        [FromQuery] string? station, CancellationToken cancellationToken)
    {
        var result = await consentFormService.PollStationAsync(station, UserAgent, cancellationToken);
        if (!result.Ok) return Result(result);
        return result.Value is null ? NoContent() : Ok(result.Value);
    }

    /// <summary>
    /// İmzalama. Oturum anahtarı tek kullanımlıktır; doğrulamalar (tüm maddeler
    /// işaretli mi, imza görseli var mı, süre doldu mu) sunucuda yapılır.
    /// </summary>
    [HttpPost("session/{token:guid}/sign")]
    public async Task<IActionResult> Sign(
        Guid token, [FromBody] SignConsentFormRequest request, CancellationToken cancellationToken)
        => Result(await consentFormService.SignAsync(token, request, UserAgent, ClientIp, cancellationToken));

    // ══════════════════════════════════════════════════════════════════════════
    // Yardımcılar
    // ══════════════════════════════════════════════════════════════════════════

    private IActionResult Result<T>(ConsentResult<T> result) =>
        result.Ok
            ? Ok(result.Value)
            : StatusCode(result.StatusCode, new { message = result.Message });

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    private string CallerName => User.FindFirstValue("name") ?? string.Empty;

    private string UserAgent => Request.Headers.UserAgent.ToString();

    private string ClientIp => HttpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty;

    private static string SignerLabel(ConsentSignerRole role) => role switch
    {
        ConsentSignerRole.Student => "Öğrenci imzası",
        ConsentSignerRole.Parent => "Veli / yasal temsilci imzası",
        _ => "Öğrenci / veli imzası",
    };

    private sealed record ConsentBranding(string InstitutionName, byte[]? LogoBytes, string AccentColor, string FooterNote);

    /// <summary>
    /// Belge künyesi: kurum adı ve alt not Ayarlar &gt; Kurum Künyesi'nden,
    /// logo/renk kurum özelleştirmesinden gelir. Logo yalnız gömülü görselden
    /// veya kurumun güvenli yerel yükleme alanından okunur; dış adrese istek
    /// yapılmaz (SSRF yüzeyi açılmaz).
    /// </summary>
    private async Task<ConsentBranding> ResolveBrandingAsync(CancellationToken cancellationToken)
    {
        var profile = await institutionProfileService.GetEffectiveAsync(cancellationToken);
        var name = string.IsNullOrWhiteSpace(profile.Name) ? "SchoolAsist" : profile.Name;
        var accent = "#0F4C81";
        byte[]? logo = null;

        if (tenantContext.CurrentTenantId is Guid tenantId)
        {
            var configuration = (await platformConfigurationService.GetAsync("tenant-customization", cancellationToken))
                .Where(item => string.Equals(item.ScopeKey, tenantId.ToString(), StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(item => item.UpdatedAtUtc)
                .FirstOrDefault();

            if (!string.IsNullOrWhiteSpace(configuration?.PayloadJson))
            {
                try
                {
                    using var payload = JsonDocument.Parse(configuration.PayloadJson);
                    var root = payload.RootElement;
                    if (ReadString(root, "primaryColor") is { Length: > 0 } primaryColor) accent = primaryColor;
                    if (ReadString(root, "logoUrl") is { Length: > 0 } logoUrl)
                    {
                        logo = DecodeInlineImage(logoUrl)
                            ?? await fileStorageService.ReadBytesAsync(logoUrl, cancellationToken);
                    }
                }
                catch (JsonException)
                {
                    // Bozuk branding kaydı belgeyi engellemez; varsayılan marka ile devam.
                }
            }
        }

        logo ??= await ReadBrandEmblemAsync(cancellationToken);
        return new ConsentBranding(name, logo, accent, profile.DocumentFooterNote);
    }

    private static string? ReadString(JsonElement root, string property) =>
        root.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()?.Trim()
            : null;

    private static byte[]? DecodeInlineImage(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (!value.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase)) return null;

        var separator = value.IndexOf(";base64,", StringComparison.OrdinalIgnoreCase);
        if (separator < 0) return null;

        var base64 = value[(separator + ";base64,".Length)..];
        // 4/3 taban-64 genişlemesi hesaba katılarak ~3 MB üstü görsel reddedilir.
        if (base64.Length > 4 * 1024 * 1024) return null;

        Span<byte> buffer = new byte[base64.Length / 4 * 3 + 3];
        if (!Convert.TryFromBase64String(base64, buffer, out var written) || written == 0) return null;

        var bytes = buffer[..written].ToArray();
        return IsSupportedImage(bytes) ? bytes : null;
    }

    private static bool IsSupportedImage(byte[] bytes)
    {
        var png = bytes.Length > 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
        var jpeg = bytes.Length > 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF;
        return png || jpeg;
    }

    private static byte[]? _brandEmblem;

    private async Task<byte[]?> ReadBrandEmblemAsync(CancellationToken cancellationToken)
    {
        if (_brandEmblem is not null) return _brandEmblem.Length == 0 ? null : _brandEmblem;

        var path = Path.Combine(environment.ContentRootPath, "Assets", "schoolasist-emblem.png");
        _brandEmblem = System.IO.File.Exists(path)
            ? await System.IO.File.ReadAllBytesAsync(path, cancellationToken)
            : [];
        return _brandEmblem.Length == 0 ? null : _brandEmblem;
    }

    /// <summary>Dosya adı için Türkçe karakterleri sadeleştirir (Content-Disposition güvenli).</summary>
    private static string Slug(string value)
    {
        var map = new Dictionary<char, char>
        {
            ['ç'] = 'c', ['Ç'] = 'c', ['ğ'] = 'g', ['Ğ'] = 'g', ['ı'] = 'i', ['İ'] = 'i',
            ['ö'] = 'o', ['Ö'] = 'o', ['ş'] = 's', ['Ş'] = 's', ['ü'] = 'u', ['Ü'] = 'u',
        };

        var builder = new StringBuilder();
        foreach (var character in (value ?? string.Empty).Trim())
        {
            var normalized = map.TryGetValue(character, out var replacement)
                ? replacement
                : char.ToLowerInvariant(character);
            if (char.IsAsciiLetterOrDigit(normalized)) builder.Append(normalized);
            else if (builder.Length > 0 && builder[^1] != '-') builder.Append('-');
        }

        return builder.ToString().Trim('-') is { Length: > 0 } slug ? slug : "onam-formu";
    }
}
