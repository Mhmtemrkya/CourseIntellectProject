using System.Security.Claims;
using System.Text.Json;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Hubs;

[Authorize]
public sealed class ExamSolvingHub(CourseIntellectDbContext dbContext) : Hub
{
    /// <summary>İzleme grubuna yalnız öğretmen/yönetici rolleri girebilir.</summary>
    private static readonly string[] MonitorRoles =
        ["Teacher", "Admin", "Administrative", "InstitutionAdmin", "Idare", "BranchManager", "Developer"];

    public Task JoinExamSession(string sessionId)
    {
        return Groups.AddToGroupAsync(Context.ConnectionId, $"session-{sessionId}");
    }

    public Task LeaveExamSession(string sessionId)
    {
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, $"session-{sessionId}");
    }

    /// <summary>
    /// Öğretmen, bir planlı sınavın canlı kamera izleme grubuna katılır.
    /// Eskiden hiçbir kontrol yoktu: herhangi bir kimlik doğrulanmış kullanıcı —
    /// öğrenci dahil — başka bir sınavın kamera yayınını dinleyebiliyordu.
    /// Artık hem rol hem de sınavın çağıranın kurumuna ait olması aranır.
    /// </summary>
    public async Task JoinExamMonitor(string examId)
    {
        if (!await CanMonitorAsync(examId)) return;
        await Groups.AddToGroupAsync(Context.ConnectionId, MonitorGroup(examId));
    }

    public Task LeaveExamMonitor(string examId)
    {
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, MonitorGroup(examId));
    }

    /// <summary>
    /// Öğrenci sınav ekranından periyodik kamera karesi (küçük JPEG, data URL)
    /// gönderir; karenin tamamı o sınavın izleyici (öğretmen) grubuna yayınlanır.
    /// Kare verisi sunucuda saklanmaz, yalnızca anlık olarak iletilir.
    ///
    /// studentUsername/studentName parametreleri geriye uyumluluk için imzada
    /// DURUR ama KULLANILMAZ: kimlik, çağıranın o sınava ait kendi oturumundan
    /// okunur. Eskiden istemci bu alanları serbestçe doldurabildiği için başka bir
    /// öğrencinin adıyla sahte kare yayınlanabiliyordu.
    /// </summary>
    public async Task PublishCameraFrame(string examId, string? studentUsername, string? studentName, string frame)
    {
        if (string.IsNullOrWhiteSpace(examId) || string.IsNullOrWhiteSpace(frame)) return;
        if (!Guid.TryParse(examId.Trim(), out var parsedExamId)) return;

        var callerUsername = ResolveUsername();
        if (string.IsNullOrWhiteSpace(callerUsername)) return;

        // Çağıranın BU sınava ait, KENDİ kullanıcı adına açılmış aktif oturumu var mı?
        // Yoksa kare yayınlanmaz — yabancı bir sınava kare enjekte edilemez.
        var sessions = await LoadTenantExamSessionsAsync();
        var session = sessions.FirstOrDefault(x =>
            x.PlannedExamId == parsedExamId
            && x.Status == "Active"
            && string.Equals(x.StudentUsername.Trim(), callerUsername, StringComparison.OrdinalIgnoreCase));
        if (session is null) return;

        await Clients.Group(MonitorGroup(examId)).SendAsync("cameraFrame", new
        {
            examId,
            // Kimlik oturum kaydından gelir, istemciden değil.
            studentUsername = session.StudentUsername,
            studentName = session.StudentName,
            frame,
            atUtc = DateTime.UtcNow,
        });
    }

    /// <summary>
    /// İzleme yetkisi: rol kapısı + sınavın çağıranın kurumunda gerçekten var olması.
    /// Tenant, SignalR akışında global query filter'a güvenilemediği için AÇIKÇA
    /// süzülür (hub'da HttpContext güvenilir değildir).
    /// </summary>
    private async Task<bool> CanMonitorAsync(string examId)
    {
        if (!Guid.TryParse(examId?.Trim(), out var parsedExamId)) return false;
        if (!MonitorRoles.Any(role => Context.User?.IsInRole(role) == true)) return false;

        // Sınav çağıranın kurumunda gerçekten var mı? (Kurumlar arası izleme kapalı.)
        var sessions = await LoadTenantExamSessionsAsync();
        return sessions.Any(x => x.PlannedExamId == parsedExamId);
    }

    /// <summary>
    /// Planlı sınav oturumları EF tablosunda değil, uyumluluk anlık görüntü
    /// deposunda (SiteContentItems / "exam-sessions") tutulur. Hub'da HttpContext
    /// güvenilir olmadığı için global tenant filtresine GÜVENİLMEZ; kurum açıkça
    /// süzülür, aksi hâlde başka kurumun oturumları okunabilirdi.
    /// </summary>
    private async Task<List<Controllers.ExamSessionSnapshot>> LoadTenantExamSessionsAsync()
    {
        if (!Guid.TryParse(Context.User?.FindFirstValue("tenant_id"), out var tenantId))
        {
            return [];
        }

        var raw = await dbContext.SiteContentItems
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(item => item.TenantId == tenantId
                && item.SectionKey == Controllers.ExamSessionsController.SectionKey
                && item.Language == "tr")
            .OrderByDescending(item => item.Version)
            .Select(item => item.ContentJson)
            .FirstOrDefaultAsync();

        if (string.IsNullOrWhiteSpace(raw)) return [];

        try
        {
            return JsonSerializer.Deserialize<List<Controllers.ExamSessionSnapshot>>(
                raw, new JsonSerializerOptions(JsonSerializerDefaults.Web)) ?? [];
        }
        catch
        {
            return [];
        }
    }

    /// <summary>Çağıranın kullanıcı adı — oturum kaydıyla eşleşen alan budur.</summary>
    private string ResolveUsername()
        => (Context.User?.FindFirstValue("unique_name")
            ?? Context.User?.FindFirstValue("username")
            ?? Context.User?.FindFirstValue("preferred_username")
            ?? Context.User?.FindFirstValue(ClaimTypes.Name)
            ?? string.Empty).Trim();

    private static string MonitorGroup(string examId) => $"exam-monitor-{examId}";
}
