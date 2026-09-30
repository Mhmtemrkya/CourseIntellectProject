using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInstitutionCustomerSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovalEmailSentAtUtc",
                table: "tenant_workspaces",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomerNumber",
                table: "tenant_workspaces",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ContactEmail",
                table: "support_tickets",
                type: "character varying(180)",
                maxLength: 180,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomerNumber",
                table: "support_tickets",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                table: "support_tickets",
                type: "uuid",
                nullable: true);

            // Existing institutions receive stable, unique numbers before the index is created.
            migrationBuilder.Sql("""
                WITH numbered AS (
                    SELECT id, row_number() OVER (ORDER BY created_at_utc, id) AS n FROM tenant_workspaces
                )
                UPDATE tenant_workspaces t SET "CustomerNumber" = 'SA-' || lpad(numbered.n::text, 12, '0')
                FROM numbered WHERE t.id = numbered.id;
                -- Names are not identities. Backfill only unambiguous historical ticket matches.
                UPDATE support_tickets s SET "TenantId" = t.id, "CustomerNumber" = t."CustomerNumber"
                FROM tenant_workspaces t
                WHERE s.tenant_name = t.name
                  AND (SELECT count(*) FROM tenant_workspaces t2 WHERE t2.name = t.name) = 1;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_tenant_workspaces_CustomerNumber",
                table: "tenant_workspaces",
                column: "CustomerNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_support_tickets_TenantId",
                table: "support_tickets",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_tenant_workspaces_CustomerNumber",
                table: "tenant_workspaces");

            migrationBuilder.DropIndex(
                name: "IX_support_tickets_TenantId",
                table: "support_tickets");

            migrationBuilder.DropColumn(
                name: "ApprovalEmailSentAtUtc",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "CustomerNumber",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "ContactEmail",
                table: "support_tickets");

            migrationBuilder.DropColumn(
                name: "CustomerNumber",
                table: "support_tickets");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "support_tickets");
        }
    }
}
