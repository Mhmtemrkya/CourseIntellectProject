using CourseIntellect.Infrastructure.Persistence.Migrations;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using System.Reflection;

namespace CourseIntellect.Tests;

public sealed class MigrationSafetyTests
{
    [Fact]
    public void Temporary_password_expiry_backfills_forced_reset_users_with_bounded_window()
    {
        var operations = UpOperations(new AddTemporaryPasswordExpiry());
        var addColumn = Assert.Single(operations.OfType<AddColumnOperation>());
        Assert.Equal("temporary_password_expires_at_utc", addColumn.Name);
        Assert.True(addColumn.IsNullable);

        var sql = string.Join("\n", operations.OfType<SqlOperation>().Select(x => x.Sql));
        Assert.Contains("UPDATE users", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("must_change_password = TRUE", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("temporary_password_expires_at_utc IS NULL", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("CURRENT_TIMESTAMP + INTERVAL '7 days'", sql, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Tenant_registration_migration_copies_candidates_without_deleting_source_rows()
    {
        var operations = UpOperations(new AddTenantRegistrationApplications());
        var sql = string.Join("\n", operations.OfType<SqlOperation>().Select(x => x.Sql));

        Assert.Contains("INSERT INTO tenant_registration_applications", sql, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("DELETE FROM tenant_workspaces", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(operations.OfType<DeleteDataOperation>());
        Assert.Empty(operations.OfType<DropTableOperation>());
    }

    private static IReadOnlyList<MigrationOperation> UpOperations(Migration migration)
    {
        var builder = new MigrationBuilder("Npgsql.EntityFrameworkCore.PostgreSQL");
        var up = migration.GetType().GetMethod("Up", BindingFlags.Instance | BindingFlags.NonPublic)
            ?? throw new InvalidOperationException($"{migration.GetType().Name}.Up was not found.");
        up.Invoke(migration, [builder]);
        return builder.Operations;
    }
}
