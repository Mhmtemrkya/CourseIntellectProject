using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingVehicleCompliance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "driving_vehicle_documents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    VehicleId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    DocumentNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    StartsAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FileUrl = table.Column<string>(type: "character varying(700)", maxLength: 700, nullable: false),
                    ReminderDays = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ApprovedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ApprovedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_vehicle_documents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_vehicle_documents_driving_vehicles_VehicleId",
                        column: x => x.VehicleId,
                        principalTable: "driving_vehicles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_driving_vehicle_documents_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "driving_vehicle_service_records",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    VehicleId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecordType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Title = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    ServiceProvider = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Priority = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ReportedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Kilometer = table.Column<int>(type: "integer", nullable: false),
                    VehicleUsable = table.Column<bool>(type: "boolean", nullable: false),
                    LaborCost = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    PartsCost = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    NextServiceAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NextServiceKilometer = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Resolution = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReportedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_vehicle_service_records", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_vehicle_service_records_driving_vehicles_VehicleId",
                        column: x => x.VehicleId,
                        principalTable: "driving_vehicles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_driving_vehicle_service_records_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_driving_vehicle_documents_tenant_id",
                table: "driving_vehicle_documents",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_vehicle_documents_tenant_id_VehicleId_DocumentType_~",
                table: "driving_vehicle_documents",
                columns: new[] { "tenant_id", "VehicleId", "DocumentType", "ExpiresAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_vehicle_documents_VehicleId",
                table: "driving_vehicle_documents",
                column: "VehicleId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_vehicle_service_records_NextServiceAtUtc_NextServic~",
                table: "driving_vehicle_service_records",
                columns: new[] { "NextServiceAtUtc", "NextServiceKilometer" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_vehicle_service_records_tenant_id",
                table: "driving_vehicle_service_records",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_vehicle_service_records_tenant_id_VehicleId_Status",
                table: "driving_vehicle_service_records",
                columns: new[] { "tenant_id", "VehicleId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_vehicle_service_records_VehicleId",
                table: "driving_vehicle_service_records",
                column: "VehicleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "driving_vehicle_documents");

            migrationBuilder.DropTable(
                name: "driving_vehicle_service_records");
        }
    }
}
