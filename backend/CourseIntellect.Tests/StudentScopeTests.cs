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

    public void Dispose() => db.Dispose();
}
