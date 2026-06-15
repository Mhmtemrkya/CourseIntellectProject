using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(CourseIntellectDbContext))]
    [Migration("20260411000000_AddPendingAdminPasswordHash")]
    public partial class AddPendingAdminPasswordHash : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE tenant_workspaces
                ADD COLUMN IF NOT EXISTS ""PendingAdminPasswordHash"" character varying(500);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE tenant_workspaces
                DROP COLUMN IF EXISTS ""PendingAdminPasswordHash"";
            ");
        }
    }
}
