using CourseIntellect.Api.Security;
using CourseIntellect.Application.DTOs.OpticalExams;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Ders konusu listesi (soru stüdyosu, optik deneme ve sonraki ekranlar ortak kullanır). Optik deneme
/// yetkisi gerektirmez; kurum yöneticisi ve öğretmen (rehber dahil) erişir.
/// </summary>
[ApiController]
[Authorize(Roles = "Admin,Teacher")]
[Route("api/topics")]
public sealed class TopicsController(ITopicCatalogService service) : ControllerBase
{
    /// <summary>?level=LGS&amp;subject=Türkçe&amp;subject=Matematik (seviye boşsa bütün seviyeler).</summary>
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? level, [FromQuery(Name = "subject")] string[]? subjects, CancellationToken cancellationToken)
        => Ok(await service.GetTopicsAsync(level, subjects ?? [], cancellationToken));

    /// <summary>Kurum listesine konu ekler; hazır listede ya da kurum listesinde varsa mevcut yazımı döner.</summary>
    [HttpPost]
    public async Task<IActionResult> Add([FromBody] AddOpticalTopicRequest request, CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await service.AddTopicAsync(request, StudentScope.ResolveUserId(User), cancellationToken));
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    /// <summary>Yalnız seçim listesinden kaldırır; bu konuyu kullanan kayıtlar değişmez.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            await service.DeleteTopicAsync(id, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }
}
