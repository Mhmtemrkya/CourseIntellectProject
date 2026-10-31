using CourseIntellect.Api.Authorization;
using CourseIntellect.Api.Security;
using CourseIntellect.Application.DTOs.Preference;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// LGS/YKS tercih robotu. Öğrenci kendi tercih listesini tutar; öğretmen,
/// rehber ve yönetici robotu öğrenciyle birlikte kullanabilir. Veri resmî
/// ÖSYM/MEB yayımlarından gelir; her sonuç kaynağını ve yılını taşır.
/// </summary>
[ApiController]
[Authorize(Roles = "Admin,Administrative,Teacher,Student,Parent")]
[Route("api/preference-robot")]
[RequireEntitlement("preference-robot")]
public sealed class PreferenceRobotController(IPreferenceRobotService service) : ControllerBase
{
    [HttpGet("meta")]
    public async Task<IActionResult> Meta([FromQuery] string? exam, CancellationToken cancellationToken) => Ok(await service.GetMetaAsync(exam, cancellationToken));

    [HttpGet("options")]
    public async Task<IActionResult> Options([FromQuery] PreferenceOptionsRequest request, CancellationToken cancellationToken)
        => Ok(await service.GetOptionsAsync(request, cancellationToken));

    [HttpPost("estimate")]
    public IActionResult Estimate([FromBody] PreferenceNetInput input)
    {
        try
        {
            return Ok(service.Estimate(input));
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("search")]
    public async Task<IActionResult> Search([FromBody] PreferenceSearchRequest request, CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await service.SearchAsync(request, cancellationToken));
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpGet("choices")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> GetChoices([FromQuery] string exam, CancellationToken cancellationToken)
    {
        if (StudentScope.ResolveUserId(User) is not Guid userId) return Unauthorized();
        try
        {
            return Ok(await service.GetChoicesAsync(userId, exam, cancellationToken));
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("choices")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> SaveChoices([FromBody] SavePreferenceChoicesRequest request, CancellationToken cancellationToken)
    {
        if (StudentScope.ResolveUserId(User) is not Guid userId) return Unauthorized();
        try
        {
            return Ok(await service.SaveChoicesAsync(userId, request, cancellationToken));
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }
}

/// <summary>
/// Platform yöneticisinin LGS okul verisini yüklemesi (MEB toplu dosya yayımlamaz).
/// Ulusal veri olduğu için kurum yöneticisi yükleyemez.
/// </summary>
[ApiController]
[Authorize(Policy = "PlatformAdmin")]
[Route("api/platform/preference-data")]
public sealed class PreferenceDataController(IPreferenceRobotService service) : ControllerBase
{
    [HttpPost("lgs")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> ImportLgs([FromForm] int year, [FromForm] string source, [FromForm] string sourceUrl, IFormFile file, CancellationToken cancellationToken)
    {
        try
        {
            await using var stream = file.OpenReadStream();
            return Ok(await service.ImportLgsCsvAsync(year, source, sourceUrl, stream, cancellationToken));
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }
}
