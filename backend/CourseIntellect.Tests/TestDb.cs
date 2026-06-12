using CourseIntellect.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

/// <summary>
/// Sqlite in-memory üzerinde gerçek EF modeliyle çalışan test bağlamı.
/// Tenant erişimcisi verilmediği için global tenant filtreleri devre dışıdır.
/// </summary>
public sealed class TestDb : IDisposable
{
    private readonly SqliteConnection connection;

    public CourseIntellectDbContext Context { get; }

    public TestDb()
    {
        connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
        var options = new DbContextOptionsBuilder<CourseIntellectDbContext>()
            .UseSqlite(connection)
            .Options;
        Context = new CourseIntellectDbContext(options);
        Context.Database.EnsureCreated();
    }

    public void Dispose()
    {
        Context.Dispose();
        connection.Dispose();
    }
}
