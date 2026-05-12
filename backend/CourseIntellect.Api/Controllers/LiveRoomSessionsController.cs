using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/liveroomsessions")]
public sealed class LiveRoomSessionsController(CourseIntellectDbContext dbContext) : ControllerBase
{
    public const string SectionKey = "live-room-sessions";

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? teacherName,
        [FromQuery] string? className,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        // CompatibilitySnapshotStore.LoadListAsync zaten tenant-scoped çalışır
        // (kullanıcı claim'inden TenantId çıkarır). Bu yüzden tüm tenant
        // session'ları döner, sonra teacher/class filtre ile rol bazlı daraltılır.
        var sessions = await CompatibilitySnapshotStore.LoadListAsync<LiveRoomSessionSnapshot>(dbContext, SectionKey, cancellationToken);

        IEnumerable<LiveRoomSessionSnapshot> query = sessions;

        if (!string.IsNullOrWhiteSpace(teacherName))
        {
            var teacherKey = CompatibilitySnapshotStore.NormalizeText(teacherName);
            query = query.Where(item => CompatibilitySnapshotStore.NormalizeText(item.TeacherName) == teacherKey);
        }

        if (!string.IsNullOrWhiteSpace(className))
        {
            var classKey = CompatibilitySnapshotStore.NormalizeText(className);
            query = query.Where(item => CompatibilitySnapshotStore.NormalizeText(item.ClassName) == classKey);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(item => string.Equals(item.Status, status, StringComparison.OrdinalIgnoreCase));
        }

        var ordered = query
            .OrderByDescending(item => item.Status == "Active")
            .ThenByDescending(item => item.StartedAtUtc)
            .ToList();

        var mapped = new List<object>(ordered.Count);
        foreach (var session in ordered)
        {
            mapped.Add(await MapSession(session, cancellationToken));
        }
        return Ok(mapped);
    }

    [HttpPost("open")]
    public async Task<IActionResult> Open([FromBody] LiveRoomOpenRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.LessonTitle) ||
            string.IsNullOrWhiteSpace(request.TeacherName) ||
            string.IsNullOrWhiteSpace(request.ClassName) ||
            string.IsNullOrWhiteSpace(request.TimeLabel))
        {
            return BadRequest(new { message = "Ders adı, öğretmen, sınıf ve saat zorunludur." });
        }

        var sessions = await CompatibilitySnapshotStore.LoadListAsync<LiveRoomSessionSnapshot>(dbContext, SectionKey, cancellationToken);
        var existing = sessions.FirstOrDefault(item =>
            item.Status == "Active" &&
            item.LessonTitle == request.LessonTitle.Trim() &&
            item.TeacherName == request.TeacherName.Trim() &&
            item.ClassName == request.ClassName.Trim() &&
            item.TimeLabel == request.TimeLabel.Trim());

        if (existing is null)
        {
            existing = new LiveRoomSessionSnapshot
            {
                Id = Guid.NewGuid(),
                LessonTitle = request.LessonTitle.Trim(),
                TeacherName = request.TeacherName.Trim(),
                ClassName = request.ClassName.Trim(),
                TimeLabel = request.TimeLabel.Trim(),
                MeetingLink = string.IsNullOrWhiteSpace(request.MeetingLink)
                    ? $"https://meet.courseintellect.live/{request.ClassName.Trim().ToLowerInvariant()}"
                    : request.MeetingLink.Trim(),
                Status = "Active",
                StartedAtUtc = DateTime.UtcNow,
            };
            sessions.Add(existing);
            await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, sessions, existing.TeacherName, cancellationToken);
        }

        return Ok(await MapSession(existing, cancellationToken));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var sessions = await CompatibilitySnapshotStore.LoadListAsync<LiveRoomSessionSnapshot>(dbContext, SectionKey, cancellationToken);
        var removed = sessions.RemoveAll(item => item.Id == id);
        if (removed == 0)
        {
            return NotFound();
        }

        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, sessions, User.Identity?.Name ?? "system", cancellationToken);
        return NoContent();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var sessions = await CompatibilitySnapshotStore.LoadListAsync<LiveRoomSessionSnapshot>(dbContext, SectionKey, cancellationToken);
        var session = sessions.FirstOrDefault(item => item.Id == id);
        return session is null ? NotFound() : Ok(await MapSession(session, cancellationToken));
    }

    [HttpPut("{id:guid}/state")]
    public async Task<IActionResult> UpdateState(Guid id, [FromBody] LiveRoomStateUpdateRequest request, CancellationToken cancellationToken)
    {
        var sessions = await CompatibilitySnapshotStore.LoadListAsync<LiveRoomSessionSnapshot>(dbContext, SectionKey, cancellationToken);
        var session = sessions.FirstOrDefault(item => item.Id == id);
        if (session is null)
        {
            return NotFound();
        }

        if (request.MicOn.HasValue) session.MicOn = request.MicOn.Value;
        if (request.CameraOn.HasValue) session.CameraOn = request.CameraOn.Value;
        if (request.SharingOn.HasValue) session.SharingOn = request.SharingOn.Value;
        if (request.RecordingOn.HasValue) session.RecordingOn = request.RecordingOn.Value;

        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, sessions, session.TeacherName, cancellationToken);
        return Ok(await MapSession(session, cancellationToken));
    }

    [HttpPost("{id:guid}/assets")]
    public async Task<IActionResult> AddAsset(Guid id, [FromBody] LiveRoomAssetCreateRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.FileName))
        {
            return BadRequest(new { message = "Dosya adı zorunludur." });
        }

        var sessions = await CompatibilitySnapshotStore.LoadListAsync<LiveRoomSessionSnapshot>(dbContext, SectionKey, cancellationToken);
        var session = sessions.FirstOrDefault(item => item.Id == id);
        if (session is null)
        {
            return NotFound();
        }

        session.Assets.Insert(0, new LiveRoomAssetSnapshot
        {
            Id = Guid.NewGuid(),
            FileName = request.FileName.Trim(),
            FileUrl = request.FileUrl?.Trim() ?? string.Empty,
            CreatedAtUtc = DateTime.UtcNow,
        });

        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, sessions, session.TeacherName, cancellationToken);
        return Ok(await MapSession(session, cancellationToken));
    }

    [HttpPost("{id:guid}/notes")]
    public async Task<IActionResult> AddNote(Guid id, [FromBody] LiveRoomNoteCreateRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
        {
            return BadRequest(new { message = "Not alanı zorunludur." });
        }

        var sessions = await CompatibilitySnapshotStore.LoadListAsync<LiveRoomSessionSnapshot>(dbContext, SectionKey, cancellationToken);
        var session = sessions.FirstOrDefault(item => item.Id == id);
        if (session is null)
        {
            return NotFound();
        }

        session.Notes.Insert(0, new LiveRoomNoteSnapshot
        {
            Id = Guid.NewGuid(),
            Text = request.Text.Trim(),
            CreatedAtUtc = DateTime.UtcNow,
        });

        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, sessions, session.TeacherName, cancellationToken);
        return Ok(await MapSession(session, cancellationToken));
    }

    [HttpPost("{id:guid}/end")]
    public async Task<IActionResult> End(Guid id, CancellationToken cancellationToken)
    {
        var sessions = await CompatibilitySnapshotStore.LoadListAsync<LiveRoomSessionSnapshot>(dbContext, SectionKey, cancellationToken);
        var session = sessions.FirstOrDefault(item => item.Id == id);
        if (session is null)
        {
            return NotFound();
        }

        session.Status = "Completed";
        session.EndedAtUtc = DateTime.UtcNow;
        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, sessions, session.TeacherName, cancellationToken);
        return Ok(await MapSession(session, cancellationToken));
    }

    private async Task<object> MapSession(LiveRoomSessionSnapshot session, CancellationToken cancellationToken)
    {
        var participants = await dbContext.Students
            .AsNoTracking()
            .Where(item => CompatibilitySnapshotStore.NormalizeText(item.ClassName) == CompatibilitySnapshotStore.NormalizeText(session.ClassName))
            .OrderBy(item => item.FullName)
            .Select(item => item.FullName)
            .ToListAsync(cancellationToken);

        return new
        {
            id = session.Id,
            lessonTitle = session.LessonTitle,
            teacherName = session.TeacherName,
            className = session.ClassName,
            timeLabel = session.TimeLabel,
            meetingLink = session.MeetingLink,
            micOn = session.MicOn,
            cameraOn = session.CameraOn,
            sharingOn = session.SharingOn,
            recordingOn = session.RecordingOn,
            status = session.Status,
            startedAtUtc = session.StartedAtUtc,
            endedAtUtc = session.EndedAtUtc,
            participants,
            assets = session.Assets.Select(item => new
            {
                id = item.Id,
                fileName = item.FileName,
                fileUrl = item.FileUrl,
                createdAtUtc = item.CreatedAtUtc,
            }).ToList(),
            notes = session.Notes.Select(item => new
            {
                id = item.Id,
                text = item.Text,
                createdAtUtc = item.CreatedAtUtc,
            }).ToList(),
        };
    }
}

public sealed class LiveRoomOpenRequest
{
    public string LessonTitle { get; set; } = string.Empty;
    public string TeacherName { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string TimeLabel { get; set; } = string.Empty;
    public string? MeetingLink { get; set; }
}

public sealed class LiveRoomStateUpdateRequest
{
    public bool? MicOn { get; set; }
    public bool? CameraOn { get; set; }
    public bool? SharingOn { get; set; }
    public bool? RecordingOn { get; set; }
}

public sealed class LiveRoomAssetCreateRequest
{
    public string FileName { get; set; } = string.Empty;
    public string? FileUrl { get; set; }
}

public sealed class LiveRoomNoteCreateRequest
{
    public string Text { get; set; } = string.Empty;
}

public sealed class LiveRoomSessionSnapshot
{
    public Guid Id { get; set; }
    public string LessonTitle { get; set; } = string.Empty;
    public string TeacherName { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string TimeLabel { get; set; } = string.Empty;
    public string MeetingLink { get; set; } = string.Empty;
    public bool MicOn { get; set; } = true;
    public bool CameraOn { get; set; } = true;
    public bool SharingOn { get; set; }
    public bool RecordingOn { get; set; }
    public string Status { get; set; } = "Active";
    public DateTime StartedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? EndedAtUtc { get; set; }
    public List<LiveRoomAssetSnapshot> Assets { get; set; } = [];
    public List<LiveRoomNoteSnapshot> Notes { get; set; } = [];
}

public sealed class LiveRoomAssetSnapshot
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class LiveRoomNoteSnapshot
{
    public Guid Id { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
