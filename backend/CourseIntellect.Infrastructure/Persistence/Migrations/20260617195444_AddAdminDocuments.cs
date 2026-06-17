using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminDocuments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "admin_documents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(220)", maxLength: 220, nullable: false),
                    Category = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Direction = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    DocumentNo = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    RelatedParty = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    FileUrl = table.Column<string>(type: "character varying(700)", maxLength: 700, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    UploadedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UploadedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ExpiryDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_admin_documents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_admin_documents_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_admin_documents_tenant_id",
                table: "admin_documents",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_admin_documents_tenant_id_Category",
                table: "admin_documents",
                columns: new[] { "tenant_id", "Category" });

            migrationBuilder.CreateIndex(
                name: "IX_admin_documents_tenant_id_Status",
                table: "admin_documents",
                columns: new[] { "tenant_id", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "admin_documents");
        }
    }
}
