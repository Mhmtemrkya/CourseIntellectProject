using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceTrackingModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "service_drivers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    phone_number = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    license_number = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_service_drivers", x => x.id);
                    table.ForeignKey(
                        name: "FK_service_drivers_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_service_drivers_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "service_vehicles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    plate_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    brand = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    model = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    capacity = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_service_vehicles", x => x.id);
                    table.ForeignKey(
                        name: "FK_service_vehicles_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "service_routes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    route_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    vehicle_id = table.Column<Guid>(type: "uuid", nullable: false),
                    driver_id = table.Column<Guid>(type: "uuid", nullable: false),
                    start_time = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    end_time = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_service_routes", x => x.id);
                    table.ForeignKey(
                        name: "FK_service_routes_service_drivers_driver_id",
                        column: x => x.driver_id,
                        principalTable: "service_drivers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_service_routes_service_vehicles_vehicle_id",
                        column: x => x.vehicle_id,
                        principalTable: "service_vehicles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_service_routes_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "service_absence_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    student_id = table.Column<Guid>(type: "uuid", nullable: false),
                    parent_id = table.Column<Guid>(type: "uuid", nullable: false),
                    route_id = table.Column<Guid>(type: "uuid", nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    trip_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_service_absence_requests", x => x.id);
                    table.ForeignKey(
                        name: "FK_service_absence_requests_service_routes_route_id",
                        column: x => x.route_id,
                        principalTable: "service_routes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_service_absence_requests_student_profiles_student_id",
                        column: x => x.student_id,
                        principalTable: "student_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_service_absence_requests_users_parent_id",
                        column: x => x.parent_id,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "service_route_stops",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    route_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    address = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: false),
                    latitude = table.Column<double>(type: "double precision", nullable: false),
                    longitude = table.Column<double>(type: "double precision", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_service_route_stops", x => x.id);
                    table.ForeignKey(
                        name: "FK_service_route_stops_service_routes_route_id",
                        column: x => x.route_id,
                        principalTable: "service_routes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "service_trips",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    route_id = table.Column<Guid>(type: "uuid", nullable: false),
                    driver_id = table.Column<Guid>(type: "uuid", nullable: false),
                    vehicle_id = table.Column<Guid>(type: "uuid", nullable: false),
                    trip_date = table.Column<DateOnly>(type: "date", nullable: false),
                    trip_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    arrived_at_school_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_service_trips", x => x.id);
                    table.ForeignKey(
                        name: "FK_service_trips_service_drivers_driver_id",
                        column: x => x.driver_id,
                        principalTable: "service_drivers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_service_trips_service_routes_route_id",
                        column: x => x.route_id,
                        principalTable: "service_routes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_service_trips_service_vehicles_vehicle_id",
                        column: x => x.vehicle_id,
                        principalTable: "service_vehicles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "student_service_assignments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    student_id = table.Column<Guid>(type: "uuid", nullable: false),
                    parent_id = table.Column<Guid>(type: "uuid", nullable: false),
                    route_id = table.Column<Guid>(type: "uuid", nullable: false),
                    stop_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_student_service_assignments", x => x.id);
                    table.ForeignKey(
                        name: "FK_student_service_assignments_service_route_stops_stop_id",
                        column: x => x.stop_id,
                        principalTable: "service_route_stops",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_student_service_assignments_service_routes_route_id",
                        column: x => x.route_id,
                        principalTable: "service_routes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_student_service_assignments_student_profiles_student_id",
                        column: x => x.student_id,
                        principalTable: "student_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_student_service_assignments_users_parent_id",
                        column: x => x.parent_id,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "service_attendances",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    trip_id = table.Column<Guid>(type: "uuid", nullable: false),
                    student_id = table.Column<Guid>(type: "uuid", nullable: false),
                    parent_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    marked_by_driver_id = table.Column<Guid>(type: "uuid", nullable: false),
                    marked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_service_attendances", x => x.id);
                    table.ForeignKey(
                        name: "FK_service_attendances_service_drivers_marked_by_driver_id",
                        column: x => x.marked_by_driver_id,
                        principalTable: "service_drivers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_service_attendances_service_trips_trip_id",
                        column: x => x.trip_id,
                        principalTable: "service_trips",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_service_attendances_student_profiles_student_id",
                        column: x => x.student_id,
                        principalTable: "student_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_service_attendances_users_parent_id",
                        column: x => x.parent_id,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "service_vehicle_locations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    vehicle_id = table.Column<Guid>(type: "uuid", nullable: false),
                    driver_id = table.Column<Guid>(type: "uuid", nullable: false),
                    trip_id = table.Column<Guid>(type: "uuid", nullable: false),
                    latitude = table.Column<double>(type: "double precision", nullable: false),
                    longitude = table.Column<double>(type: "double precision", nullable: false),
                    speed = table.Column<double>(type: "double precision", nullable: true),
                    heading = table.Column<double>(type: "double precision", nullable: true),
                    recorded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_service_vehicle_locations", x => x.id);
                    table.ForeignKey(
                        name: "FK_service_vehicle_locations_service_drivers_driver_id",
                        column: x => x.driver_id,
                        principalTable: "service_drivers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_service_vehicle_locations_service_trips_trip_id",
                        column: x => x.trip_id,
                        principalTable: "service_trips",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_service_vehicle_locations_service_vehicles_vehicle_id",
                        column: x => x.vehicle_id,
                        principalTable: "service_vehicles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_service_absence_requests_parent_id",
                table: "service_absence_requests",
                column: "parent_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_absence_requests_route_id",
                table: "service_absence_requests",
                column: "route_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_absence_requests_student_id_date_trip_type",
                table: "service_absence_requests",
                columns: new[] { "student_id", "date", "trip_type" });

            migrationBuilder.CreateIndex(
                name: "IX_service_attendances_marked_by_driver_id",
                table: "service_attendances",
                column: "marked_by_driver_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_attendances_parent_id",
                table: "service_attendances",
                column: "parent_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_attendances_student_id",
                table: "service_attendances",
                column: "student_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_attendances_trip_id_student_id",
                table: "service_attendances",
                columns: new[] { "trip_id", "student_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_service_drivers_tenant_id",
                table: "service_drivers",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_drivers_user_id",
                table: "service_drivers",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_route_stops_route_id_sort_order",
                table: "service_route_stops",
                columns: new[] { "route_id", "sort_order" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_service_routes_driver_id",
                table: "service_routes",
                column: "driver_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_routes_tenant_id",
                table: "service_routes",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_routes_tenant_id_route_type_is_active",
                table: "service_routes",
                columns: new[] { "tenant_id", "route_type", "is_active" });

            migrationBuilder.CreateIndex(
                name: "IX_service_routes_vehicle_id",
                table: "service_routes",
                column: "vehicle_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_trips_driver_id",
                table: "service_trips",
                column: "driver_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_trips_route_id_trip_date_trip_type",
                table: "service_trips",
                columns: new[] { "route_id", "trip_date", "trip_type" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_service_trips_vehicle_id",
                table: "service_trips",
                column: "vehicle_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_vehicle_locations_driver_id",
                table: "service_vehicle_locations",
                column: "driver_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_vehicle_locations_trip_id",
                table: "service_vehicle_locations",
                column: "trip_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_vehicle_locations_vehicle_id_recorded_at",
                table: "service_vehicle_locations",
                columns: new[] { "vehicle_id", "recorded_at" });

            migrationBuilder.CreateIndex(
                name: "IX_service_vehicles_plate_number",
                table: "service_vehicles",
                column: "plate_number");

            migrationBuilder.CreateIndex(
                name: "IX_service_vehicles_tenant_id",
                table: "service_vehicles",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_student_service_assignments_parent_id",
                table: "student_service_assignments",
                column: "parent_id");

            migrationBuilder.CreateIndex(
                name: "IX_student_service_assignments_route_id",
                table: "student_service_assignments",
                column: "route_id");

            migrationBuilder.CreateIndex(
                name: "IX_student_service_assignments_stop_id",
                table: "student_service_assignments",
                column: "stop_id");

            migrationBuilder.CreateIndex(
                name: "IX_student_service_assignments_student_id_route_id_is_active",
                table: "student_service_assignments",
                columns: new[] { "student_id", "route_id", "is_active" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "service_absence_requests");

            migrationBuilder.DropTable(
                name: "service_attendances");

            migrationBuilder.DropTable(
                name: "service_vehicle_locations");

            migrationBuilder.DropTable(
                name: "student_service_assignments");

            migrationBuilder.DropTable(
                name: "service_trips");

            migrationBuilder.DropTable(
                name: "service_route_stops");

            migrationBuilder.DropTable(
                name: "service_routes");

            migrationBuilder.DropTable(
                name: "service_drivers");

            migrationBuilder.DropTable(
                name: "service_vehicles");
        }
    }
}
