using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class HardenDeletionCompletion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Stop before changing the old indexes if legacy failed requests overlap a new request.
            // Preserve every request for operator reconciliation instead of silently discarding one.
            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM account_deletion_requests WHERE "Status" IN (1,2,5,6) GROUP BY "UserId" HAVING COUNT(*) > 1) THEN
                        RAISE EXCEPTION 'Reconcile duplicate active account deletion requests before migration.';
                    END IF;
                    IF EXISTS (SELECT 1 FROM institution_deletion_requests WHERE "Status" IN (1,2,4,6,7) GROUP BY tenant_id HAVING COUNT(*) > 1) THEN
                        RAISE EXCEPTION 'Reconcile duplicate active institution deletion requests before migration.';
                    END IF;
                END $$;
                """);
            migrationBuilder.DropIndex(
                name: "IX_institution_deletion_requests_tenant_id",
                table: "institution_deletion_requests");

            migrationBuilder.DropIndex(
                name: "IX_account_deletion_requests_UserId",
                table: "account_deletion_requests");

            migrationBuilder.AddColumn<DateTime>(
                name: "ProcessingStartedAtUtc",
                table: "institution_deletion_requests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CompletionTokensJson",
                table: "account_deletion_requests",
                type: "text",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<DateTime>(
                name: "ProcessingStartedAtUtc",
                table: "account_deletion_requests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "deletion_file_tasks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    OperationKey = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    FileUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_deletion_file_tasks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_deletion_file_tasks_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_institution_deletion_requests_tenant_id",
                table: "institution_deletion_requests",
                column: "tenant_id",
                unique: true,
                filter: "\"Status\" IN (1, 2, 4, 6, 7)");

            migrationBuilder.CreateIndex(
                name: "IX_account_deletion_requests_UserId",
                table: "account_deletion_requests",
                column: "UserId",
                unique: true,
                filter: "\"Status\" IN (1, 2, 5, 6)");

            migrationBuilder.CreateIndex(
                name: "IX_deletion_file_tasks_OperationKey_FileUrl",
                table: "deletion_file_tasks",
                columns: new[] { "OperationKey", "FileUrl" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_deletion_file_tasks_tenant_id",
                table: "deletion_file_tasks",
                column: "tenant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "deletion_file_tasks");

            migrationBuilder.DropIndex(
                name: "IX_institution_deletion_requests_tenant_id",
                table: "institution_deletion_requests");

            migrationBuilder.DropIndex(
                name: "IX_account_deletion_requests_UserId",
                table: "account_deletion_requests");

            migrationBuilder.DropColumn(
                name: "ProcessingStartedAtUtc",
                table: "institution_deletion_requests");

            migrationBuilder.DropColumn(
                name: "CompletionTokensJson",
                table: "account_deletion_requests");

            migrationBuilder.DropColumn(
                name: "ProcessingStartedAtUtc",
                table: "account_deletion_requests");

            migrationBuilder.CreateIndex(
                name: "IX_institution_deletion_requests_tenant_id",
                table: "institution_deletion_requests",
                column: "tenant_id",
                unique: true,
                filter: "\"Status\" IN (1, 2, 4)");

            migrationBuilder.CreateIndex(
                name: "IX_account_deletion_requests_UserId",
                table: "account_deletion_requests",
                column: "UserId",
                unique: true,
                filter: "\"Status\" IN (1, 2)");
        }
    }
}
