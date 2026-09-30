using System.Security.Claims;
using CourseIntellect.Api.Security;
using CourseIntellect.Domain.Entities;

namespace CourseIntellect.Tests;

public sealed class StudentScopeTests : IDisposable
{
    private readonly TestDb db = new();

    private static ClaimsPrincipal Principal(string role, string? name = null, Guid? userId = null)
    {
        var claims = new List<Claim> { new(ClaimTypes.Role, role) };
        if (name != null) claims.Add(new Claim("name", name));
        if (userId != null) claims.Add(new Claim("user_id", userId.Value.ToString()));
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "test", "name", ClaimTypes.Role));
    }

    [Fact]
    public async Task Student_IsScopedToOwnNameOnly()
    {
        var allowed = await StudentScope.ResolveAllowedStudentNamesAsync(
            Principal("Student", name: "Ali Kaya"), db.Context, CancellationToken.None);
        Assert.NotNull(allowed);
        Assert.Equal(["Ali Kaya"], allowed);
    }

    [Fact]
    public async Task Parent_IsScopedToOwnChildren()
    {
        var parentId = Guid.NewGuid();
        db.Context.Students.AddRange(
            new StudentProfile { FullName = "Çocuk Bir", ParentUserId = parentId, UserId = Guid.NewGuid() },
            new StudentProfile { FullName = "Çocuk İki", ParentUserId = parentId, UserId = Guid.NewGuid() },
            new StudentProfile { FullName = "Başka Öğrenci", ParentUserId = Guid.NewGuid(), UserId = Guid.NewGuid() });
        await db.Context.SaveChangesAsync();

        var allowed = await StudentScope.ResolveAllowedStudentNamesAsync(
            Principal("Parent", userId: parentId), db.Context, CancellationToken.None);

        Assert.NotNull(allowed);
        Assert.Equal(2, allowed!.Count);
        // Adlar kayıt sırasında kurum standardına getirilir (soyad büyük harf).
        Assert.Contains("Çocuk BİR", allowed);
        Assert.DoesNotContain("Başka ÖĞRENCİ", allowed);
    }

    [Fact]
    public async Task Teacher_IsUnrestricted()
    {
        var allowed = await StudentScope.ResolveAllowedStudentNamesAsync(
            Principal("Teacher", name: "Hoca"), db.Context, CancellationToken.None);
        Assert.Null(allowed);
    }

    [Fact]
    public void FilterByStudentNames_IsCaseInsensitive()
    {
        var items = new[] { "ALİ KAYA", "Ayşe Demir" };
        var filtered = StudentScope.FilterByStudentNames(items, ["Ayşe Demir"], x => x);
        Assert.Equal(["Ayşe Demir"], filtered);
    }

    [Fact]
    public void ResolveUserId_ReadsSubClaim()
    {
        // JWT kimliği "sub" ile taşır; NameIdentifier eşlenmez (inbound map kapalı).
        var id = Guid.NewGuid();
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", id.ToString())], "test"));
        Assert.Equal(id, StudentScope.ResolveUserId(principal));
    }

    [Fact]
    public async Task StudentClasses_AreOwnClassOnly()
    {
        var studentId = Guid.NewGuid();
        db.Context.Students.AddRange(
            new StudentProfile { FullName = "Kendi Öğrenci", ClassName = "10-A", UserId = studentId },
            new StudentProfile { FullName = "Başka Öğrenci", ClassName = "11-B", UserId = Guid.NewGuid() });
        await db.Context.SaveChangesAsync();

        var classes = await StudentScope.ResolveAllowedClassNamesAsync(
            Principal("Student", name: "Kendi Öğrenci", userId: studentId), db.Context, CancellationToken.None);

        Assert.Equal(["10-A"], classes);
    }

    [Fact]
    public async Task ParentClasses_AreChildrenClasses()
    {
        var parentId = Guid.NewGuid();
        db.Context.Students.AddRange(
            new StudentProfile { FullName = "Çocuk Bir", ClassName = "9-C", ParentUserId = parentId, UserId = Guid.NewGuid() },
            new StudentProfile { FullName = "Çocuk İki", ClassName = "12-A", ParentUserId = parentId, UserId = Guid.NewGuid() },
            new StudentProfile { FullName = "Başka Öğrenci", ClassName = "11-B", ParentUserId = Guid.NewGuid(), UserId = Guid.NewGuid() });
        await db.Context.SaveChangesAsync();

        var classes = await StudentScope.ResolveAllowedClassNamesAsync(
            Principal("Parent", userId: parentId), db.Context, CancellationToken.None);

        Assert.NotNull(classes);
        Assert.Equal(2, classes!.Count);
        Assert.Contains("9-C", classes);
        Assert.Contains("12-A", classes);
        Assert.DoesNotContain("11-B", classes);
    }

    [Fact]
    public async Task StaffClasses_AreUnrestricted()
    {
        var classes = await StudentScope.ResolveAllowedClassNamesAsync(
            Principal("Admin", name: "Yönetici"), db.Context, CancellationToken.None);
        Assert.Null(classes);
    }

    public void Dispose() => db.Dispose();
}
