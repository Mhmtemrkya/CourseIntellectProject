namespace CourseIntellect.Application.Interfaces;

/// <param name="TemporaryPassword">Belgeye basılacak geçici parola. Hiçbir yerde
/// saklanmaz; yalnız üretim anında bellekte bulunur.</param>
public sealed record TenantSetupDocumentModel(
    string InstitutionName,
    string Plan,
    string InstitutionType,
    string LoginUrl,
    string Username,
    string TemporaryPassword,
    DateTime? PasswordExpiresAtUtc,
    string IssuedByName,
    DateTime IssuedAtUtc);

/// <summary>Kuruma elden teslim edilecek "Kurum Kurulum Belgesi" (PDF).</summary>
public interface ITenantSetupDocumentService
{
    byte[] Generate(TenantSetupDocumentModel model);
}
