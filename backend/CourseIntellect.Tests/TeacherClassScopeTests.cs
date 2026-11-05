using System.Security.Claims;
using CourseIntellect.Api.Controllers;
using CourseIntellect.Application.DTOs.Insights;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace CourseIntellect.Tests;

/// <summary>Konu analizi: öğretmen yalnız ders verdiği sınıfları görür; rehber ve yönetici hepsini.</summary>
public sealed class TeacherClassScopeTests : IDisposable
{
    private static readonly Guid Tenant = Guid.NewGuid();
    private readonly SqliteConnection connection = new("DataSource=:memory:");
    private readonly CourseIntellectDbContext db;

    public TeacherClassScopeTests()
    {
        connection.Open();
        db = new CourseIntellectDbContext(new DbContextOptionsBuilder<CourseIntellectDbContext>().UseSqlite(connection).Options);
        db.Database.EnsureCreated();
        db.TenantWorkspaces.Add(new TenantWorkspace { Id = Tenant, Name = "Okul", Slug = $"t-{Guid.NewGuid():N}"[..20], Status = "active" });
        db.SaveChanges();
        db.SetTenantOverride(Tenant);
    }

    public void Dispose()
    {
        db.Dispose();
        connection.Dispose();
    }

    private sealed class DisabledGenerator : IInsightTextGenerator
    {
        public bool IsEnabled => false;
        public string Model => "off";
        public Task<string?> GenerateJsonAsync(string systemPrompt, IReadOnlyList<(string Role, string Content)> messages, object jsonSchema, CancellationToken cancellationToken) => Task.FromResult<string?>(null);
    }

    private Guid User(string name, UserRole role, string branch = "")
    {
        var user = new AppUser { FullName = name, Username = $"u-{Guid.NewGuid():N}"[..18], PasswordHash = "x", PrimaryRole = role, DepartmentOrBranch = branch };
        db.Users.Add(user);
        db.SaveChanges();
        return user.Id;
    }

    private Guid Student(string name, string className)
    {
        var id = User(name, UserRole.Student);
        db.Students.Add(new StudentProfile { UserId = id, FullName = name, ClassName = className });
        db.SaveChanges();
        return id;
    }

    private StudentInsightsController Controller(Guid userId, params string[] roles)
    {
        var service = new StudentInsightService(db, new DisabledGenerator(), new NoOpBackgroundJobClient(NullLogger<NoOpBackgroundJobClient>.Instance), NullLogger<StudentInsightService>.Instance);
        var claims = new List<Claim> { new("sub", userId.ToString()), new("tenant_id", Tenant.ToString()) };
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));
        return new StudentInsightsController(service, db)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")) } },
        };
    }

    private void Staff(Guid userId, string homeroom, string assigned)
    {
        db.Staff.Add(new StaffProfile { UserId = userId, FullName = "Öğretmen", Role = UserRole.Teacher, HomeroomClass = homeroom, AssignedClassesSerialized = assigned });
        db.SaveChanges();
    }

    [Fact]
    public async Task HomeroomAndAssignedClasses_AlsoLinkATeacher_ButNoHomeroomOptionDoesNot()
    {
        var homeroomTeacher = User("Sınıf Öğretmeni", UserRole.Teacher, "Matematik");
        Staff(homeroomTeacher, "9 A", "");
        var assignedTeacher = User("Branş Öğretmeni", UserRole.Teacher, "Fizik");
        Staff(assignedTeacher, CourseIntellect.Infrastructure.Services.TeacherClassLinks.NoHomeroom, "10/B, 11-C");
        var unlinked = User("Bağsız Öğretmen", UserRole.Teacher, "Kimya");
        Staff(unlinked, CourseIntellect.Infrastructure.Services.TeacherClassLinks.NoHomeroom, "");
        Student("Ece Kurt", "9-A");
        Student("Deniz Ak", "10-B");
        Student("Ozan Er", "11-C");

        string[] Classes(IActionResult result) => Assert.IsType<InsightOverviewDto>(Assert.IsType<OkObjectResult>(result).Value).Classes.Select(item => item.ClassName).OrderBy(x => x).ToArray();
        Assert.Equal(["9-A"], Classes(await Controller(homeroomTeacher, "Teacher").GetOverview(CancellationToken.None)));
        Assert.Equal(["10-B", "11-C"], Classes(await Controller(assignedTeacher, "Teacher").GetOverview(CancellationToken.None)));
        Assert.Empty(Classes(await Controller(unlinked, "Teacher").GetOverview(CancellationToken.None)));

        // Yönetici uyarısı: rehber olmayan ve hiç bağı olmayan öğretmenler sayılır.
        User("Rehber", UserRole.Teacher, "Rehberlik");
        Assert.Equal(1, await CourseIntellect.Infrastructure.Services.TeacherClassLinks.UnlinkedTeacherCountAsync(db, CancellationToken.None));

        // Maydi/roster da aynı kuralla öğrenci kaydındaki yazımı döner.
        Assert.Equal(["10-B", "11-C"], (await CourseIntellect.Infrastructure.Services.TeacherClassLinks.StudentClassNamesAsync(db, assignedTeacher, CancellationToken.None)).OrderBy(x => x));
    }

    [Fact]
    public async Task Teacher_SeesOnlyClassesInTheirTimetable_RehberAndAdminSeeAll()
    {
        var teacher = User("Hasan Hoca", UserRole.Teacher, "Matematik");
        var rehber = User("Ayşe Rehber", UserRole.Teacher, "Rehberlik");
        var admin = User("Yönetici", UserRole.Admin);
        db.TeacherTimetableSlots.Add(new TeacherTimetableSlot { TeacherUserId = teacher, TeacherName = "Hasan Hoca", DayOfWeek = 1, StartTime = "09:00", EndTime = "09:40", ClassName = "10/A", Lesson = "Matematik" });
        db.SaveChanges();
        var mine = Student("Ece Kurt", "10-A");
        var other = Student("Deniz Ak", "9-B");

        var overview = Assert.IsType<InsightOverviewDto>(Assert.IsType<OkObjectResult>(await Controller(teacher, "Teacher").GetOverview(CancellationToken.None)).Value);
        Assert.Equal(["10-A"], overview.Classes.Select(item => item.ClassName));

        Assert.IsType<OkObjectResult>(await Controller(teacher, "Teacher").GetClass("10-A", CancellationToken.None));
        Assert.IsType<NotFoundObjectResult>(await Controller(teacher, "Teacher").GetClass("9-B", CancellationToken.None));
        Assert.IsType<OkObjectResult>(await Controller(teacher, "Teacher").GetStudent(mine, CancellationToken.None));
        Assert.IsType<NotFoundObjectResult>(await Controller(teacher, "Teacher").GetStudent(other, CancellationToken.None));
        Assert.IsType<NotFoundObjectResult>(await Controller(teacher, "Teacher").RequestNote(other, CancellationToken.None));

        foreach (var (who, role) in new[] { (rehber, "Teacher"), (admin, "Admin") })
        {
            Assert.IsType<OkObjectResult>(await Controller(who, role).GetClass("9-B", CancellationToken.None));
            Assert.IsType<OkObjectResult>(await Controller(who, role).GetStudent(other, CancellationToken.None));
        }

        // Ders programı olmayan (rehber olmayan) öğretmen hiçbir sınıfı görmez.
        var noTimetable = User("Yeni Hoca", UserRole.Teacher, "Fizik");
        var empty = Assert.IsType<InsightOverviewDto>(Assert.IsType<OkObjectResult>(await Controller(noTimetable, "Teacher").GetOverview(CancellationToken.None)).Value);
        Assert.Empty(empty.Classes);
    }
}
