using System.Security.Claims;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;

namespace CourseIntellect.Api.Hubs;

[Authorize]
public sealed class ServiceTrackingHub(CourseIntellectDbContext dbContext) : Hub
{
    public override async Task OnConnectedAsync()
    {
        var tenantId = Context.User?.FindFirstValue("tenant_id");
        var userId = Context.User?.FindFirstValue("user_id")
            ?? Context.User?.FindFirstValue("nameid")
            ?? Context.User?.FindFirstValue("sub")
            ?? Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!string.IsNullOrWhiteSpace(tenantId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, BuildInstitutionGroup(Guid.Parse(tenantId)));
        }

        if (!string.IsNullOrWhiteSpace(userId) && Guid.TryParse(userId, out var parsedUserId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, BuildParentGroup(parsedUserId));
            var driverId = await dbContext.ServiceDrivers
                .Where(x => x.UserId == parsedUserId && x.IsActive)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync();
            if (driverId.HasValue)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, BuildDriverGroup(driverId.Value));
            }
        }

        await base.OnConnectedAsync();
    }

    public Task JoinVehicle(Guid vehicleId) => Groups.AddToGroupAsync(Context.ConnectionId, BuildVehicleGroup(vehicleId));
    public Task LeaveVehicle(Guid vehicleId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, BuildVehicleGroup(vehicleId));
    public Task JoinTrip(Guid tripId) => Groups.AddToGroupAsync(Context.ConnectionId, BuildTripGroup(tripId));
    public Task LeaveTrip(Guid tripId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, BuildTripGroup(tripId));

    public static string BuildInstitutionGroup(Guid institutionId) => $"institution-{institutionId}";
    public static string BuildVehicleGroup(Guid vehicleId) => $"vehicle-{vehicleId}";
    public static string BuildTripGroup(Guid tripId) => $"trip-{tripId}";
    public static string BuildParentGroup(Guid parentId) => $"parent-{parentId}";
    public static string BuildDriverGroup(Guid driverId) => $"driver-{driverId}";
}
