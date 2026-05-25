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
}
