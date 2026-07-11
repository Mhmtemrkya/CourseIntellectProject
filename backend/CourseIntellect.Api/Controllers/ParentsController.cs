using CourseIntellect.Api.Authorization;
using CourseIntellect.Application.DTOs.Parents;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class ParentsController(IAcademicQueryService academicQueryService) : ControllerBase
{
    [HttpPost]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("parents", "create")]
    [ProducesResponseType(typeof(ParentCredentialsDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateParent(
        [FromBody] CreateParentRequest request,
        CancellationToken cancellationToken)
    {
        var result = await academicQueryService.CreateParentAsync(request, cancellationToken);
        return Created(string.Empty, result);
    }

    /// <summary>Veli hesapları: durum (aktif/pasif) ve bağlı öğrencilerle birlikte. Pasifleştirme yönetimi için.</summary>
    [HttpGet("accounts")]
    [Authorize(Roles = "Admin,Administrative")]
    [ProducesResponseType(typeof(IReadOnlyList<ParentAccountDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetParentAccounts(CancellationToken cancellationToken)
    {
        return Ok(await academicQueryService.GetParentAccountsAsync(cancellationToken));
    }
}
