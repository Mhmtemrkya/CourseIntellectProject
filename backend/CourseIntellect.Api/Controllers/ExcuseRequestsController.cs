using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Veli tarafından gönderilen mazeret talepleri (Mazeret Bildirimi).
/// Velinin hangi çocuğu için hangi tarihte hangi nedenle mazeret bildirdiğini
/// kalıcı saklar. Yeni tablo açmaya gerek olmadan SiteContentItems üzerinde
/// CompatibilitySnapshotStore ile tenant scope'lu JSON liste tutulur.
///
/// Akış:
///   - Veli POST /api/excuse-requests           → yeni mazeret
///   - Veli GET  /api/excuse-requests/my        → kendi mazeretleri
///   - Admin/Öğretmen GET /api/excuse-requests  → tümü (tenant)
///   - Admin/Öğretmen PUT /{id}/decision        → onay/red
/// </summary>
[ApiController]
[Authorize]
[Route("api/excuse-requests")]
public sealed class ExcuseRequestsController(CourseIntellectDbContext dbContext) : ControllerBase
{
    public const string SectionKey = "excuse-requests";

    [HttpGet]
    [Authorize(Roles = "Admin,Administrative,Teacher")]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        var list = await CompatibilitySnapshotStore.LoadListAsync<ExcuseRequestSnapshot>(dbContext, SectionKey, cancellationToken);
        var ordered = list
            .OrderByDescending(item => item.CreatedAtUtc)
            .ToList();
        return Ok(ordered);
    }

    [HttpGet("my")]
    public async Task<IActionResult> MyRequests(CancellationToken cancellationToken)
    {
        var parentName = User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Name);
        var userName = User.FindFirstValue("unique_name") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(parentName) && string.IsNullOrWhiteSpace(userName))
        {
            return Unauthorized();
        }

        var key = CompatibilitySnapshotStore.NormalizeText(parentName ?? userName);
        var list = await CompatibilitySnapshotStore.LoadListAsync<ExcuseRequestSnapshot>(dbContext, SectionKey, cancellationToken);
        var mine = list
            .Where(item => CompatibilitySnapshotStore.NormalizeText(item.ParentName) == key
                || CompatibilitySnapshotStore.NormalizeText(item.ParentUsername) == key)
            .OrderByDescending(item => item.CreatedAtUtc)
            .ToList();
        return Ok(mine);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ExcuseRequestCreateRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ChildName) ||
            string.IsNullOrWhiteSpace(request.Date) ||
            string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new { message = "Öğrenci adı, tarih ve mazeret nedeni zorunludur." });
        }

        var parentName = User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Name) ?? string.Empty;
        var userName = User.FindFirstValue("unique_name") ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;

        var list = await CompatibilitySnapshotStore.LoadListAsync<ExcuseRequestSnapshot>(dbContext, SectionKey, cancellationToken);
        var entry = new ExcuseRequestSnapshot
        {
            Id = Guid.NewGuid(),
            ChildName = request.ChildName.Trim(),
            ParentName = parentName,
            ParentUsername = userName,
            Date = request.Date.Trim(),
            Type = string.IsNullOrWhiteSpace(request.Type) ? "other" : request.Type.Trim(),
            Reason = request.Reason.Trim(),
            Notes = request.Notes?.Trim() ?? string.Empty,
            AttachmentName = request.AttachmentName?.Trim() ?? string.Empty,
            AttachmentUrl = request.AttachmentUrl?.Trim() ?? string.Empty,
            AttachmentType = request.AttachmentType?.Trim() ?? string.Empty,
            Status = "Beklemede",
            CreatedAtUtc = DateTime.UtcNow,
        };
        list.Add(entry);

        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, list, parentName, cancellationToken);
        return Ok(entry);
    }

    [HttpPut("{id:guid}/decision")]
    [Authorize(Roles = "Admin,Administrative,Teacher")]
    public async Task<IActionResult> Decide(Guid id, [FromBody] ExcuseRequestDecisionRequest request, CancellationToken cancellationToken)
    {
        var decisionStatus = (request.Decision ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "approved" or "approve" or "onay" or "onayli" or "onayli" => "Onaylandi",
            "rejected" or "reject" or "red" or "reddet" => "Reddedildi",
            _ => string.Empty,
        };
        if (decisionStatus.Length == 0)
        {
            return BadRequest(new { message = "Geçerli bir karar belirtilmelidir (approved | rejected)." });
        }

        var list = await CompatibilitySnapshotStore.LoadListAsync<ExcuseRequestSnapshot>(dbContext, SectionKey, cancellationToken);
        var entry = list.FirstOrDefault(item => item.Id == id);
        if (entry is null)
        {
            return NotFound();
        }

        entry.Status = decisionStatus;
        entry.DecisionNote = request.DecisionNote?.Trim() ?? string.Empty;
        entry.DecidedByName = User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Name) ?? string.Empty;
        entry.DecidedAtUtc = DateTime.UtcNow;

        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, list, entry.DecidedByName, cancellationToken);
        return Ok(entry);
    }
}

public sealed class ExcuseRequestCreateRequest
{
    public string ChildName { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public string? AttachmentName { get; set; }
    public string? AttachmentUrl { get; set; }
    public string? AttachmentType { get; set; }
}

public sealed class ExcuseRequestDecisionRequest
{
    public string Decision { get; set; } = string.Empty;
    public string? DecisionNote { get; set; }
}

public sealed class ExcuseRequestSnapshot
{
    public Guid Id { get; set; }
    public string ChildName { get; set; } = string.Empty;
    public string ParentName { get; set; } = string.Empty;
    public string ParentUsername { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public string AttachmentName { get; set; } = string.Empty;
    public string AttachmentUrl { get; set; } = string.Empty;
    public string AttachmentType { get; set; } = string.Empty;
    public string Status { get; set; } = "Beklemede";
    public string DecisionNote { get; set; } = string.Empty;
    public string DecidedByName { get; set; } = string.Empty;
    public DateTime? DecidedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
