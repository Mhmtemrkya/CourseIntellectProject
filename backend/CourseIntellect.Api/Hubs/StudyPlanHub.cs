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
            await Groups.AddToGroupAsync(Context.ConnectionId, BuildStudentGroup(fullName));
        }

        await base.OnConnectedAsync();
    }

    public static string BuildStudentGroup(string studentName) =>
        $"studyplan-{studentName.Trim().ToLowerInvariant()}";
}
