using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CourseIntellect.Infrastructure.Persistence;

public sealed class CourseIntellectDbContextFactory : IDesignTimeDbContextFactory<CourseIntellectDbContext>
{
    public CourseIntellectDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<CourseIntellectDbContext>();
        var connectionString = Environment.GetEnvironmentVariable("COURSE_INTELLECT_DB")
            ?? "Host=localhost;Port=5432;Database=course_intellect;Username=postgres;Password=postgres";

        optionsBuilder.UseNpgsql(connectionString);
        return new CourseIntellectDbContext(optionsBuilder.Options);
    }
}
