using System.Security.Claims;
using CourseIntellect.Api.Controllers;
using CourseIntellect.Application.DTOs.ExamResults;
using CourseIntellect.Application.DTOs.Parents;
using CourseIntellect.Application.DTOs.Students;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Tests;

/// <summary>
/// Öğrenci listesi (/api/students) TC kimlik no, adres ve veli telefonu taşır.
/// UI ne gösterirse göstersin API doğrudan çağrıldığında ÖĞRENCİ yalnız kendini,
/// VELİ yalnız çocuklarını görmeli; personel rolleri kurumun tamamını görür.
/// </summary>
public sealed class StudentDirectoryScopeTests : IDisposable
{
    private readonly TestDb db = new();
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid ParentUserId = Guid.NewGuid();

    private static StudentSummaryDto Student(string name, string parentName) => new(
        Guid.NewGuid(), Guid.NewGuid(), name, "12345678901", "10-A", "", "", "2010-01-01", "",
        parentName, "+90 555 111 22 33", "veli@example.com", "Adres", "", "", $"kullanici-{name}",
        "Active", null, []);

    private sealed class StubAcademicQuery : IAcademicQueryService
    {
        public Task<IReadOnlyList<StudentSummaryDto>> GetStudentsAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<StudentSummaryDto>>(
            [
                Student("Ali VELI", "Ayse VELI"),
                Student("Ayse YILMAZ", "Baska VELI"),
                Student("Mehmet KAYA", "Ayse VELI"),
            ]);

        public Task<IReadOnlyList<ExamResultDto>> GetExamResultsAsync(string? studentName, string? className, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<ExamResultDto> CreateExamResultAsync(CreateExamResultRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<ExamResultDto?> UpdateExamResultAsync(Guid id, UpdateExamResultRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<bool> DeleteExamResultAsync(Guid id, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<PromoteStudentsResult> PromoteStudentsAsync(PromoteStudentsRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<StudentCredentialsDto> CreateStudentAsync(CreateStudentRequest request, CancellationToken cancellationToken = default, bool requireTcNo = true, bool linkExistingParent = true, bool validateParentPhone = true) => throw new NotSupportedException();
        public Task<StudentSummaryDto?> UpdateStudentAsync(Guid studentId, UpdateStudentRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<bool> DeleteStudentAsync(Guid studentId, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<ParentCredentialsDto> CreateParentAsync(CreateParentRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<ParentAccountDto>> GetParentAccountsAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private StudentsController CreateController(params Claim[] claims)
    {
        return new StudentsController(new StubAcademicQuery(), null!, db.Context)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test", "name", ClaimTypes.Role)),
                },
            },
        };
    }

    private static async Task<List<string>> NamesOf(IActionResult result)
    {
        await Task.CompletedTask;
        var ok = Assert.IsType<OkObjectResult>(result);
        var list = Assert.IsAssignableFrom<IReadOnlyList<StudentSummaryDto>>(ok.Value);
        return list.Select(x => x.FullName).ToList();
    }

    [Fact]
    public async Task Staff_SeesEveryStudent()
    {
        var controller = CreateController(
            new Claim(ClaimTypes.Role, "Admin"),
            new Claim("name", "Kurum Yonetici"));

        var names = await NamesOf(await controller.GetStudents(CancellationToken.None));

        Assert.Equal(3, names.Count);
    }

    [Fact]
    public async Task Student_SeesOnlySelf()
    {
        var controller = CreateController(
            new Claim(ClaimTypes.Role, "Student"),
            new Claim("name", "Ayse YILMAZ"));

        var names = await NamesOf(await controller.GetStudents(CancellationToken.None));

        Assert.Single(names);
        Assert.Equal("Ayse YILMAZ", names[0]);
    }

    [Fact]
    public async Task Parent_SeesOnlyOwnChildren()
    {
        db.Context.TenantWorkspaces.Add(new TenantWorkspace { Id = TenantId, Name = "Okul", Slug = "okul" });
        db.Context.Users.Add(new AppUser
        {
            Id = ParentUserId, TenantId = TenantId, Username = "veli.ayse",
            FullName = "Ayse VELI", PrimaryRole = UserRole.Parent,
        });
        // İki çocuk aynı veliye bağlı; üçüncü öğrenci başka velinin.
        db.Context.Students.AddRange(
            new StudentProfile { TenantId = TenantId, UserId = Guid.NewGuid(), FullName = "Ali VELI", ParentUserId = ParentUserId, ParentName = "Ayse VELI" },
            new StudentProfile { TenantId = TenantId, UserId = Guid.NewGuid(), FullName = "Mehmet KAYA", ParentUserId = ParentUserId, ParentName = "Ayse VELI" },
            new StudentProfile { TenantId = TenantId, UserId = Guid.NewGuid(), FullName = "Ayse YILMAZ", ParentName = "Baska VELI" });
        await db.Context.SaveChangesAsync();

        var controller = CreateController(
            new Claim(ClaimTypes.Role, "Parent"),
            new Claim("nameid", ParentUserId.ToString()),
            new Claim("name", "Ayse VELI"),
            new Claim("unique_name", "veli.ayse"));

        var names = await NamesOf(await controller.GetStudents(CancellationToken.None));

        Assert.Equal(2, names.Count);
        Assert.Contains("Ali VELI", names);
        Assert.Contains("Mehmet KAYA", names);
        Assert.DoesNotContain("Ayse YILMAZ", names);
    }

    public void Dispose() => db.Dispose();
}
