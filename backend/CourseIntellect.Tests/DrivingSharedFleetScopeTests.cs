using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

/// <summary>
/// Ortak filo sözleşmesi: direksiyon randevuları ŞUBEYE KİLİTLENMEZ. Şube filtresi
/// aktifken bile bir şube diğer şubenin randevusunu görebilmelidir — takvim tek
/// parçadır ve araç çakışması ancak böyle şubeler arası yakalanır. Randevu
/// şube-kapsamlı bir entity'ye çevrilirse bu test kırılır (kasıtlı bariyer).
/// </summary>
public sealed class DrivingSharedFleetScopeTests : IDisposable
{
    private readonly SqliteConnection connection;
    private readonly Guid branchA = Guid.NewGuid();
    private readonly Guid branchB = Guid.NewGuid();

    public DrivingSharedFleetScopeTests()
    {
        connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
        using var setup = CreateContext(activeBranchId: null);
        setup.Database.EnsureCreated();
    }

    private CourseIntellectDbContext CreateContext(Guid? activeBranchId)
    {
        var options = new DbContextOptionsBuilder<CourseIntellectDbContext>()
            .UseSqlite(connection)
            .Options;
        return new CourseIntellectDbContext(options, activeScope: new FixedScope(activeBranchId));
    }

    [Fact]
    public async Task Appointments_OfOtherBranches_StayVisibleWhileBranchFilterIsActive()
    {
        Guid vehicleId;
        await using (var seed = CreateContext(activeBranchId: null))
        {
            // Randevunun bağlı olduğu asgari kayıtlar (FK): şubeler, araç, öğretmen, kursiyer.
            var unitA = new OrgUnit { Id = branchA, Name = "Merkez Şube", UnitType = "Şube" };
            var unitB = new OrgUnit { Id = branchB, Name = "Yakutiye Şube", UnitType = "Şube" };
            var vehicle = new DrivingVehicle { PlateNumber = "25 ABC 25", LicenseClass = "B" };
            var staff = new StaffProfile { UserId = Guid.NewGuid(), FullName = "Usta Öğretici", Role = UserRole.Teacher };
            var instructor = new DrivingInstructorProfile { StaffId = staff.Id, LicenseClasses = "B" };
            var student = new StudentProfile { UserId = Guid.NewGuid(), FullName = "Aday Kursiyer" };
            var package = new DrivingPackage { Name = "B Paketi", LicenseClass = "B" };
            var profile = new StudentDrivingProfile { StudentId = student.Id, PackageId = package.Id };
            seed.AddRange(unitA, unitB, vehicle, staff, instructor, student, package, profile);
            await seed.SaveChangesAsync();

            vehicleId = vehicle.Id;
            seed.DrivingAppointments.AddRange(
                Appointment(profile.Id, instructor.Id, vehicleId, branchA, new DateTime(2026, 8, 3, 9, 0, 0, DateTimeKind.Utc)),
                Appointment(profile.Id, instructor.Id, vehicleId, branchB, new DateTime(2026, 8, 3, 11, 0, 0, DateTimeKind.Utc)));
            await seed.SaveChangesAsync();
        }

        await using var scoped = CreateContext(activeBranchId: branchA);
        var visible = await scoped.DrivingAppointments.AsNoTracking()
            .Where(x => x.VehicleId == vehicleId)
            .ToListAsync();

        Assert.Equal(2, visible.Count);
        Assert.Contains(visible, x => x.BranchId == branchB);
    }

    [Fact]
    public async Task BranchScopedEntities_StillHideOtherBranches()
    {
        // Karşı örnek: gerçekten şube-kapsamlı bir kayıt filtreleniyor mu?
        await using (var seed = CreateContext(activeBranchId: null))
        {
            seed.DrivingExpenses.AddRange(
                new DrivingExpense { BranchId = branchA, Title = "A şubesi mazot", Amount = 100 },
                new DrivingExpense { BranchId = branchB, Title = "B şubesi mazot", Amount = 200 });
            await seed.SaveChangesAsync();
        }

        await using var scoped = CreateContext(activeBranchId: branchA);
        var visible = await scoped.DrivingExpenses.AsNoTracking().ToListAsync();

        Assert.Single(visible);
        Assert.Equal(branchA, visible[0].BranchId);
    }

    private static DrivingAppointment Appointment(
        Guid studentProfileId,
        Guid instructorProfileId,
        Guid vehicleId,
        Guid branchId,
        DateTime startsAtUtc) => new()
    {
        StudentDrivingProfileId = studentProfileId,
        InstructorProfileId = instructorProfileId,
        VehicleId = vehicleId,
        BranchId = branchId,
        StartsAtUtc = startsAtUtc,
        EndsAtUtc = startsAtUtc.AddHours(1),
        Status = DrivingAppointmentStatus.Planned,
    };

    public void Dispose() => connection.Dispose();

    private sealed class FixedScope(Guid? branchId) : IActiveScope
    {
        public bool IsResolved => true;
        public Guid? TenantId => null;
        public Guid? BranchId { get; private set; } = branchId;
        public void Set(Guid? tenantId, Guid? branch) => BranchId = branch;
    }
}
