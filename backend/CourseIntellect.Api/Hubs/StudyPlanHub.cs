using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace CourseIntellect.Api.Hubs;

/// <summary>
/// Çalışma planı canlı senkronizasyonu. Öğrenci hangi cihazdan bağlanırsa
/// bağlansın kendi plan grubuna eklenir; plan her güncellendiğinde
/// "studyPlanUpdated" olayı güncel durumla yayınlanır. Böylece desktop ve
/// mobil aynı anda açıkken görev/hedef/XP değişimleri anında yansır.
/// </summary>
[Authorize]
public sealed class StudyPlanHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var fullName = Context.User?.FindFirstValue("name")
            ?? Context.User?.FindFirstValue(ClaimTypes.Name);
        if (!string.IsNullOrWhiteSpace(fullName))
        {
            await Groups.AddToGroupAsync(
                Context.ConnectionId,
                BuildStudentGroup(Context.User?.FindFirstValue("tenant_id"), fullName));
        }

        await base.OnConnectedAsync();
    }

    // Grup kurum + ad ile kurulur. Eskiden yalnız ad kullanılıyordu: başka
    // kurumda aynı ad-soyadlı bir kullanıcı bu öğrencinin plan güncellemelerini
    // canlı olarak alıyordu (plan verisi kurum filtreli olsa da yayın değildi).
    public static string BuildStudentGroup(string? tenantId, string studentName) =>
        $"studyplan-{(string.IsNullOrWhiteSpace(tenantId) ? "platform" : tenantId.Trim().ToLowerInvariant())}-{studentName.Trim().ToLowerInvariant()}";
}
