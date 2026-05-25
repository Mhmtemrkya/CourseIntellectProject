using CourseIntellect.Application.DTOs.Notifications;
using CourseIntellect.Application.DTOs.ServiceTracking;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CourseIntellect.Infrastructure.Services;

public sealed class ServiceTrackingService(
    CourseIntellectDbContext dbContext,
    IHttpContextAccessor httpContextAccessor,
    IETAService etaService,
    INotificationService notificationService,
    IServiceTrackingRealtimeNotifier realtimeNotifier) : IServiceTrackingService
{
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));

    public async Task<ServiceVehicleDto> CreateVehicleAsync(CreateServiceVehicleRequest request, CancellationToken cancellationToken = default)
    {
        ValidateVehicle(request.PlateNumber, request.Capacity);
        var tenantId = RequireTenantId();
        var duplicate = await dbContext.ServiceVehicles
            .AnyAsync(x => x.TenantId == tenantId && x.PlateNumber == request.PlateNumber.Trim(), cancellationToken);
        if (duplicate)
        {
            throw new InvalidOperationException("Bu plakaya ait servis aracı zaten var.");
        }

        var item = new ServiceVehicle
        {
            TenantId = tenantId,
            PlateNumber = request.PlateNumber.Trim().ToUpperInvariant(),
            Brand = request.Brand.Trim(),
            Model = request.Model.Trim(),
            Capacity = request.Capacity,
            IsActive = request.IsActive,
        };

        await dbContext.ServiceVehicles.AddAsync(item, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return MapVehicle(item);
    }

    public async Task<IReadOnlyList<ServiceVehicleDto>> GetVehiclesAsync(CancellationToken cancellationToken = default)
    {
        var tenantId = RequireTenantId();
        return await dbContext.ServiceVehicles
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.IsActive)
            .ThenBy(x => x.PlateNumber)
            .Select(x => MapVehicle(x))
            .ToListAsync(cancellationToken);
    }

    public async Task<ServiceVehicleDto?> GetVehicleAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var item = await FindVehicleAsync(id, cancellationToken);
        return item is null ? null : MapVehicle(item);
    }

    public async Task<ServiceVehicleDto?> UpdateVehicleAsync(Guid id, UpdateServiceVehicleRequest request, CancellationToken cancellationToken = default)
    {
        ValidateVehicle(request.PlateNumber, request.Capacity);
        var item = await FindVehicleAsync(id, cancellationToken);
        if (item is null)
        {
            return null;
        }

        item.PlateNumber = request.PlateNumber.Trim().ToUpperInvariant();
        item.Brand = request.Brand.Trim();
        item.Model = request.Model.Trim();
        item.Capacity = request.Capacity;
        item.IsActive = request.IsActive;
        item.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return MapVehicle(item);
    }

    public async Task<bool> DeleteVehicleAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var item = await FindVehicleAsync(id, cancellationToken);
        if (item is null)
        {
            return false;
        }

        item.IsActive = false;
        item.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<ServiceDriverDto> CreateDriverAsync(CreateServiceDriverRequest request, CancellationToken cancellationToken = default)
    {
        var tenantId = RequireTenantId();
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == request.UserId && x.TenantId == tenantId, cancellationToken)
            ?? throw new InvalidOperationException("Şoför olarak atanacak kullanıcı bulunamadı.");
        var duplicate = await dbContext.ServiceDrivers.AnyAsync(x => x.TenantId == tenantId && x.UserId == request.UserId && x.IsActive, cancellationToken);
        if (duplicate)
        {
            throw new InvalidOperationException("Bu kullanıcı zaten aktif şoför olarak atanmış.");
        }

        var item = new ServiceDriver
        {
            TenantId = tenantId,
            UserId = request.UserId,
            PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? user.Phone ?? string.Empty : request.PhoneNumber.Trim(),
            LicenseNumber = request.LicenseNumber.Trim(),
            IsActive = request.IsActive,
        };

        await dbContext.ServiceDrivers.AddAsync(item, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return MapDriver(item, user);
    }

    public async Task<IReadOnlyList<ServiceDriverDto>> GetDriversAsync(CancellationToken cancellationToken = default)
    {
        var tenantId = RequireTenantId();
        var drivers = await dbContext.ServiceDrivers.Where(x => x.TenantId == tenantId).OrderByDescending(x => x.IsActive).ToListAsync(cancellationToken);
        var users = await LoadUsersAsync(drivers.Select(x => x.UserId), cancellationToken);
        return drivers.Select(x => MapDriver(x, users.GetValueOrDefault(x.UserId))).ToList();
    }

    public async Task<ServiceDriverDto?> GetDriverAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var item = await FindDriverAsync(id, cancellationToken);
        if (item is null)
        {
            return null;
        }

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == item.UserId, cancellationToken);
        return MapDriver(item, user);
    }

    public async Task<ServiceDriverDto?> UpdateDriverAsync(Guid id, UpdateServiceDriverRequest request, CancellationToken cancellationToken = default)
    {
        var tenantId = RequireTenantId();
        var item = await FindDriverAsync(id, cancellationToken);
        if (item is null)
        {
            return null;
        }

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == request.UserId && x.TenantId == tenantId, cancellationToken)
            ?? throw new InvalidOperationException("Şoför kullanıcısı bulunamadı.");
        if (request.IsActive)
        {
            var duplicate = await dbContext.ServiceDrivers.AnyAsync(x => x.Id != id && x.TenantId == tenantId && x.UserId == request.UserId && x.IsActive, cancellationToken);
            if (duplicate)
            {
                throw new InvalidOperationException("Bu kullanıcı başka bir aktif şoför kaydında kullanılıyor.");
            }
        }

        item.UserId = request.UserId;
        item.PhoneNumber = request.PhoneNumber.Trim();
        item.LicenseNumber = request.LicenseNumber.Trim();
        item.IsActive = request.IsActive;
        item.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return MapDriver(item, user);
    }

    public async Task<bool> DeleteDriverAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var item = await FindDriverAsync(id, cancellationToken);
        if (item is null)
        {
            return false;
        }

        item.IsActive = false;
        item.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<ServiceRouteDetailResponse> CreateRouteAsync(CreateServiceRouteRequest request, CancellationToken cancellationToken = default)
    {
        var tenantId = RequireTenantId();
        var routeType = ParseRouteType(request.RouteType);
        ValidateRouteRequest(request.Name, request.VehicleId, request.DriverId, request.StartTime, request.EndTime);
        await ValidateRouteDependenciesAsync(tenantId, request.VehicleId, request.DriverId, cancellationToken);
        await ValidateRouteScheduleAsync(tenantId, request.VehicleId, request.DriverId, request.StartTime, request.EndTime, null, cancellationToken);

        var route = new ServiceRoute
        {
            TenantId = tenantId,
            Name = request.Name.Trim(),
            RouteType = routeType,
            VehicleId = request.VehicleId,
            DriverId = request.DriverId,
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            IsActive = false,
        };
        await dbContext.ServiceRoutes.AddAsync(route, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        if (request.IsActive)
        {
            await ActivateRouteEntityAsync(route, cancellationToken);
        }

        return (await GetRouteAsync(route.Id, cancellationToken))!;
    }

    public async Task<IReadOnlyList<ServiceRouteListDto>> GetRoutesAsync(string? routeType, bool? isActive, CancellationToken cancellationToken = default)
    {
        var tenantId = RequireTenantId();
        ServiceRouteType? parsedType = string.IsNullOrWhiteSpace(routeType) ? null : ParseRouteType(routeType);
        var routesQuery = dbContext.ServiceRoutes.Where(x => x.TenantId == tenantId);
        if (parsedType.HasValue)
        {
            routesQuery = routesQuery.Where(x => x.RouteType == parsedType.Value);
        }

        if (isActive.HasValue)
        {
            routesQuery = routesQuery.Where(x => x.IsActive == isActive.Value);
        }

        var routes = await routesQuery.OrderBy(x => x.RouteType).ThenBy(x => x.StartTime).ThenBy(x => x.Name).ToListAsync(cancellationToken);
        var vehicles = await LoadVehiclesAsync(routes.Select(x => x.VehicleId), cancellationToken);
        var drivers = await LoadDriversWithUsersAsync(routes.Select(x => x.DriverId), cancellationToken);
        var counts = await LoadAssignmentCountsAsync(routes.Select(x => x.Id), cancellationToken);

        return routes.Select(route =>
        {
            var vehicle = vehicles.GetValueOrDefault(route.VehicleId);
            var count = counts.GetValueOrDefault(route.Id);
            var capacity = vehicle?.Capacity ?? 0;
            return new ServiceRouteListDto(
                route.Id,
                route.TenantId,
                route.Name,
                route.RouteType.ToString(),
                vehicle is null ? null : new ServiceVehicleBriefDto(vehicle.Id, vehicle.PlateNumber, vehicle.Brand, vehicle.Model, vehicle.Capacity),
                drivers.GetValueOrDefault(route.DriverId),
                route.StartTime,
                route.EndTime,
                route.IsActive,
                count,
                capacity,
                Math.Max(0, capacity - count));
        }).ToList();
    }

    public async Task<ServiceRouteDetailResponse?> GetRouteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var route = await FindRouteAsync(id, cancellationToken);
        if (route is null)
        {
            return null;
        }

        return await BuildRouteDetailAsync(route, cancellationToken);
    }

    public async Task<ServiceRouteDetailResponse?> UpdateRouteAsync(Guid id, UpdateServiceRouteRequest request, CancellationToken cancellationToken = default)
    {
        var tenantId = RequireTenantId();
        var route = await FindRouteAsync(id, cancellationToken);
        if (route is null)
        {
            return null;
        }

        var routeType = ParseRouteType(request.RouteType);
        ValidateRouteRequest(request.Name, request.VehicleId, request.DriverId, request.StartTime, request.EndTime);
        await ValidateRouteDependenciesAsync(tenantId, request.VehicleId, request.DriverId, cancellationToken);
        await ValidateRouteScheduleAsync(tenantId, request.VehicleId, request.DriverId, request.StartTime, request.EndTime, id, cancellationToken);

        route.Name = request.Name.Trim();
        route.RouteType = routeType;
        route.VehicleId = request.VehicleId;
        route.DriverId = request.DriverId;
        route.StartTime = request.StartTime;
        route.EndTime = request.EndTime;
        route.UpdatedAt = DateTime.UtcNow;

        if (request.IsActive)
        {
            await ValidateRouteCanActivateAsync(route, cancellationToken);
        }
        route.IsActive = request.IsActive;

        await dbContext.SaveChangesAsync(cancellationToken);
        return await BuildRouteDetailAsync(route, cancellationToken);
    }

    public async Task<bool> DeleteRouteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var route = await FindRouteAsync(id, cancellationToken);
        if (route is null)
        {
            return false;
        }

        route.IsActive = false;
        route.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<ServiceRouteDetailResponse?> ActivateRouteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var route = await FindRouteAsync(id, cancellationToken);
        if (route is null)
        {
            return null;
        }

        await ActivateRouteEntityAsync(route, cancellationToken);
        return await BuildRouteDetailAsync(route, cancellationToken);
    }

    public async Task<ServiceRouteDetailResponse?> DeactivateRouteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var route = await FindRouteAsync(id, cancellationToken);
        if (route is null)
        {
            return null;
        }

        route.IsActive = false;
        route.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return await BuildRouteDetailAsync(route, cancellationToken);
    }

    public async Task<ServiceRouteStopDto> CreateStopAsync(Guid routeId, CreateServiceRouteStopRequest request, CancellationToken cancellationToken = default)
    {
        var route = await FindRouteAsync(routeId, cancellationToken) ?? throw new InvalidOperationException("Rota bulunamadı.");
        ValidateStopRequest(request.Name, request.Address, request.Latitude, request.Longitude, request.SortOrder);
        var duplicateOrder = await dbContext.ServiceRouteStops.AnyAsync(x => x.RouteId == route.Id && x.SortOrder == request.SortOrder, cancellationToken);
        if (duplicateOrder)
        {
            throw new InvalidOperationException("Aynı rotada aynı durak sıra numarası kullanılamaz.");
        }

        var stop = new ServiceRouteStop
        {
            RouteId = route.Id,
            Name = request.Name.Trim(),
            Address = request.Address.Trim(),
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            SortOrder = request.SortOrder,
        };
        await dbContext.ServiceRouteStops.AddAsync(stop, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return MapStop(stop);
    }

    public async Task<IReadOnlyList<ServiceRouteStopDto>> GetStopsAsync(Guid routeId, CancellationToken cancellationToken = default)
    {
        _ = await FindRouteAsync(routeId, cancellationToken) ?? throw new InvalidOperationException("Rota bulunamadı.");
        return await dbContext.ServiceRouteStops
            .Where(x => x.RouteId == routeId)
            .OrderBy(x => x.SortOrder)
            .Select(x => MapStop(x))
            .ToListAsync(cancellationToken);
    }

    public async Task<ServiceRouteStopDto?> UpdateStopAsync(Guid id, UpdateServiceRouteStopRequest request, CancellationToken cancellationToken = default)
    {
        ValidateStopRequest(request.Name, request.Address, request.Latitude, request.Longitude, request.SortOrder);
        var stop = await FindStopInTenantAsync(id, cancellationToken);
        if (stop is null)
        {
            return null;
        }

        var duplicateOrder = await dbContext.ServiceRouteStops.AnyAsync(x => x.Id != id && x.RouteId == stop.RouteId && x.SortOrder == request.SortOrder, cancellationToken);
        if (duplicateOrder)
        {
            throw new InvalidOperationException("Aynı rotada aynı durak sıra numarası kullanılamaz.");
        }

        stop.Name = request.Name.Trim();
        stop.Address = request.Address.Trim();
        stop.Latitude = request.Latitude;
        stop.Longitude = request.Longitude;
        stop.SortOrder = request.SortOrder;
        await dbContext.SaveChangesAsync(cancellationToken);
        return MapStop(stop);
    }

    public async Task<bool> DeleteStopAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var stop = await FindStopInTenantAsync(id, cancellationToken);
        if (stop is null)
        {
            return false;
        }

        var hasAssignments = await dbContext.StudentServiceAssignments.AnyAsync(x => x.StopId == id && x.IsActive, cancellationToken);
        if (hasAssignments)
        {
            throw new InvalidOperationException("Bu durağa bağlı aktif öğrenci ataması var. Önce atamaları taşıyın veya pasifleştirin.");
        }

        dbContext.ServiceRouteStops.Remove(stop);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<IReadOnlyList<ServiceRouteStopDto>> ReorderStopsAsync(Guid routeId, ReorderStopsRequest request, CancellationToken cancellationToken = default)
    {
        _ = await FindRouteAsync(routeId, cancellationToken) ?? throw new InvalidOperationException("Rota bulunamadı.");
        if (request.Stops.Count == 0 || request.Stops.Any(x => x.SortOrder < 1))
        {
            throw new InvalidOperationException("Durak sıralaması geçersiz.");
        }

        if (request.Stops.Select(x => x.SortOrder).Distinct().Count() != request.Stops.Count)
        {
            throw new InvalidOperationException("Aynı rotada iki durak aynı sıra değerini alamaz.");
        }

        var stops = await dbContext.ServiceRouteStops.Where(x => x.RouteId == routeId).ToListAsync(cancellationToken);
        var stopIds = stops.Select(x => x.Id).ToHashSet();
        if (request.Stops.Any(x => !stopIds.Contains(x.StopId)))
        {
            throw new InvalidOperationException("Sıralama isteğinde rotaya ait olmayan durak var.");
        }

        var index = 1;
        foreach (var stop in stops)
        {
            stop.SortOrder = -100000 - index++;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        foreach (var item in request.Stops)
        {
            stops.First(x => x.Id == item.StopId).SortOrder = item.SortOrder;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return stops.OrderBy(x => x.SortOrder).Select(MapStop).ToList();
    }

    public async Task<AssignedStudentResponse> CreateAssignmentAsync(CreateStudentServiceAssignmentRequest request, CancellationToken cancellationToken = default)
    {
        var tenantId = RequireTenantId();
        var route = await FindRouteAsync(request.RouteId, cancellationToken) ?? throw new InvalidOperationException("Rota bulunamadı.");
        var stop = await dbContext.ServiceRouteStops.FirstOrDefaultAsync(x => x.Id == request.StopId && x.RouteId == request.RouteId, cancellationToken)
            ?? throw new InvalidOperationException("Seçilen durak bu rotaya ait değil.");
        var student = await dbContext.Students.FirstOrDefaultAsync(x => x.Id == request.StudentId && x.TenantId == tenantId, cancellationToken)
            ?? throw new InvalidOperationException("Öğrenci bulunamadı.");
        var parentId = request.ParentId ?? student.ParentUserId;
        if (!parentId.HasValue)
        {
            throw new InvalidOperationException("Öğrenciye bağlı veli kullanıcısı bulunamadı.");
        }

        await ValidateParentOwnsStudentAsync(parentId.Value, student, cancellationToken);
        await ValidateAssignmentRulesAsync(route, student.Id, parentId.Value, stop.Id, null, cancellationToken);

        var assignment = new StudentServiceAssignment
        {
            StudentId = student.Id,
            ParentId = parentId.Value,
            RouteId = route.Id,
            StopId = stop.Id,
            IsActive = true,
        };

        await dbContext.StudentServiceAssignments.AddAsync(assignment, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return (await BuildAssignmentResponsesAsync([assignment], cancellationToken)).Single();
    }

    public async Task<IReadOnlyList<AssignedStudentResponse>> GetAssignmentsAsync(Guid? routeId, Guid? stopId, CancellationToken cancellationToken = default)
    {
        var tenantId = RequireTenantId();
        var routeIds = await dbContext.ServiceRoutes.Where(x => x.TenantId == tenantId).Select(x => x.Id).ToListAsync(cancellationToken);
        var query = dbContext.StudentServiceAssignments.Where(x => routeIds.Contains(x.RouteId));
        if (routeId.HasValue)
        {
            query = query.Where(x => x.RouteId == routeId.Value);
        }

        if (stopId.HasValue)
        {
            query = query.Where(x => x.StopId == stopId.Value);
        }

        var assignments = await query.OrderByDescending(x => x.IsActive).ThenBy(x => x.CreatedAt).ToListAsync(cancellationToken);
        return await BuildAssignmentResponsesAsync(assignments, cancellationToken);
    }

    public async Task<AssignedStudentResponse?> UpdateAssignmentAsync(Guid id, UpdateStudentServiceAssignmentRequest request, CancellationToken cancellationToken = default)
    {
        var assignment = await FindAssignmentInTenantAsync(id, cancellationToken);
        if (assignment is null)
        {
            return null;
        }

        var route = await FindRouteAsync(request.RouteId, cancellationToken) ?? throw new InvalidOperationException("Rota bulunamadı.");
        var stop = await dbContext.ServiceRouteStops.FirstOrDefaultAsync(x => x.Id == request.StopId && x.RouteId == request.RouteId, cancellationToken)
            ?? throw new InvalidOperationException("Seçilen durak bu rotaya ait değil.");
        var student = await dbContext.Students.FirstAsync(x => x.Id == assignment.StudentId, cancellationToken);

        if (request.IsActive)
        {
            await ValidateAssignmentRulesAsync(route, assignment.StudentId, assignment.ParentId, stop.Id, assignment.Id, cancellationToken);
        }

        assignment.RouteId = route.Id;
        assignment.StopId = stop.Id;
        assignment.IsActive = request.IsActive;
        await dbContext.SaveChangesAsync(cancellationToken);
        return (await BuildAssignmentResponsesAsync([assignment], cancellationToken)).Single();
    }

    public async Task<bool> DeleteAssignmentAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var assignment = await FindAssignmentInTenantAsync(id, cancellationToken);
        if (assignment is null)
        {
            return false;
        }

        assignment.IsActive = false;
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<IReadOnlyList<ServiceStudentSearchResultDto>> SearchStudentsAsync(string? keyword, CancellationToken cancellationToken = default)
    {
        var tenantId = RequireTenantId();
        var normalized = keyword?.Trim() ?? string.Empty;
        var query = dbContext.Students.Where(x => x.TenantId == tenantId);
        if (!string.IsNullOrWhiteSpace(normalized))
        {
            query = query.Where(x => EF.Functions.ILike(x.FullName, $"%{normalized}%")
                || EF.Functions.ILike(x.ClassName, $"%{normalized}%")
                || EF.Functions.ILike(x.ParentName, $"%{normalized}%"));
        }

        return await query
            .OrderBy(x => x.FullName)
            .Take(30)
            .Select(x => new ServiceStudentSearchResultDto(x.Id, x.FullName, x.ClassName, x.ParentUserId, x.ParentName, x.ParentPhone))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<DriverTodayRouteDto>> GetDriverTodayRoutesAsync(CancellationToken cancellationToken = default)
    {
        var driver = await RequireCurrentDriverAsync(cancellationToken);
        var routes = await dbContext.ServiceRoutes
            .Where(x => x.DriverId == driver.Id && x.IsActive)
            .OrderBy(x => x.StartTime)
            .ToListAsync(cancellationToken);
        var routeIds = routes.Select(x => x.Id).ToList();
        var trips = await dbContext.ServiceTrips.Where(x => routeIds.Contains(x.RouteId) && x.TripDate == Today).ToListAsync(cancellationToken);
        var counts = await LoadAssignmentCountsAsync(routeIds, cancellationToken);
        return routes.Select(route =>
        {
            var trip = trips.FirstOrDefault(x => x.RouteId == route.Id);
            return new DriverTodayRouteDto(route.Id, route.Name, route.RouteType.ToString(), route.StartTime, route.EndTime, trip?.Id, trip?.Status.ToString(), counts.GetValueOrDefault(route.Id));
        }).ToList();
    }

    public async Task<IReadOnlyList<DriverRouteStudentDto>> GetDriverRouteStudentsAsync(Guid routeId, CancellationToken cancellationToken = default)
    {
        var driver = await RequireCurrentDriverAsync(cancellationToken);
        var route = await dbContext.ServiceRoutes.FirstOrDefaultAsync(x => x.Id == routeId && x.DriverId == driver.Id && x.IsActive, cancellationToken)
            ?? throw new UnauthorizedAccessException("Şoför sadece kendi rotasındaki öğrencileri görebilir.");
        var trip = await dbContext.ServiceTrips.FirstOrDefaultAsync(x => x.RouteId == route.Id && x.TripDate == Today, cancellationToken);
        return await BuildDriverStudentsAsync(route.Id, trip?.Id, cancellationToken);
    }

    public async Task<ServiceTripDto> StartTripAsync(StartServiceTripRequest request, CancellationToken cancellationToken = default)
    {
        var driver = await RequireCurrentDriverAsync(cancellationToken);
        var route = await dbContext.ServiceRoutes.FirstOrDefaultAsync(x => x.Id == request.RouteId && x.DriverId == driver.Id && x.IsActive, cancellationToken)
            ?? throw new UnauthorizedAccessException("Şoför sadece kendi rotasını başlatabilir.");

        var tripType = route.RouteType == ServiceRouteType.Morning ? ServiceTripType.Morning : ServiceTripType.Evening;
        var trip = await dbContext.ServiceTrips.FirstOrDefaultAsync(x => x.RouteId == route.Id && x.TripDate == Today && x.TripType == tripType, cancellationToken);
        if (trip is null)
        {
            trip = new ServiceTrip
            {
                RouteId = route.Id,
                DriverId = driver.Id,
                VehicleId = route.VehicleId,
                TripDate = Today,
                TripType = tripType,
                Status = ServiceTripStatus.InProgress,
                StartedAt = DateTime.UtcNow,
            };
            await dbContext.ServiceTrips.AddAsync(trip, cancellationToken);
        }
        else if (trip.Status == ServiceTripStatus.NotStarted)
        {
            trip.Status = ServiceTripStatus.InProgress;
            trip.StartedAt = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        var dto = MapTrip(trip);
        await realtimeNotifier.TripStatusUpdatedAsync(route.TenantId, trip.Id, driver.Id, dto, cancellationToken);
        return dto;
    }

    public async Task<IReadOnlyList<DriverRouteStudentDto>> GetTripStudentsAsync(Guid tripId, CancellationToken cancellationToken = default)
    {
        var trip = await RequireDriverTripAsync(tripId, cancellationToken);
        return await BuildDriverStudentsAsync(trip.RouteId, trip.Id, cancellationToken);
    }

    public async Task<DriverRouteStudentDto> MarkAttendanceAsync(MarkServiceAttendanceRequest request, CancellationToken cancellationToken = default)
    {
        var driver = await RequireCurrentDriverAsync(cancellationToken);
        var trip = await RequireDriverTripAsync(request.TripId, cancellationToken);
        var assignment = await dbContext.StudentServiceAssignments.FirstOrDefaultAsync(x => x.RouteId == trip.RouteId && x.StudentId == request.StudentId && x.IsActive, cancellationToken)
            ?? throw new InvalidOperationException("Öğrenci bu rotaya atanmış değil.");
        var status = ParseAttendanceStatus(request.Status, trip.TripType);

        var attendance = await dbContext.ServiceAttendances.FirstOrDefaultAsync(x => x.TripId == trip.Id && x.StudentId == request.StudentId, cancellationToken);
        if (attendance is null)
        {
            attendance = new ServiceAttendance
            {
                TripId = trip.Id,
                StudentId = assignment.StudentId,
                ParentId = assignment.ParentId,
            };
            await dbContext.ServiceAttendances.AddAsync(attendance, cancellationToken);
        }

        attendance.Status = status;
        attendance.MarkedByDriverId = driver.Id;
        attendance.MarkedAt = DateTime.UtcNow;
        attendance.Note = request.Note?.Trim() ?? string.Empty;
        await dbContext.SaveChangesAsync(cancellationToken);

        await NotifyParentAsync(assignment.ParentId, BuildAttendanceNotificationMessage(status, trip.TripType), cancellationToken);
        var student = (await BuildDriverStudentsAsync(trip.RouteId, trip.Id, cancellationToken)).First(x => x.StudentId == request.StudentId);
        await realtimeNotifier.StudentAttendanceUpdatedAsync(dbContext.CurrentTenantId, trip.Id, assignment.ParentId, student, cancellationToken);
        return student;
    }

    public async Task<ServiceTripDto?> ArrivedSchoolAsync(Guid tripId, CancellationToken cancellationToken = default)
    {
        var trip = await RequireDriverTripAsync(tripId, cancellationToken);
        trip.Status = ServiceTripStatus.ArrivedSchool;
        trip.ArrivedAtSchoolAt = DateTime.UtcNow;

        var attendances = await dbContext.ServiceAttendances.Where(x => x.TripId == trip.Id && x.Status == ServiceAttendanceStatus.Boarded).ToListAsync(cancellationToken);
        foreach (var attendance in attendances)
        {
            attendance.Status = ServiceAttendanceStatus.ArrivedSchool;
            attendance.MarkedAt = DateTime.UtcNow;
            await NotifyParentAsync(attendance.ParentId, "Öğrenciniz okula ulaştı.", cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        var dto = MapTrip(trip);
        await realtimeNotifier.TripStatusUpdatedAsync(dbContext.CurrentTenantId, trip.Id, trip.DriverId, dto, cancellationToken);
        return dto;
    }

    public async Task<ServiceTripDto?> CompleteTripAsync(Guid tripId, CancellationToken cancellationToken = default)
    {
        var trip = await RequireDriverTripAsync(tripId, cancellationToken);
        trip.Status = ServiceTripStatus.Completed;
        trip.CompletedAt = DateTime.UtcNow;

        var targetStatuses = trip.TripType == ServiceTripType.Evening
            ? new[] { ServiceAttendanceStatus.BoardedFromSchool, ServiceAttendanceStatus.Boarded }
            : new[] { ServiceAttendanceStatus.ArrivedSchool };
        var attendances = await dbContext.ServiceAttendances.Where(x => x.TripId == trip.Id && targetStatuses.Contains(x.Status)).ToListAsync(cancellationToken);
        foreach (var attendance in attendances)
        {
            if (trip.TripType == ServiceTripType.Evening)
            {
                attendance.Status = ServiceAttendanceStatus.ArrivedHome;
                attendance.MarkedAt = DateTime.UtcNow;
                await NotifyParentAsync(attendance.ParentId, "Öğrenciniz eve ulaştı.", cancellationToken);
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        var dto = MapTrip(trip);
        await realtimeNotifier.TripStatusUpdatedAsync(dbContext.CurrentTenantId, trip.Id, trip.DriverId, dto, cancellationToken);
        return dto;
    }

    public async Task<VehicleLocationDto> UpdateDriverLocationAsync(UpdateVehicleLocationRequest request, CancellationToken cancellationToken = default)
    {
        var trip = await RequireDriverTripAsync(request.TripId, cancellationToken);
        ValidateCoordinates(request.Latitude, request.Longitude);
        var location = new ServiceVehicleLocation
        {
            VehicleId = trip.VehicleId,
            DriverId = trip.DriverId,
            TripId = trip.Id,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            Speed = request.Speed,
            Heading = request.Heading,
            RecordedAt = DateTime.UtcNow,
        };
        await dbContext.ServiceVehicleLocations.AddAsync(location, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        var dto = new VehicleLocationDto(location.Id, location.VehicleId, location.DriverId, location.TripId, location.Latitude, location.Longitude, location.Speed, location.Heading, location.RecordedAt);
        await realtimeNotifier.VehicleLocationUpdatedAsync(dbContext.CurrentTenantId, trip.VehicleId, trip.DriverId, trip.Id, dto, cancellationToken);
        return dto;
    }

    public async Task<IReadOnlyList<ParentServiceStatusDto>> GetParentLiveStatusAsync(CancellationToken cancellationToken = default)
    {
        var parentId = RequireCurrentUserId();
        return await BuildLiveStatusForParentAsync(parentId, cancellationToken);
    }

    public async Task<IReadOnlyList<ServiceHistoryItemDto>> GetParentHistoryAsync(CancellationToken cancellationToken = default)
    {
        return await BuildHistoryForParentAsync(RequireCurrentUserId(), null, cancellationToken);
    }

    public async Task<ServiceAbsenceRequestDto> CreateAbsenceRequestAsync(CreateServiceAbsenceRequestRequest request, CancellationToken cancellationToken = default)
    {
        var parentId = RequireCurrentUserId();
        var tomorrowOrLater = request.Date >= DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3).Date.AddDays(1));
        if (!tomorrowOrLater)
        {
            throw new InvalidOperationException("Geçmiş tarih veya bugün için servis kullanmama talebi oluşturulamaz.");
        }

        var tripType = ParseTripType(request.TripType, allowBoth: true);
        var route = await FindRouteAsync(request.RouteId, cancellationToken) ?? throw new InvalidOperationException("Rota bulunamadı.");
        var student = await dbContext.Students.FirstOrDefaultAsync(x => x.Id == request.StudentId, cancellationToken)
            ?? throw new InvalidOperationException("Öğrenci bulunamadı.");
        await ValidateParentOwnsStudentAsync(parentId, student, cancellationToken);

        var assigned = await dbContext.StudentServiceAssignments.AnyAsync(x => x.StudentId == student.Id && x.ParentId == parentId && x.RouteId == route.Id && x.IsActive, cancellationToken);
        if (!assigned)
        {
            throw new InvalidOperationException("Bu öğrenci seçilen rotaya atanmış değil.");
        }

        var duplicate = await dbContext.ServiceAbsenceRequests.AnyAsync(x =>
            x.StudentId == student.Id
            && x.ParentId == parentId
            && x.Date == request.Date
            && x.TripType == tripType
            && x.Status != ServiceAbsenceRequestStatus.Cancelled
            && x.Status != ServiceAbsenceRequestStatus.Rejected,
            cancellationToken);
        if (duplicate)
        {
            throw new InvalidOperationException("Aynı öğrenci, tarih ve servis tipi için zaten talep var.");
        }

        var absence = new ServiceAbsenceRequest
        {
            StudentId = student.Id,
            ParentId = parentId,
            RouteId = route.Id,
            Date = request.Date,
            TripType = tripType,
            Reason = request.Reason?.Trim() ?? string.Empty,
            Status = ServiceAbsenceRequestStatus.Pending,
        };
        await dbContext.ServiceAbsenceRequests.AddAsync(absence, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        var dto = (await BuildAbsenceDtosAsync([absence], cancellationToken)).Single();
        await realtimeNotifier.AbsenceRequestCreatedAsync(route.TenantId, parentId, dto, cancellationToken);
        return dto;
    }

    public async Task<IReadOnlyList<ServiceAbsenceRequestDto>> GetParentAbsenceRequestsAsync(CancellationToken cancellationToken = default)
    {
        var parentId = RequireCurrentUserId();
        var items = await dbContext.ServiceAbsenceRequests.Where(x => x.ParentId == parentId).OrderByDescending(x => x.CreatedAt).ToListAsync(cancellationToken);
        return await BuildAbsenceDtosAsync(items, cancellationToken);
    }

    public async Task<bool> CancelAbsenceRequestAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var parentId = RequireCurrentUserId();
        var item = await dbContext.ServiceAbsenceRequests.FirstOrDefaultAsync(x => x.Id == id && x.ParentId == parentId, cancellationToken);
        if (item is null)
        {
            return false;
        }

        item.Status = ServiceAbsenceRequestStatus.Cancelled;
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<IReadOnlyList<ParentServiceStatusDto>> GetStudentLiveStatusAsync(CancellationToken cancellationToken = default)
    {
        var student = await RequireCurrentStudentAsync(cancellationToken);
        if (!student.ParentUserId.HasValue)
        {
            return [];
        }

        return await BuildLiveStatusForParentAsync(student.ParentUserId.Value, cancellationToken, student.Id);
    }

    public async Task<IReadOnlyList<ServiceHistoryItemDto>> GetStudentHistoryAsync(CancellationToken cancellationToken = default)
    {
        var student = await RequireCurrentStudentAsync(cancellationToken);
        return student.ParentUserId.HasValue
            ? await BuildHistoryForParentAsync(student.ParentUserId.Value, student.Id, cancellationToken)
            : [];
    }

    private async Task<ServiceRouteDetailResponse> BuildRouteDetailAsync(ServiceRoute route, CancellationToken cancellationToken)
    {
        var vehicle = await dbContext.ServiceVehicles.FirstOrDefaultAsync(x => x.Id == route.VehicleId, cancellationToken);
        var driver = await dbContext.ServiceDrivers.FirstOrDefaultAsync(x => x.Id == route.DriverId, cancellationToken);
        AppUser? driverUser = driver is null ? null : await dbContext.Users.FirstOrDefaultAsync(x => x.Id == driver.UserId, cancellationToken);
        var assignments = await dbContext.StudentServiceAssignments.Where(x => x.RouteId == route.Id && x.IsActive).ToListAsync(cancellationToken);
        var assignmentResponses = await BuildAssignmentResponsesAsync(assignments, cancellationToken);
        var stops = await dbContext.ServiceRouteStops.Where(x => x.RouteId == route.Id).OrderBy(x => x.SortOrder).ToListAsync(cancellationToken);
        var stopResponses = stops.Select(stop => new StopWithStudentsResponse(
            stop.Id,
            stop.Name,
            stop.Address,
            stop.Latitude,
            stop.Longitude,
            stop.SortOrder,
            assignmentResponses.Where(x => x.StopId == stop.Id).OrderBy(x => x.StudentFullName).ToList())).ToList();
        var capacity = vehicle?.Capacity ?? 0;
        return new ServiceRouteDetailResponse(
            route.Id,
            route.Name,
            route.RouteType.ToString(),
            vehicle is null ? null : new ServiceVehicleBriefDto(vehicle.Id, vehicle.PlateNumber, vehicle.Brand, vehicle.Model, vehicle.Capacity),
            driver is null ? null : new ServiceDriverBriefDto(driver.Id, driver.UserId, driverUser?.FullName ?? "Şoför", driver.PhoneNumber),
            route.StartTime,
            route.EndTime,
            route.IsActive,
            assignments.Count,
            capacity,
            Math.Max(0, capacity - assignments.Count),
            stopResponses);
    }

    private async Task<IReadOnlyList<AssignedStudentResponse>> BuildAssignmentResponsesAsync(IReadOnlyList<StudentServiceAssignment> assignments, CancellationToken cancellationToken)
    {
        if (assignments.Count == 0)
        {
            return [];
        }

        var studentIds = assignments.Select(x => x.StudentId).Distinct().ToList();
        var parentIds = assignments.Select(x => x.ParentId).Distinct().ToList();
        var routeIds = assignments.Select(x => x.RouteId).Distinct().ToList();
        var stopIds = assignments.Select(x => x.StopId).Distinct().ToList();
        var students = await dbContext.Students.Where(x => studentIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
        var parents = await dbContext.Users.Where(x => parentIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
        var routes = await dbContext.ServiceRoutes.Where(x => routeIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
        var stops = await dbContext.ServiceRouteStops.Where(x => stopIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);

        return assignments.Select(assignment =>
        {
            var student = students[assignment.StudentId];
            var parent = parents.GetValueOrDefault(assignment.ParentId);
            var stop = stops[assignment.StopId];
            var route = routes[assignment.RouteId];
            return new AssignedStudentResponse(
                assignment.Id,
                student.Id,
                student.FullName,
                assignment.ParentId,
                parent?.FullName ?? student.ParentName,
                parent?.Phone ?? student.ParentPhone,
                student.ClassName,
                stop.Id,
                stop.Name,
                route.Id,
                route.Name,
                assignment.IsActive);
        }).ToList();
    }

    private async Task<IReadOnlyList<DriverRouteStudentDto>> BuildDriverStudentsAsync(Guid routeId, Guid? tripId, CancellationToken cancellationToken)
    {
        var assignments = await dbContext.StudentServiceAssignments.Where(x => x.RouteId == routeId && x.IsActive).ToListAsync(cancellationToken);
        if (assignments.Count == 0)
        {
            return [];
        }

        var responses = await BuildAssignmentResponsesAsync(assignments, cancellationToken);
        var stops = await dbContext.ServiceRouteStops.Where(x => x.RouteId == routeId).ToDictionaryAsync(x => x.Id, cancellationToken);
        var attendance = tripId.HasValue
            ? await dbContext.ServiceAttendances.Where(x => x.TripId == tripId.Value).ToDictionaryAsync(x => x.StudentId, cancellationToken)
            : [];
        var absences = await dbContext.ServiceAbsenceRequests
            .Where(x => x.Date == Today && x.Status != ServiceAbsenceRequestStatus.Cancelled && x.Status != ServiceAbsenceRequestStatus.Rejected)
            .Where(x => assignments.Select(a => a.StudentId).Contains(x.StudentId))
            .ToListAsync(cancellationToken);
        var latestLocation = tripId.HasValue
            ? await dbContext.ServiceVehicleLocations.Where(x => x.TripId == tripId.Value).OrderByDescending(x => x.RecordedAt).FirstOrDefaultAsync(cancellationToken)
            : null;

        return responses.Select(item =>
        {
            var stop = stops[item.StopId];
            var absence = absences.FirstOrDefault(x => x.StudentId == item.StudentId);
            int? eta = latestLocation is null ? null : etaService.CalculateEtaMinutes(latestLocation.Latitude, latestLocation.Longitude, stop.Latitude, stop.Longitude, latestLocation.Speed);
            return new DriverRouteStudentDto(
                item.AssignmentId,
                item.StudentId,
                item.StudentFullName,
                item.ParentId,
                item.ParentFullName,
                item.ParentPhone,
                item.ClassName,
                item.StopId,
                item.StopName,
                stop.SortOrder,
                attendance.GetValueOrDefault(item.StudentId)?.Status.ToString() ?? ServiceAttendanceStatus.Pending.ToString(),
                absence is not null,
                absence?.Status.ToString(),
                eta);
        }).OrderBy(x => x.StopSortOrder).ThenBy(x => x.StudentFullName).ToList();
    }

    private async Task<IReadOnlyList<ParentServiceStatusDto>> BuildLiveStatusForParentAsync(Guid parentId, CancellationToken cancellationToken, Guid? onlyStudentId = null)
    {
        var query = dbContext.StudentServiceAssignments.Where(x => x.ParentId == parentId && x.IsActive);
        if (onlyStudentId.HasValue)
        {
            query = query.Where(x => x.StudentId == onlyStudentId.Value);
        }

        var assignments = await query.ToListAsync(cancellationToken);
        if (assignments.Count == 0)
        {
            return [];
        }

        var assignmentResponses = await BuildAssignmentResponsesAsync(assignments, cancellationToken);
        var routeIds = assignments.Select(x => x.RouteId).Distinct().ToList();
        var trips = await dbContext.ServiceTrips.Where(x => routeIds.Contains(x.RouteId) && x.TripDate == Today).ToListAsync(cancellationToken);
        var tripIds = trips.Select(x => x.Id).ToList();
        var attendances = await dbContext.ServiceAttendances.Where(x => tripIds.Contains(x.TripId)).ToListAsync(cancellationToken);
        var latestLocations = await dbContext.ServiceVehicleLocations
            .Where(x => tripIds.Contains(x.TripId))
            .GroupBy(x => x.TripId)
            .Select(g => g.OrderByDescending(x => x.RecordedAt).First())
            .ToListAsync(cancellationToken);
        var stops = await dbContext.ServiceRouteStops.Where(x => assignments.Select(a => a.StopId).Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);

        return assignmentResponses.Select(item =>
        {
            var trip = trips.FirstOrDefault(x => x.RouteId == item.RouteId);
            var attendance = trip is null ? null : attendances.FirstOrDefault(x => x.TripId == trip.Id && x.StudentId == item.StudentId);
            var location = trip is null ? null : latestLocations.FirstOrDefault(x => x.TripId == trip.Id);
            var stop = stops[item.StopId];
            int? eta = location is null ? null : etaService.CalculateEtaMinutes(location.Latitude, location.Longitude, stop.Latitude, stop.Longitude, location.Speed);
            return new ParentServiceStatusDto(
                item.StudentId,
                item.StudentFullName,
                item.RouteId,
                item.RouteName,
                trips.FirstOrDefault(x => x.RouteId == item.RouteId)?.TripType.ToString() ?? string.Empty,
                item.StopId,
                item.StopName,
                attendance?.Status.ToString() ?? ServiceAttendanceStatus.Pending.ToString(),
                trip?.Status.ToString(),
                eta);
        }).ToList();
    }

    private async Task<IReadOnlyList<ServiceHistoryItemDto>> BuildHistoryForParentAsync(Guid parentId, Guid? onlyStudentId, CancellationToken cancellationToken)
    {
        var query = dbContext.ServiceAttendances.Where(x => x.ParentId == parentId);
        if (onlyStudentId.HasValue)
        {
            query = query.Where(x => x.StudentId == onlyStudentId.Value);
        }

        var items = await query.OrderByDescending(x => x.MarkedAt).Take(100).ToListAsync(cancellationToken);
        if (items.Count == 0)
        {
            return [];
        }

        var trips = await dbContext.ServiceTrips.Where(x => items.Select(i => i.TripId).Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
        var routes = await dbContext.ServiceRoutes.Where(x => trips.Values.Select(t => t.RouteId).Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
        return items.Select(item =>
        {
            var trip = trips[item.TripId];
            var route = routes[trip.RouteId];
            return new ServiceHistoryItemDto(trip.Id, trip.TripDate, trip.TripType.ToString(), route.Name, item.Status.ToString(), item.MarkedAt);
        }).ToList();
    }

    private async Task<IReadOnlyList<ServiceAbsenceRequestDto>> BuildAbsenceDtosAsync(IReadOnlyList<ServiceAbsenceRequest> items, CancellationToken cancellationToken)
    {
        if (items.Count == 0)
        {
            return [];
        }

        var students = await dbContext.Students.Where(x => items.Select(i => i.StudentId).Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
        var parents = await dbContext.Users.Where(x => items.Select(i => i.ParentId).Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
        var routes = await dbContext.ServiceRoutes.Where(x => items.Select(i => i.RouteId).Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
        return items.Select(item =>
        {
            var student = students[item.StudentId];
            var parent = parents.GetValueOrDefault(item.ParentId);
            var route = routes[item.RouteId];
            return new ServiceAbsenceRequestDto(item.Id, item.StudentId, student.FullName, item.ParentId, parent?.FullName ?? student.ParentName, item.RouteId, route.Name, item.Date, item.TripType.ToString(), item.Reason, item.Status.ToString(), item.CreatedAt);
        }).ToList();
    }

    private async Task ActivateRouteEntityAsync(ServiceRoute route, CancellationToken cancellationToken)
    {
        await ValidateRouteCanActivateAsync(route, cancellationToken);
        await ValidateRouteScheduleAsync(route.TenantId!.Value, route.VehicleId, route.DriverId, route.StartTime, route.EndTime, route.Id, cancellationToken);
        route.IsActive = true;
        route.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task ValidateRouteCanActivateAsync(ServiceRoute route, CancellationToken cancellationToken)
    {
        if (route.VehicleId == Guid.Empty || route.DriverId == Guid.Empty)
        {
            throw new InvalidOperationException("Rota aktif yapılacaksa araç ve şoför seçilmelidir.");
        }

        var stopCount = await dbContext.ServiceRouteStops.CountAsync(x => x.RouteId == route.Id, cancellationToken);
        if (stopCount < 1)
        {
            throw new InvalidOperationException("Rota aktif yapılacaksa en az 1 durak olmalıdır.");
        }
    }

    private async Task ValidateRouteDependenciesAsync(Guid tenantId, Guid vehicleId, Guid driverId, CancellationToken cancellationToken)
    {
        var vehicleExists = await dbContext.ServiceVehicles.AnyAsync(x => x.Id == vehicleId && x.TenantId == tenantId && x.IsActive, cancellationToken);
        if (!vehicleExists)
        {
            throw new InvalidOperationException("Aktif servis aracı bulunamadı.");
        }

        var driverExists = await dbContext.ServiceDrivers.AnyAsync(x => x.Id == driverId && x.TenantId == tenantId && x.IsActive, cancellationToken);
        if (!driverExists)
        {
            throw new InvalidOperationException("Aktif şoför bulunamadı.");
        }
    }

    private async Task ValidateRouteScheduleAsync(Guid tenantId, Guid vehicleId, Guid driverId, TimeOnly startTime, TimeOnly endTime, Guid? exceptRouteId, CancellationToken cancellationToken)
    {
        var overlap = await dbContext.ServiceRoutes
            .Where(x => x.TenantId == tenantId && x.IsActive && (!exceptRouteId.HasValue || x.Id != exceptRouteId.Value))
            .Where(x => x.StartTime < endTime && startTime < x.EndTime)
            .Where(x => x.VehicleId == vehicleId || x.DriverId == driverId)
            .FirstOrDefaultAsync(cancellationToken);
        if (overlap is not null && overlap.DriverId == driverId)
        {
            throw new InvalidOperationException("Şoför aynı saat aralığında başka aktif rotaya atanamaz.");
        }

        if (overlap is not null)
        {
            throw new InvalidOperationException("Araç aynı saat aralığında başka aktif rotaya atanamaz.");
        }
    }

    private async Task ValidateAssignmentRulesAsync(ServiceRoute route, Guid studentId, Guid parentId, Guid stopId, Guid? exceptAssignmentId, CancellationToken cancellationToken)
    {
        var stopBelongsToRoute = await dbContext.ServiceRouteStops.AnyAsync(x => x.Id == stopId && x.RouteId == route.Id, cancellationToken);
        if (!stopBelongsToRoute)
        {
            throw new InvalidOperationException("StopId seçilen RouteId’ye ait değil.");
        }

        var conflictingAssignment = await dbContext.StudentServiceAssignments
            .Where(x => x.IsActive && x.StudentId == studentId && (!exceptAssignmentId.HasValue || x.Id != exceptAssignmentId.Value))
            .Join(dbContext.ServiceRoutes, a => a.RouteId, r => r.Id, (a, r) => new { Assignment = a, Route = r })
            .AnyAsync(x => x.Route.RouteType == route.RouteType, cancellationToken);
        if (conflictingAssignment)
        {
            throw new InvalidOperationException("Aynı öğrenci aynı servis tipi için birden fazla aktif rotaya atanamaz.");
        }

        var vehicle = await dbContext.ServiceVehicles.FirstAsync(x => x.Id == route.VehicleId, cancellationToken);
        var activeCount = await dbContext.StudentServiceAssignments.CountAsync(x => x.RouteId == route.Id && x.IsActive && (!exceptAssignmentId.HasValue || x.Id != exceptAssignmentId.Value), cancellationToken);
        if (activeCount >= vehicle.Capacity)
        {
            throw new InvalidOperationException("Araç kapasitesi dolu. Bu rotaya yeni öğrenci atanamaz.");
        }

        var parent = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == parentId && x.TenantId == route.TenantId, cancellationToken);
        if (parent is null)
        {
            throw new InvalidOperationException("Veli kullanıcısı bulunamadı.");
        }
    }

    private async Task ValidateParentOwnsStudentAsync(Guid parentId, StudentProfile student, CancellationToken cancellationToken)
    {
        if (student.ParentUserId == parentId)
        {
            return;
        }

        var parent = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == parentId, cancellationToken);
        if (parent is not null
            && !string.IsNullOrWhiteSpace(student.ParentPhone)
            && string.Equals(parent.Phone?.Trim(), student.ParentPhone.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        throw new UnauthorizedAccessException("Veli sadece kendi öğrencisi için işlem yapabilir.");
    }

    private async Task<ServiceTrip> RequireDriverTripAsync(Guid tripId, CancellationToken cancellationToken)
    {
        var driver = await RequireCurrentDriverAsync(cancellationToken);
        return await dbContext.ServiceTrips.FirstOrDefaultAsync(x => x.Id == tripId && x.DriverId == driver.Id, cancellationToken)
            ?? throw new UnauthorizedAccessException("Şoför sadece kendi servisinde işlem yapabilir.");
    }

    private async Task<ServiceDriver> RequireCurrentDriverAsync(CancellationToken cancellationToken)
    {
        var userId = RequireCurrentUserId();
        return await dbContext.ServiceDrivers.FirstOrDefaultAsync(x => x.UserId == userId && x.IsActive, cancellationToken)
            ?? throw new UnauthorizedAccessException("Aktif şoför kaydı bulunamadı.");
    }

    private async Task<StudentProfile> RequireCurrentStudentAsync(CancellationToken cancellationToken)
    {
        var userId = RequireCurrentUserId();
        return await dbContext.Students.FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken)
            ?? throw new UnauthorizedAccessException("Öğrenci profili bulunamadı.");
    }

    private async Task NotifyParentAsync(Guid parentId, string message, CancellationToken cancellationToken)
    {
        await notificationService.CreateNotificationAsync(new CreateNotificationRequest(
            "Servis Bilgilendirmesi",
            message,
            DateTime.UtcNow.AddHours(3).ToString("dd.MM.yyyy HH:mm"),
            $"parent-{parentId}",
            "Parent",
            "ServiceTracking"), cancellationToken);
    }

    private async Task<ServiceVehicle?> FindVehicleAsync(Guid id, CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId();
        return await dbContext.ServiceVehicles.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, cancellationToken);
    }

    private async Task<ServiceDriver?> FindDriverAsync(Guid id, CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId();
        return await dbContext.ServiceDrivers.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, cancellationToken);
    }

    private async Task<ServiceRoute?> FindRouteAsync(Guid id, CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId();
        return await dbContext.ServiceRoutes.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, cancellationToken);
    }

    private async Task<ServiceRouteStop?> FindStopInTenantAsync(Guid id, CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId();
        return await dbContext.ServiceRouteStops
            .Join(dbContext.ServiceRoutes.Where(x => x.TenantId == tenantId), s => s.RouteId, r => r.Id, (s, _) => s)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
    }

    private async Task<StudentServiceAssignment?> FindAssignmentInTenantAsync(Guid id, CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId();
        return await dbContext.StudentServiceAssignments
            .Join(dbContext.ServiceRoutes.Where(x => x.TenantId == tenantId), a => a.RouteId, r => r.Id, (a, _) => a)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
    }

    private async Task<Dictionary<Guid, AppUser>> LoadUsersAsync(IEnumerable<Guid> ids, CancellationToken cancellationToken)
    {
        var distinct = ids.Distinct().ToList();
        return distinct.Count == 0
            ? []
            : await dbContext.Users.Where(x => distinct.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
    }

    private async Task<Dictionary<Guid, ServiceVehicle>> LoadVehiclesAsync(IEnumerable<Guid> ids, CancellationToken cancellationToken)
    {
        var distinct = ids.Distinct().ToList();
        return distinct.Count == 0
            ? []
            : await dbContext.ServiceVehicles.Where(x => distinct.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
    }

    private async Task<Dictionary<Guid, ServiceDriverBriefDto>> LoadDriversWithUsersAsync(IEnumerable<Guid> ids, CancellationToken cancellationToken)
    {
        var distinct = ids.Distinct().ToList();
        if (distinct.Count == 0)
        {
            return [];
        }

        var drivers = await dbContext.ServiceDrivers.Where(x => distinct.Contains(x.Id)).ToListAsync(cancellationToken);
        var users = await LoadUsersAsync(drivers.Select(x => x.UserId), cancellationToken);
        return drivers.ToDictionary(x => x.Id, x => new ServiceDriverBriefDto(x.Id, x.UserId, users.GetValueOrDefault(x.UserId)?.FullName ?? "Şoför", x.PhoneNumber));
    }

    private async Task<Dictionary<Guid, int>> LoadAssignmentCountsAsync(IEnumerable<Guid> routeIds, CancellationToken cancellationToken)
    {
        var distinct = routeIds.Distinct().ToList();
        return distinct.Count == 0
            ? []
            : await dbContext.StudentServiceAssignments
                .Where(x => distinct.Contains(x.RouteId) && x.IsActive)
                .GroupBy(x => x.RouteId)
                .ToDictionaryAsync(x => x.Key, x => x.Count(), cancellationToken);
    }

    private Guid RequireTenantId()
    {
        return dbContext.CurrentTenantId ?? throw new UnauthorizedAccessException("Kurum bağlamı bulunamadı.");
    }

    private Guid RequireCurrentUserId()
    {
        var user = httpContextAccessor.HttpContext?.User;
        var raw = user?.FindFirstValue("user_id")
            ?? user?.FindFirstValue("nameid")
            ?? user?.FindFirstValue("sub")
            ?? user?.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var userId)
            ? userId
            : throw new UnauthorizedAccessException("Kullanıcı bilgisi bulunamadı.");
    }

    private static ServiceVehicleDto MapVehicle(ServiceVehicle x) => new(x.Id, x.TenantId, x.PlateNumber, x.Brand, x.Model, x.Capacity, x.IsActive, x.CreatedAt, x.UpdatedAt);

    private static ServiceDriverDto MapDriver(ServiceDriver x, AppUser? user) => new(x.Id, x.TenantId, x.UserId, user?.FullName ?? "Şoför", x.PhoneNumber, x.LicenseNumber, x.IsActive, x.CreatedAt, x.UpdatedAt);

    private static ServiceRouteStopDto MapStop(ServiceRouteStop x) => new(x.Id, x.RouteId, x.Name, x.Address, x.Latitude, x.Longitude, x.SortOrder, x.CreatedAt);

    private static ServiceTripDto MapTrip(ServiceTrip x) => new(x.Id, x.RouteId, x.DriverId, x.VehicleId, x.TripDate, x.TripType.ToString(), x.Status.ToString(), x.StartedAt, x.ArrivedAtSchoolAt, x.CompletedAt);

    private static void ValidateVehicle(string plateNumber, int capacity)
    {
        if (string.IsNullOrWhiteSpace(plateNumber))
        {
            throw new InvalidOperationException("Plaka boş olamaz.");
        }

        if (capacity <= 1)
        {
            throw new InvalidOperationException("Kapasite 1’den büyük olmalı.");
        }
    }

    private static void ValidateRouteRequest(string name, Guid vehicleId, Guid driverId, TimeOnly startTime, TimeOnly endTime)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new InvalidOperationException("Rota adı boş olamaz.");
        }

        if (vehicleId == Guid.Empty)
        {
            throw new InvalidOperationException("Araç seçilmeden rota oluşturulamaz.");
        }

        if (driverId == Guid.Empty)
        {
            throw new InvalidOperationException("Şoför seçilmeden rota oluşturulamaz.");
        }

        if (startTime >= endTime)
        {
            throw new InvalidOperationException("Başlangıç saati bitiş saatinden önce olmalıdır.");
        }
    }

    private static void ValidateStopRequest(string name, string address, double latitude, double longitude, int sortOrder)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new InvalidOperationException("Durak adı boş olamaz.");
        }

        if (string.IsNullOrWhiteSpace(address))
        {
            throw new InvalidOperationException("Durak adresi boş olamaz.");
        }

        ValidateCoordinates(latitude, longitude);
        if (sortOrder < 1)
        {
            throw new InvalidOperationException("Durak sırası 1’den küçük olamaz.");
        }
    }

    private static void ValidateCoordinates(double latitude, double longitude)
    {
        if (latitude is < -90 or > 90 || longitude is < -180 or > 180)
        {
            throw new InvalidOperationException("Koordinat aralığı geçersiz.");
        }
    }

    private static ServiceRouteType ParseRouteType(string value)
    {
        return Enum.TryParse<ServiceRouteType>(value, true, out var result)
            ? result
            : throw new InvalidOperationException("RouteType sadece Morning veya Evening olabilir.");
    }

    private static ServiceTripType ParseTripType(string value, bool allowBoth)
    {
        if (!Enum.TryParse<ServiceTripType>(value, true, out var result) || (!allowBoth && result == ServiceTripType.Both))
        {
            throw new InvalidOperationException(allowBoth
                ? "TripType sadece Morning, Evening veya Both olabilir."
                : "TripType sadece Morning veya Evening olabilir.");
        }

        return result;
    }

    private static ServiceAttendanceStatus ParseAttendanceStatus(string value, ServiceTripType tripType)
    {
        if (!Enum.TryParse<ServiceAttendanceStatus>(value, true, out var status))
        {
            throw new InvalidOperationException("Yoklama durumu geçersiz.");
        }

        if (tripType == ServiceTripType.Evening && status == ServiceAttendanceStatus.Boarded)
        {
            return ServiceAttendanceStatus.BoardedFromSchool;
        }

        return status;
    }

    private static string BuildAttendanceNotificationMessage(ServiceAttendanceStatus status, ServiceTripType tripType)
    {
        return status switch
        {
            ServiceAttendanceStatus.Boarded when tripType == ServiceTripType.Morning => "Öğrenciniz servise bindi.",
            ServiceAttendanceStatus.NotBoarded => "Öğrenciniz servise binmedi.",
            ServiceAttendanceStatus.BoardedFromSchool => "Öğrenciniz okul çıkışında servise bindi.",
            ServiceAttendanceStatus.ArrivedSchool => "Öğrenciniz okula ulaştı.",
            ServiceAttendanceStatus.ArrivedHome => "Öğrenciniz eve ulaştı.",
            _ => "Öğrencinizin servis durumu güncellendi.",
        };
    }
}
