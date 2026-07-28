using System.Security.Claims;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Kurum künyesi: ekstre, makbuz ve resmî belgelerin başlığında görünen kurum
/// bilgileri. Okuma belgeyi üretebilecek roller için açıktır; değiştirme yalnız
/// kurum yöneticisine aittir.
/// </summary>
[ApiController]
[Authorize(Roles = "Admin,Accounting,Administrative")]
[Route("api/institution-profile")]
public sealed class InstitutionProfileController(
    IInstitutionProfileService institutionProfileService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var profile = await institutionProfileService.GetEffectiveAsync(cancellationToken);
        return Ok(Present(profile));
    }

    [HttpPut]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Save(
        [FromBody] SaveInstitutionProfileRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Kurum adı zorunludur." });
        }

        if (!string.IsNullOrWhiteSpace(request.Email) && !request.Email.Contains('@'))
        {
            return BadRequest(new { message = "Geçerli bir e-posta adresi girin." });
        }

        var saved = await institutionProfileService.SaveAsync(request, CurrentUserId(), cancellationToken);
        return Ok(Present(saved));
    }

    // Location (İlçe / İL) hesaplanan alandır; istemci belgeyle aynı satırı görsün.
    private static object Present(InstitutionProfileDto profile) => new
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
        profile.IsConfigured,
        profile.UpdatedAtUtc,
        profile.Location,
    };

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
