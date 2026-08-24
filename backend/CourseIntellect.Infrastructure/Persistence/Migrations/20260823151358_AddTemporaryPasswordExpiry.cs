using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTemporaryPasswordExpiry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "temporary_password_expires_at_utc",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            // Existing forced-reset accounts must not become indefinite credentials when
            // expiry enforcement is introduced. Keep the model nullable for ordinary
            // passwords, but give every current MustChangePassword account a bounded,
            // explicit window measured by the database clock at migration time.
            migrationBuilder.Sql("""
                UPDATE users
                SET temporary_password_expires_at_utc = CURRENT_TIMESTAMP + INTERVAL '7 days'
                WHERE must_change_password = TRUE
                  AND temporary_password_expires_at_utc IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "temporary_password_expires_at_utc",
                table: "users");
        }
    }
}
