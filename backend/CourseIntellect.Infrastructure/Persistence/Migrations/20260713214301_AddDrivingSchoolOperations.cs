using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingSchoolOperations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "driving_instructor_profiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StaffId = table.Column<Guid>(type: "uuid", nullable: false),
                    LicenseClasses = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CanTeachManual = table.Column<bool>(type: "boolean", nullable: false),
                    CanTeachAutomatic = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_instructor_profiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_instructor_profiles_staff_profiles_StaffId",
                        column: x => x.StaffId,
                        principalTable: "staff_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_driving_instructor_profiles_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "driving_packages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    Name = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: false),
                    LicenseClass = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TransmissionType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    DrivingLessonMinutes = table.Column<int>(type: "integer", nullable: false),
                    TheoryLessonMinutes = table.Column<int>(type: "integer", nullable: false),
                    Price = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_packages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_packages_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "driving_vehicles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    PlateNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Brand = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Model = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ModelYear = table.Column<int>(type: "integer", nullable: false),
                    LicenseClass = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TransmissionType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CurrentKilometer = table.Column<int>(type: "integer", nullable: false),
                    InspectionExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    InsuranceExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsInMaintenance = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_vehicles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_vehicles_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "student_driving_profiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    PackageId = table.Column<Guid>(type: "uuid", nullable: false),
                    LicenseClass = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TransmissionType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PurchasedDrivingMinutes = table.Column<int>(type: "integer", nullable: false),
                    UsedDrivingMinutes = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    RegisteredAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_student_driving_profiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_student_driving_profiles_driving_packages_PackageId",
                        column: x => x.PackageId,
                        principalTable: "driving_packages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_student_driving_profiles_student_profiles_StudentId",
                        column: x => x.StudentId,
                        principalTable: "student_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_student_driving_profiles_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "driving_appointments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentDrivingProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    InstructorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    VehicleId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartsAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndsAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_appointments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_appointments_driving_instructor_profiles_Instructor~",
                        column: x => x.InstructorProfileId,
                        principalTable: "driving_instructor_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_driving_appointments_driving_vehicles_VehicleId",
                        column: x => x.VehicleId,
                        principalTable: "driving_vehicles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_driving_appointments_student_driving_profiles_StudentDrivin~",
                        column: x => x.StudentDrivingProfileId,
                        principalTable: "student_driving_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_driving_appointments_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_driving_appointments_InstructorProfileId_StartsAtUtc_EndsAt~",
                table: "driving_appointments",
                columns: new[] { "InstructorProfileId", "StartsAtUtc", "EndsAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_appointments_StudentDrivingProfileId",
                table: "driving_appointments",
                column: "StudentDrivingProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_appointments_tenant_id",
                table: "driving_appointments",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_appointments_tenant_id_StartsAtUtc_EndsAtUtc",
                table: "driving_appointments",
                columns: new[] { "tenant_id", "StartsAtUtc", "EndsAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_appointments_VehicleId_StartsAtUtc_EndsAtUtc",
                table: "driving_appointments",
                columns: new[] { "VehicleId", "StartsAtUtc", "EndsAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_instructor_profiles_StaffId",
                table: "driving_instructor_profiles",
                column: "StaffId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_instructor_profiles_tenant_id",
                table: "driving_instructor_profiles",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_instructor_profiles_tenant_id_StaffId",
                table: "driving_instructor_profiles",
                columns: new[] { "tenant_id", "StaffId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_driving_packages_tenant_id",
                table: "driving_packages",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_packages_tenant_id_Name",
                table: "driving_packages",
                columns: new[] { "tenant_id", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_driving_vehicles_tenant_id",
                table: "driving_vehicles",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_vehicles_tenant_id_PlateNumber",
                table: "driving_vehicles",
                columns: new[] { "tenant_id", "PlateNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_student_driving_profiles_PackageId",
                table: "student_driving_profiles",
                column: "PackageId");

            migrationBuilder.CreateIndex(
                name: "IX_student_driving_profiles_StudentId",
                table: "student_driving_profiles",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_student_driving_profiles_tenant_id",
                table: "student_driving_profiles",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_student_driving_profiles_tenant_id_StudentId",
                table: "student_driving_profiles",
                columns: new[] { "tenant_id", "StudentId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "driving_appointments");

            migrationBuilder.DropTable(
                name: "driving_instructor_profiles");

            migrationBuilder.DropTable(
                name: "driving_vehicles");

            migrationBuilder.DropTable(
                name: "student_driving_profiles");

            migrationBuilder.DropTable(
                name: "driving_packages");
        }
    }
}
