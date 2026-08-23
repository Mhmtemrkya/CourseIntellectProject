using System.Security.Claims;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;

namespace CourseIntellect.Api.Hubs;

[Authorize]
public sealed class ServiceTrackingHub(CourseIntellectDbContext dbContext) : Hub
{
    /// <summary>
    /// Kurum geneli servis yayınını (tüm araç konumları + tüm öğrenci yoklamaları)
    /// yalnız yönetim rolleri alır. Eskiden kurumdaki HER kullanıcı bu gruba
    /// giriyordu; modülle ilgisi olmayan bir öğrenci bile bütün araçların canlı
    /// konumunu ve öğrenci yoklama olaylarını dinleyebiliyordu.
    /// </summary>
    private static readonly string[] InstitutionWideRoles =
        ["Admin", "Administrative", "InstitutionAdmin", "Idare", "BranchManager", "Developer"];

    public override async Task OnConnectedAsync()
    {
        var tenantId = ResolveTenantId();
        var userId = ResolveUserId();

        if (tenantId is not null && InstitutionWideRoles.Any(role => Context.User?.IsInRole(role) == true))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, BuildInstitutionGroup(tenantId.Value));
        }

        if (userId is Guid parsedUserId)
        {
            // Veli grubu kullanıcının KENDİ kimliğiyle adlandırılır; yalnız kendi
            // çocuğuna ait olaylar buraya düşer.
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

    /// <summary>Araç konum akışına yalnız yetkili taraflar katılabilir.</summary>
    public async Task JoinVehicle(Guid vehicleId)
    {
        if (!await CanAccessVehicleAsync(vehicleId)) return;
        await Groups.AddToGroupAsync(Context.ConnectionId, BuildVehicleGroup(vehicleId));
    }

    public Task LeaveVehicle(Guid vehicleId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, BuildVehicleGroup(vehicleId));

    /// <summary>Sefer akışına yalnız yetkili taraflar katılabilir.</summary>
    public async Task JoinTrip(Guid tripId)
    {
        if (!await CanAccessTripAsync(tripId)) return;
        await Groups.AddToGroupAsync(Context.ConnectionId, BuildTripGroup(tripId));
    }

    public Task LeaveTrip(Guid tripId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, BuildTripGroup(tripId));

    // ── Yetkilendirme ────────────────────────────────────────────────────────
    // Kural: yönetim rolleri kurumun her aracını/seferini izleyebilir; şoför yalnız
    // kendi rotasını/seferini; veli yalnız çocuğunun bindiği rotayı. Tenant, SignalR
    // akışında global query filter'a güvenilemediği için AÇIKÇA süzülür.

    private async Task<bool> CanAccessVehicleAsync(Guid vehicleId)
    {
        var tenantId = ResolveTenantId();
        var userId = ResolveUserId();
        if (tenantId is null || userId is null) return false;

        // Araç gerçekten bu kuruma ait mi?
        var vehicleInTenant = await dbContext.ServiceVehicles
            .IgnoreQueryFilters().AsNoTracking()
            .AnyAsync(x => x.Id == vehicleId && x.TenantId == tenantId);
        if (!vehicleInTenant) return false;

        if (InstitutionWideRoles.Any(role => Context.User?.IsInRole(role) == true)) return true;

        var routes = dbContext.ServiceRoutes.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.VehicleId == vehicleId);

        // Şoför: aracın bağlı olduğu rotalardan birinin sürücüsü.
        var driverIds = dbContext.ServiceDrivers.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.UserId == userId && x.IsActive)
            .Select(x => x.Id);
        if (await routes.AnyAsync(route => driverIds.Contains(route.DriverId))) return true;

        // Veli ya da öğrencinin kendisi: ilgili rotaya atama var mı?
        var assignedRouteIds = await ResolveAssignedRouteIdsAsync(userId.Value);
        return await routes.AnyAsync(route => assignedRouteIds.Contains(route.Id));
    }

    private async Task<bool> CanAccessTripAsync(Guid tripId)
    {
        var tenantId = ResolveTenantId();
        var userId = ResolveUserId();
        if (tenantId is null || userId is null) return false;

        var trip = await dbContext.ServiceTrips.AsNoTracking()
            .Where(x => x.Id == tripId)
            .Select(x => new { x.RouteId, x.DriverId })
            .FirstOrDefaultAsync();
        if (trip is null) return false;

        // Sefer kaydı tenant taşımıyor; kurum bağı rota üzerinden doğrulanır.
        var routeInTenant = await dbContext.ServiceRoutes
            .IgnoreQueryFilters().AsNoTracking()
            .AnyAsync(x => x.Id == trip.RouteId && x.TenantId == tenantId);
        if (!routeInTenant) return false;

        if (InstitutionWideRoles.Any(role => Context.User?.IsInRole(role) == true)) return true;

        // Şoför: seferin sürücüsü.
        var isDriver = await dbContext.ServiceDrivers
            .IgnoreQueryFilters().AsNoTracking()
            .AnyAsync(x => x.Id == trip.DriverId && x.TenantId == tenantId && x.UserId == userId && x.IsActive);
        if (isDriver) return true;

        // Veli ya da öğrencinin kendisi: seferin rotasına atanmış mı?
        var assignedRouteIds = await ResolveAssignedRouteIdsAsync(userId.Value);
        return assignedRouteIds.Contains(trip.RouteId);
    }

    /// <summary>
    /// Kullanıcının izlemeye hakkı olan servis rotaları.
    ///
    /// İKİ taraf da kapsanır: veli (çocuğunun servisi) VE öğrencinin kendisi
    /// (mobil "Servisim" ekranı). Öğrenci ataması <c>StudentServiceAssignment</c>'ta
    /// kullanıcı kimliğiyle değil ÖĞRENCİ PROFİLİ kimliğiyle tutulur; yalnız
    /// ParentId'ye bakmak öğrencileri kendi servislerinden keserdi.
    /// </summary>
    private async Task<HashSet<Guid>> ResolveAssignedRouteIdsAsync(Guid userId)
    {
        var studentProfileIds = await dbContext.Students.AsNoTracking()
            .Where(x => x.UserId == userId)
            .Select(x => x.Id)
            .ToListAsync();

        var routeIds = await dbContext.StudentServiceAssignments.AsNoTracking()
            .Where(x => x.IsActive && (x.ParentId == userId || studentProfileIds.Contains(x.StudentId)))
            .Select(x => x.RouteId)
            .ToListAsync();

        return routeIds.ToHashSet();
    }

    private Guid? ResolveTenantId()
        => Guid.TryParse(Context.User?.FindFirstValue("tenant_id"), out var tenantId) ? tenantId : null;

    private Guid? ResolveUserId()
    {
        var raw = Context.User?.FindFirstValue("user_id")
            ?? Context.User?.FindFirstValue("nameid")
            ?? Context.User?.FindFirstValue("sub")
            ?? Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var userId) ? userId : null;
    }

    public static string BuildInstitutionGroup(Guid institutionId) => $"institution-{institutionId}";
    public static string BuildVehicleGroup(Guid vehicleId) => $"vehicle-{vehicleId}";
    public static string BuildTripGroup(Guid tripId) => $"trip-{tripId}";
    public static string BuildParentGroup(Guid parentId) => $"parent-{parentId}";
    public static string BuildDriverGroup(Guid driverId) => $"driver-{driverId}";
}
