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
        var userId = Context.User?.FindFirstValue("sub") ?? Context.User?.FindFirstValue("nameid");
        if (Guid.TryParse(userId, out var id))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, BuildUserGroup(Context.User?.FindFirstValue("tenant_id"), id));
        }

        await base.OnConnectedAsync();
    }

    // Grup kurum + KULLANICI KİMLİĞİ ile kurulur. Eskiden ad kullanılıyordu: aynı kurumdaki aynı adlı
    // öğrenci (ve daha önce başka kurumdaki aynı adlı kullanıcı) bu öğrencinin plan güncellemelerini alıyordu.
    public static string BuildUserGroup(string? tenantId, Guid userId) =>
        $"studyplan-{(string.IsNullOrWhiteSpace(tenantId) ? "platform" : tenantId.Trim().ToLowerInvariant())}-{userId:N}";
}
