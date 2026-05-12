using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Öğretmenin sınıf yoklaması için açtığı QR/kiosk oturumları. Tenant scope'lu,
/// kalıcı; LIVE_LESSON announcement parse'ı yerine bu endpoint kullanılır.
///
/// Akış:
///   - Öğretmen POST /open    → yeni session, kısa süreli token üretir
///   - Öğrenci  POST /check-in → token + öğrenci adı ile yoklama
///   - Öğretmen POST /{id}/close → oturumu kapatır
///   - GET /active            → açık oturumlar (öğrenci paneli için)
/// SiteContentItems üzerinde CompatibilitySnapshotStore ile tenant scope sağlanır.
/// </summary>
[ApiController]
[Authorize]
[Route("api/attendance-qr-sessions")]
public sealed class AttendanceQrSessionsController(CourseIntellectDbContext dbContext) : ControllerBase
{
    public const string SectionKey = "attendance-qr-sessions";
    private static readonly TimeSpan DefaultLifetime = TimeSpan.FromMinutes(15);

    [HttpGet]
    [Authorize(Roles = "Admin,Administrative,Teacher")]
    public async Task<IActionResult> List([FromQuery] string? className, [FromQuery] string? status, CancellationToken cancellationToken)
    {
        var sessions = await CompatibilitySnapshotStore.LoadListAsync<AttendanceQrSessionSnapshot>(dbContext, SectionKey, cancellationToken);
        IEnumerable<AttendanceQrSessionSnapshot> query = sessions;

        if (!string.IsNullOrWhiteSpace(className))
        {
            var key = CompatibilitySnapshotStore.NormalizeText(className);
            query = query.Where(item => CompatibilitySnapshotStore.NormalizeText(item.ClassName) == key);
        }
        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(item => string.Equals(item.Status, status, StringComparison.OrdinalIgnoreCase));
        }

        var ordered = query
            .OrderByDescending(item => item.Status == "Active")
            .ThenByDescending(item => item.OpenedAtUtc)
            .ToList();
        return Ok(ordered);
    }

    [HttpGet("active")]
    public async Task<IActionResult> Active([FromQuery] string? className, CancellationToken cancellationToken)
    {
        var sessions = await CompatibilitySnapshotStore.LoadListAsync<AttendanceQrSessionSnapshot>(dbContext, SectionKey, cancellationToken);
        var now = DateTime.UtcNow;

        IEnumerable<AttendanceQrSessionSnapshot> active = sessions
            .Where(item => item.Status == "Active" && item.ExpiresAtUtc > now);

        if (!string.IsNullOrWhiteSpace(className))
        {
            var key = CompatibilitySnapshotStore.NormalizeText(className);
            active = active.Where(item => CompatibilitySnapshotStore.NormalizeText(item.ClassName) == key);
        }

        return Ok(active.OrderByDescending(item => item.OpenedAtUtc).ToList());
    }

    [HttpPost("open")]
    [Authorize(Roles = "Admin,Administrative,Teacher")]
    public async Task<IActionResult> Open([FromBody] AttendanceQrOpenRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ClassName) || string.IsNullOrWhiteSpace(request.LessonTitle))
        {
            return BadRequest(new { message = "Sınıf ve ders adı zorunludur." });
        }

        var teacherName = User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Name) ?? "Öğretmen";
        var lifetime = request.DurationMinutes is int min and > 0 and <= 240
            ? TimeSpan.FromMinutes(min)
            : DefaultLifetime;

        var sessions = await CompatibilitySnapshotStore.LoadListAsync<AttendanceQrSessionSnapshot>(dbContext, SectionKey, cancellationToken);
        var entry = new AttendanceQrSessionSnapshot
        {
            Id = Guid.NewGuid(),
            ClassName = request.ClassName.Trim(),
            LessonTitle = request.LessonTitle.Trim(),
            TeacherName = teacherName,
            Token = Guid.NewGuid().ToString("N"),
            OpenedAtUtc = DateTime.UtcNow,
            ExpiresAtUtc = DateTime.UtcNow + lifetime,
            Status = "Active",
        };
        sessions.Add(entry);

        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, sessions, teacherName, cancellationToken);
        return Ok(entry);
    }

    [HttpPost("check-in")]
    public async Task<IActionResult> CheckIn([FromBody] AttendanceQrCheckInRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(new { message = "Token zorunludur." });
        }

        var sessions = await CompatibilitySnapshotStore.LoadListAsync<AttendanceQrSessionSnapshot>(dbContext, SectionKey, cancellationToken);
        var session = sessions.FirstOrDefault(item => string.Equals(item.Token, request.Token.Trim(), StringComparison.Ordinal));
        if (session is null)
        {
            return NotFound(new { message = "Oturum bulunamadı." });
        }
        if (session.Status != "Active" || session.ExpiresAtUtc <= DateTime.UtcNow)
        {
            return BadRequest(new { message = "Oturum süresi geçmiş veya kapalı." });
        }

        var studentName = string.IsNullOrWhiteSpace(request.StudentName)
            ? (User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Name) ?? string.Empty)
            : request.StudentName.Trim();
        if (string.IsNullOrWhiteSpace(studentName))
        {
            return BadRequest(new { message = "Öğrenci bilgisi gerekli." });
        }

        var key = CompatibilitySnapshotStore.NormalizeText(studentName);
        if (!session.ScannedStudents.Any(item => CompatibilitySnapshotStore.NormalizeText(item.StudentName) == key))
        {
            session.ScannedStudents.Add(new AttendanceQrScanEntry
            {
                StudentName = studentName,
                ScannedAtUtc = DateTime.UtcNow,
            });
            await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, sessions, session.TeacherName, cancellationToken);
        }

        return Ok(session);
    }

    [HttpPost("{id:guid}/close")]
    [Authorize(Roles = "Admin,Administrative,Teacher")]
    public async Task<IActionResult> Close(Guid id, CancellationToken cancellationToken)
    {
        var sessions = await CompatibilitySnapshotStore.LoadListAsync<AttendanceQrSessionSnapshot>(dbContext, SectionKey, cancellationToken);
        var session = sessions.FirstOrDefault(item => item.Id == id);
        if (session is null)
        {
            return NotFound();
        }

        session.Status = "Closed";
        session.ClosedAtUtc = DateTime.UtcNow;

        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, sessions, session.TeacherName, cancellationToken);
        return Ok(session);
    }
}

public sealed class AttendanceQrOpenRequest
{
    public string ClassName { get; set; } = string.Empty;
    public string LessonTitle { get; set; } = string.Empty;
    public int? DurationMinutes { get; set; }
}

public sealed class AttendanceQrCheckInRequest
{
    public string Token { get; set; } = string.Empty;
    public string? StudentName { get; set; }
}

public sealed class AttendanceQrSessionSnapshot
{
    public Guid Id { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public string LessonTitle { get; set; } = string.Empty;
    public string TeacherName { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public DateTime OpenedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAtUtc { get; set; } = DateTime.UtcNow.AddMinutes(15);
    public DateTime? ClosedAtUtc { get; set; }
    public string Status { get; set; } = "Active";
    public List<AttendanceQrScanEntry> ScannedStudents { get; set; } = [];
}

public sealed class AttendanceQrScanEntry
{
    public string StudentName { get; set; } = string.Empty;
    public DateTime ScannedAtUtc { get; set; } = DateTime.UtcNow;
}
