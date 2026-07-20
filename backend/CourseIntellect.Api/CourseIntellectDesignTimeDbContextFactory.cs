using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CourseIntellect.Api;

/// <summary>
/// Migration üretimini API başlangıç işleri, Hangfire ve canlı veritabanı
/// bağlantısından ayırır. Bu bağlantı yalnız model kurmak içindir.
/// </summary>
public sealed class CourseIntellectDesignTimeDbContextFactory : IDesignTimeDbContextFactory<CourseIntellectDbContext>
{
    public CourseIntellectDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<CourseIntellectDbContext>()
            .UseNpgsql("Host=localhost;Database=course_intellect_design;Username=design;Password=design")
            .Options;
        return new CourseIntellectDbContext(options);
    }
}
