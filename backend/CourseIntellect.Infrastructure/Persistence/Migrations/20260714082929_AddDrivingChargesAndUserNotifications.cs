using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingChargesAndUserNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "created_at_utc",
                table: "notifications",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "dedupe_key",
                table: "notifications",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "related_entity_id",
                table: "notifications",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "related_entity_type",
                table: "notifications",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "target_user_id",
                table: "notifications",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "driving_charges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentDrivingProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    ChargeType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    GrossAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountReason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    NetAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Minutes = table.Column<int>(type: "integer", nullable: false),
                    FinanceInstallmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    EnrollmentContractId = table.Column<Guid>(type: "uuid", nullable: true),
                    RefundedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RefundReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    RefundedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_charges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_charges_student_driving_profiles_StudentDrivingProf~",
                        column: x => x.StudentDrivingProfileId,
                        principalTable: "student_driving_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_driving_charges_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_notifications_dedupe_key_created_at_utc",
                table: "notifications",
                columns: new[] { "dedupe_key", "created_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_notifications_tenant_id_target_user_id_IsRead",
                table: "notifications",
                columns: new[] { "tenant_id", "target_user_id", "IsRead" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_charges_StudentDrivingProfileId_CreatedAtUtc",
                table: "driving_charges",
                columns: new[] { "StudentDrivingProfileId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_charges_tenant_id",
                table: "driving_charges",
                column: "tenant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "driving_charges");

            migrationBuilder.DropIndex(
                name: "IX_notifications_dedupe_key_created_at_utc",
                table: "notifications");

            migrationBuilder.DropIndex(
                name: "IX_notifications_tenant_id_target_user_id_IsRead",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "created_at_utc",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "dedupe_key",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "related_entity_id",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "related_entity_type",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "target_user_id",
                table: "notifications");
        }
    }
}
