namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Belgelerde kullanılan kurum künyesi. <see cref="IsConfigured"/> false ise
/// değerler henüz kaydedilmemiştir; sürücü kursu form ayarları ve çalışma alanı
/// kaydından türetilmiş öneri olarak döner (ekranda ön-doldurma için).
/// </summary>
public sealed record InstitutionProfileDto(
    string Name,
    string Address,
    string District,
    string City,
    string Phone,
    string Email,
    string Website,
    string TaxOffice,
    string TaxNumber,
    string DocumentFooterNote,
    bool IsConfigured,
    DateTime? UpdatedAtUtc)
{
    /// <summary>Belge başlığındaki "İlçe / İL" satırı; ikisi de boşsa boş döner.</summary>
    public string Location => string.Join(" / ", new[]
    {
        District,
        string.IsNullOrWhiteSpace(City) ? null : City.ToUpper(System.Globalization.CultureInfo.GetCultureInfo("tr-TR")),
    }.Where(part => !string.IsNullOrWhiteSpace(part)));
}

public sealed record SaveInstitutionProfileRequest(
    string? Name,
    string? Address,
    string? District,
    string? City,
    string? Phone,
    string? Email,
    string? Website,
    string? TaxOffice,
    string? TaxNumber,
    string? DocumentFooterNote);

public interface IInstitutionProfileService
{
    /// <summary>Kayıtlı künye; eksik alanlar mevcut kurum verisinden tamamlanır.</summary>
    Task<InstitutionProfileDto> GetEffectiveAsync(CancellationToken cancellationToken = default);

    Task<InstitutionProfileDto> SaveAsync(
        SaveInstitutionProfileRequest request,
        Guid? updatedByUserId,
        CancellationToken cancellationToken = default);
}
