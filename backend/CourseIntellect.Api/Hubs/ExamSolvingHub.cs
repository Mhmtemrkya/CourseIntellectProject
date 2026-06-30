using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace CourseIntellect.Api.Hubs;

[Authorize]
public sealed class ExamSolvingHub : Hub
{
    public Task JoinExamSession(string sessionId)
    {
        return Groups.AddToGroupAsync(Context.ConnectionId, $"session-{sessionId}");
    }

    public Task LeaveExamSession(string sessionId)
    {
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, $"session-{sessionId}");
    }

    // Öğretmen, bir planlı sınavın canlı kamera izleme grubuna katılır.
    public Task JoinExamMonitor(string examId)
    {
        return Groups.AddToGroupAsync(Context.ConnectionId, MonitorGroup(examId));
    }

    public Task LeaveExamMonitor(string examId)
    {
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, MonitorGroup(examId));
    }

    // Öğrenci sınav ekranından periyodik kamera karesi (küçük JPEG, data URL)
    // gönderir; karenin tamamı o sınavın izleyici (öğretmen) grubuna yayınlanır.
    // Kare verisi sunucuda saklanmaz, yalnızca anlık olarak iletilir.
    public Task PublishCameraFrame(string examId, string studentUsername, string studentName, string frame)
    {
        if (string.IsNullOrWhiteSpace(examId) || string.IsNullOrWhiteSpace(frame))
        {
            return Task.CompletedTask;
        }

        return Clients.Group(MonitorGroup(examId)).SendAsync("cameraFrame", new
        {
            examId,
            studentUsername = studentUsername ?? string.Empty,
            studentName = studentName ?? string.Empty,
            frame,
            atUtc = DateTime.UtcNow,
        });
    }

    private static string MonitorGroup(string examId) => $"exam-monitor-{examId}";
}
