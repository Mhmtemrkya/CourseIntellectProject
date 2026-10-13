using System.Security.Claims;
using CourseIntellect.Application.DTOs.Notifications;
using CourseIntellect.Application.DTOs.ServiceTracking;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Http;

namespace CourseIntellect.Tests;

public sealed class ServiceTrackingFlowTests : IDisposable
{
    private readonly TestDb db = new();
    private readonly HttpContextAccessor accessor = new() { HttpContext = new DefaultHttpContext() };
    private readonly Recorder recorder = new();
    private readonly AppUser driverUser = new() { Username = "test.driver", FullName = "Test Şoför", PrimaryRole = UserRole.Administrative };
    private readonly AppUser parent = new() { Username = "test.parent", FullName = "Test Veli", PrimaryRole = UserRole.Parent };
    private readonly AppUser studentUser = new() { Username = "test.student", FullName = "Test Öğrenci", PrimaryRole = UserRole.Student };
    private ServiceDriver driver = null!;
    private ServiceRoute route = null!;
    private StudentProfile student = null!;
    private ServiceRouteStop stop = null!;

    private ServiceTrackingService Service => new(db.Context, accessor, new BasicETAService(), recorder, recorder, recorder);

    private void SignIn(AppUser user) => accessor.HttpContext!.User = new ClaimsPrincipal(new ClaimsIdentity(
        [new Claim("user_id", user.Id.ToString()), new Claim(ClaimTypes.Role, user.PrimaryRole.ToString())], "test"));

    private async Task Seed(ServiceRouteType type = ServiceRouteType.Morning)
    {
        driver = new ServiceDriver { UserId = driverUser.Id };
        var vehicle = new ServiceVehicle { PlateNumber = "34 TEST 001", Capacity = 16 };
        route = new ServiceRoute { Name = "Test Servis Rotası", DriverId = driver.Id, VehicleId = vehicle.Id, RouteType = type, IsActive = true };
        stop = new ServiceRouteStop { RouteId = route.Id, Name = "Test Durağı", Latitude = 41.01, Longitude = 28.98 };
        student = new StudentProfile { UserId = studentUser.Id, FullName = studentUser.FullName, ParentUserId = parent.Id, ClassName = "10-A" };
        db.Context.Users.AddRange(driverUser, parent, studentUser);
        db.Context.ServiceDrivers.Add(driver);
        db.Context.ServiceVehicles.Add(vehicle);
        db.Context.ServiceRoutes.Add(route);
        db.Context.ServiceRouteStops.Add(stop);
        db.Context.Students.Add(student);
        db.Context.StudentServiceAssignments.Add(new StudentServiceAssignment { StudentId = student.Id, ParentId = parent.Id, RouteId = route.Id, StopId = stop.Id });
        await db.Context.SaveChangesAsync();
        SignIn(driverUser);
    }

    [Fact]
    public async Task Location_ReachesParentAndStudent_WithLatestCoordinatesDistanceAndEta()
    {
        await Seed();
        var trip = await Service.StartTripAsync(new(route.Id));
        var first = await Service.UpdateDriverLocationAsync(new(trip.Id, 41.10, 29.10, 30, 90));
        var latest = await Service.UpdateDriverLocationAsync(new(trip.Id, 41.02, 28.99, 30, 90));
        Assert.Equal(2, recorder.Locations.Count);
        Assert.Equal(latest, recorder.Locations.Last());

        SignIn(parent);
        var status = Assert.Single(await Service.GetParentLiveStatusAsync());
        Assert.Equal(trip.Id, status.TripId);
        Assert.Equal(latest.Latitude, status.VehicleLatitude);
        Assert.Equal(latest.Longitude, status.VehicleLongitude);
        Assert.Equal(latest.RecordedAt, status.LastLocationAt);
        Assert.InRange(status.DistanceMeters!.Value, 1300, 1500);
        Assert.InRange(status.EtaMinutes!.Value, 2, 4);
        Assert.NotEqual(first.Latitude, status.VehicleLatitude);

        SignIn(studentUser);
        var studentStatus = Assert.Single(await Service.GetStudentLiveStatusAsync());
        Assert.Equal(status, studentStatus);
    }

    [Fact]
    public async Task BeforeFirstLocation_StopIsAvailableAndVehicleIsAbsent()
    {
        await Seed();
        await Service.StartTripAsync(new(route.Id));
        SignIn(parent);
        var status = Assert.Single(await Service.GetParentLiveStatusAsync());
        Assert.Equal(stop.Latitude, status.StopLatitude);
        Assert.Null(status.VehicleLatitude);
        Assert.Null(status.VehicleLongitude);
        Assert.Null(status.DistanceMeters);
        Assert.Null(status.EtaMinutes);
    }

    [Theory]
    [InlineData(ServiceRouteType.Morning, "Boarded", "ArrivedSchool")]
    [InlineData(ServiceRouteType.Evening, "BoardedFromSchool", "ArrivedHome")]
    public async Task TripLifecycle_UpdatesParentAttendanceHistoryAndNotifications(ServiceRouteType type, string boardedStatus, string finalStatus)
    {
        await Seed(type);
        var trip = await Service.StartTripAsync(new(route.Id));
        var duplicate = await Service.StartTripAsync(new(route.Id));
        Assert.Equal(trip.Id, duplicate.Id);
        var attendance = await Service.MarkAttendanceAsync(new(trip.Id, student.Id, "Boarded", null));
        Assert.Equal(boardedStatus, attendance.AttendanceStatus);
        if (type == ServiceRouteType.Morning) await Service.ArrivedSchoolAsync(trip.Id);
        var completed = await Service.CompleteTripAsync(trip.Id);
        Assert.Equal("Completed", completed!.Status);
        SignIn(parent);
        Assert.Equal(finalStatus, Assert.Single(await Service.GetParentLiveStatusAsync()).AttendanceStatus);
        Assert.Equal(finalStatus, Assert.Single(await Service.GetParentHistoryAsync()).AttendanceStatus);
        Assert.Equal(2, recorder.Pushes.Count);
        Assert.All(recorder.Pushes, push => Assert.Equal(parent.Id, push.UserId));
        Assert.Equal(finalStatus, recorder.Pushes.Last().Status);
    }

    [Fact]
    public async Task UnrelatedParent_CannotSeeVehicleLocationOrHistory()
    {
        await Seed();
        var trip = await Service.StartTripAsync(new(route.Id));
        await Service.UpdateDriverLocationAsync(new(trip.Id, 41.02, 28.99, 30, 90));
        SignIn(new AppUser { PrimaryRole = UserRole.Parent });
        Assert.Empty(await Service.GetParentLiveStatusAsync());
        Assert.Empty(await Service.GetParentHistoryAsync());
    }

    [Fact]
    public async Task OtherDriver_CannotSendLocationForThisTrip()
    {
        await Seed();
        var trip = await Service.StartTripAsync(new(route.Id));
        var other = new AppUser { Username = "test.other.driver", PrimaryRole = UserRole.Administrative };
        db.Context.Users.Add(other);
        db.Context.ServiceDrivers.Add(new ServiceDriver { UserId = other.Id });
        await db.Context.SaveChangesAsync();
        SignIn(other);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => Service.UpdateDriverLocationAsync(new(trip.Id, 41.02, 28.99, 30, 90)));
        Assert.Empty(recorder.Locations);
    }

    [Theory]
    [InlineData(91, 28.99)]
    [InlineData(41.02, 181)]
    public async Task InvalidCoordinates_AreRejected(double latitude, double longitude)
    {
        await Seed();
        var trip = await Service.StartTripAsync(new(route.Id));
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.UpdateDriverLocationAsync(new(trip.Id, latitude, longitude, 30, 90)));
        Assert.Empty(recorder.Locations);
    }

    public void Dispose() => db.Dispose();

    private sealed class Recorder : INotificationService, IPushNotificationService, IServiceTrackingRealtimeNotifier
    {
        public List<VehicleLocationDto> Locations { get; } = [];
        public List<(Guid UserId, string Status)> Pushes { get; } = [];
        public bool IsConfigured => true;
        public Task<IReadOnlyList<NotificationDto>> GetNotificationsAsync(string? role, string? audience, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<NotificationDto>>([]);
        public Task<NotificationDto> CreateNotificationAsync(CreateNotificationRequest r, CancellationToken cancellationToken = default) => Task.FromResult(new NotificationDto(Guid.NewGuid(), r.Title, r.Message, r.TimeLabel, r.Audience, r.TargetRole, r.Category, false));
        public Task MarkAsReadAsync(Guid id, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task SendToUserAsync(Guid userId, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default)
        {
            Pushes.Add((userId, data!["status"]));
            return Task.CompletedTask;
        }
        public Task SendToUserByNameAsync(string name, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task SendToRoleAsync(string role, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task VehicleLocationUpdatedAsync(Guid? tenant, Guid vehicle, Guid driver, Guid trip, object payload, CancellationToken cancellationToken = default)
        {
            Locations.Add((VehicleLocationDto)payload);
            return Task.CompletedTask;
        }
        public Task StudentAttendanceUpdatedAsync(Guid? tenant, Guid trip, Guid parent, object payload, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task TripStatusUpdatedAsync(Guid? tenant, Guid trip, Guid driver, object payload, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task AbsenceRequestCreatedAsync(Guid? tenant, Guid parent, object payload, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
