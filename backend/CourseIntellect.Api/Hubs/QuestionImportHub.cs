using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace CourseIntellect.Api.Hubs;

[Authorize]
public sealed class QuestionImportHub : Hub
{
    public Task JoinImport(string importId)
    {
        return Groups.AddToGroupAsync(Context.ConnectionId, BuildImportGroup(importId));
    }

    public Task LeaveImport(string importId)
    {
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, BuildImportGroup(importId));
    }

    public static string BuildImportGroup(string importId) => $"question-import-{importId}";
}
