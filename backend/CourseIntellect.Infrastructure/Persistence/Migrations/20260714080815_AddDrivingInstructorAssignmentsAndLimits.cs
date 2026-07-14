using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingInstructorAssignmentsAndLimits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "FinancialHoldEnabled",
                table: "driving_school_settings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "FinancialHoldThreshold",
                table: "driving_school_settings",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "MaxInstructorDailyMinutes",
                table: "driving_school_settings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MaxStudentDailyLessons",
                table: "driving_school_settings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MaxVehicleDailyMinutes",
                table: "driving_school_settings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PreparationMinutes",
                table: "driving_school_settings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "driving_instructor_leaves",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    InstructorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartsAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndsAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LeaveType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_instructor_leaves", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_instructor_leaves_driving_instructor_profiles_Instr~",
                        column: x => x.InstructorProfileId,
                        principalTable: "driving_instructor_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_driving_instructor_leaves_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "driving_instructor_vehicle_assignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    InstructorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    VehicleId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignmentType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    StartsOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EndsOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DaysOfWeekMask = table.Column<int>(type: "integer", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_instructor_vehicle_assignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_instructor_vehicle_assignments_driving_instructor_p~",
                        column: x => x.InstructorProfileId,
                        principalTable: "driving_instructor_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_driving_instructor_vehicle_assignments_driving_vehicles_Veh~",
                        column: x => x.VehicleId,
                        principalTable: "driving_vehicles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_driving_instructor_vehicle_assignments_tenant_workspaces_te~",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "driving_instructor_working_hours",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    InstructorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    DayOfWeek = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StartMinute = table.Column<int>(type: "integer", nullable: false),
                    EndMinute = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_instructor_working_hours", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_instructor_working_hours_driving_instructor_profile~",
                        column: x => x.InstructorProfileId,
                        principalTable: "driving_instructor_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_driving_instructor_working_hours_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_driving_instructor_leaves_InstructorProfileId_StartsAtUtc_E~",
                table: "driving_instructor_leaves",
                columns: new[] { "InstructorProfileId", "StartsAtUtc", "EndsAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_instructor_leaves_tenant_id",
                table: "driving_instructor_leaves",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_instructor_vehicle_assignments_InstructorProfileId_~",
                table: "driving_instructor_vehicle_assignments",
                columns: new[] { "InstructorProfileId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_instructor_vehicle_assignments_tenant_id",
                table: "driving_instructor_vehicle_assignments",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_instructor_vehicle_assignments_VehicleId_IsActive",
                table: "driving_instructor_vehicle_assignments",
                columns: new[] { "VehicleId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_instructor_working_hours_InstructorProfileId_DayOfW~",
                table: "driving_instructor_working_hours",
                columns: new[] { "InstructorProfileId", "DayOfWeek" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_instructor_working_hours_tenant_id",
                table: "driving_instructor_working_hours",
                column: "tenant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "driving_instructor_leaves");

            migrationBuilder.DropTable(
                name: "driving_instructor_vehicle_assignments");

            migrationBuilder.DropTable(
                name: "driving_instructor_working_hours");

            migrationBuilder.DropColumn(
                name: "FinancialHoldEnabled",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "FinancialHoldThreshold",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "MaxInstructorDailyMinutes",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "MaxStudentDailyLessons",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "MaxVehicleDailyMinutes",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "PreparationMinutes",
                table: "driving_school_settings");
        }
    }
}
