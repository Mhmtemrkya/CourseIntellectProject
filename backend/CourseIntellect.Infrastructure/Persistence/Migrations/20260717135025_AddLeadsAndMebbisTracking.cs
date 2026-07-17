using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLeadsAndMebbisTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "MebbisEnteredAtUtc",
                table: "student_driving_profiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MebbisCertificateNo",
                table: "driving_certificates",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "driving_leads",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    FullName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    LicenseClass = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Source = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ContactedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ConvertedStudentProfileId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_leads", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_leads_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_driving_leads_tenant_id",
                table: "driving_leads",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_leads_tenant_id_Phone",
                table: "driving_leads",
                columns: new[] { "tenant_id", "Phone" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_leads_tenant_id_Status",
                table: "driving_leads",
                columns: new[] { "tenant_id", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "driving_leads");

            migrationBuilder.DropColumn(
                name: "MebbisEnteredAtUtc",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "MebbisCertificateNo",
                table: "driving_certificates");
        }
    }
}
