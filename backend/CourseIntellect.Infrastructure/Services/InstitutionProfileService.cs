using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Kurum belge künyesinin tek kaynağı. Kayıtlı künye önceliklidir; boş bırakılan
/// alanlar sırayla sürücü kursu form ayarlarından (MEB evrakları için zaten
/// girilmiş kurum bilgisi) ve çalışma alanı kaydından tamamlanır. Böylece künye
/// hiç doldurulmamış kurumlarda da belge başlığı boş çıkmaz.
/// </summary>
public sealed class InstitutionProfileService(
    CourseIntellectDbContext dbContext,
    ITenantContext tenantContext,
    IAuditLogService auditLogService) : IInstitutionProfileService
{
    private const string AuditCategory = "Institution";

    public async Task<InstitutionProfileDto> GetEffectiveAsync(CancellationToken cancellationToken = default)
    {
        var profile = await dbContext.InstitutionProfiles.AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);
        return await ComposeAsync(profile, cancellationToken);
    }

    public async Task<InstitutionProfileDto> SaveAsync(
        SaveInstitutionProfileRequest request,
        Guid? updatedByUserId,
        CancellationToken cancellationToken = default)
    {
        var profile = await dbContext.InstitutionProfiles.FirstOrDefaultAsync(cancellationToken);
        var before = profile is null ? null : Snapshot(profile);
        if (profile is null)
        {
            profile = new InstitutionProfile { TenantId = tenantContext.CurrentTenantId };
            dbContext.InstitutionProfiles.Add(profile);
        }

        profile.Name = Trim(request.Name, 200);
        profile.Address = Trim(request.Address, 400);
        profile.District = Trim(request.District, 60);
        profile.City = Trim(request.City, 60);
        profile.Phone = Trim(request.Phone, 30);
        profile.Email = Trim(request.Email, 150);
        profile.Website = Trim(request.Website, 150);
        profile.TaxOffice = Trim(request.TaxOffice, 120);
        profile.TaxNumber = Trim(request.TaxNumber, 30);
        profile.DocumentFooterNote = Trim(request.DocumentFooterNote, 300);
        profile.UpdatedByUserId = updatedByUserId;
        profile.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        // Künye ekstre/makbuz gibi kuruma ait belgelerin başlığıdır; değişimi izlenir.
        await auditLogService.LogChangeAsync(
            "Kurum künyesi güncellendi",
            AuditCategory,
            nameof(InstitutionProfile),
            profile.Id.ToString(),
            "Belge başlıklarında kullanılan kurum adı, adres ve iletişim bilgileri değişti.",
            before,
            Snapshot(profile),
            cancellationToken);

        return await ComposeAsync(profile, cancellationToken);
    }

    private async Task<InstitutionProfileDto> ComposeAsync(
        InstitutionProfile? profile,
        CancellationToken cancellationToken)
    {
        var settings = await dbContext.DrivingSchoolSettings.AsNoTracking()
            .Select(item => new
            {
                item.FormInstitutionName,
                item.FormInstitutionAddress,
                item.FormInstitutionCity,
                item.FormInstitutionDistrict,
                item.FormInstitutionPhone,
            })
            .FirstOrDefaultAsync(cancellationToken);

        var workspace = tenantContext.CurrentTenantId is Guid tenantId
            ? await dbContext.TenantWorkspaces.AsNoTracking()
                .Where(item => item.Id == tenantId)
                .Select(item => new { item.Name, item.ContactEmail, item.ContactPhone })
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        return new InstitutionProfileDto(
            Pick(profile?.Name, settings?.FormInstitutionName, workspace?.Name),
            Pick(profile?.Address, settings?.FormInstitutionAddress),
            Pick(profile?.District, settings?.FormInstitutionDistrict),
            Pick(profile?.City, settings?.FormInstitutionCity),
            Pick(profile?.Phone, settings?.FormInstitutionPhone, workspace?.ContactPhone),
            Pick(profile?.Email, workspace?.ContactEmail),
            profile?.Website ?? string.Empty,
            profile?.TaxOffice ?? string.Empty,
            profile?.TaxNumber ?? string.Empty,
            profile?.DocumentFooterNote ?? string.Empty,
            profile is not null,
            profile?.UpdatedAtUtc);
    }

    private static object Snapshot(InstitutionProfile profile) => new
    {
        profile.Name,
        profile.Address,
        profile.District,
        profile.City,
        profile.Phone,
        profile.Email,
        profile.Website,
        profile.TaxOffice,
        profile.TaxNumber,
        profile.DocumentFooterNote,
    };

    private static string Trim(string? value, int maxLength)
    {
        var trimmed = (value ?? string.Empty).Trim();
        return trimmed.Length > maxLength ? trimmed[..maxLength] : trimmed;
    }

    private static string Pick(params string?[] candidates) =>
        candidates.FirstOrDefault(item => !string.IsNullOrWhiteSpace(item))?.Trim() ?? string.Empty;
}
