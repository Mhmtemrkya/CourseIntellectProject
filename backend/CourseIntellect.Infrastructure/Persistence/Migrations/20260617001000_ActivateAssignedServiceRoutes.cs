using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(CourseIntellectDbContext))]
    [Migration("20260617001000_ActivateAssignedServiceRoutes")]
    public partial class ActivateAssignedServiceRoutes : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE service_routes AS route
                SET is_active = TRUE,
                    updated_at = NOW()
                WHERE route.is_active = FALSE
                  AND EXISTS (
                      SELECT 1
                      FROM service_route_stops AS stop
                      WHERE stop.route_id = route.id
                  )
                  AND EXISTS (
                      SELECT 1
                      FROM student_service_assignments AS assignment
                      WHERE assignment.route_id = route.id
                        AND assignment.is_active = TRUE
                  )
                  AND EXISTS (
                      SELECT 1
                      FROM service_drivers AS driver
                      WHERE driver.id = route.driver_id
                        AND driver.is_active = TRUE
                  )
                  AND EXISTS (
                      SELECT 1
                      FROM service_vehicles AS vehicle
                      WHERE vehicle.id = route.vehicle_id
                        AND vehicle.is_active = TRUE
                  )
                  AND NOT EXISTS (
                      SELECT 1
                      FROM service_routes AS active_route
                      WHERE active_route.id <> route.id
                        AND active_route.is_active = TRUE
                        AND active_route.tenant_id IS NOT DISTINCT FROM route.tenant_id
                        AND active_route.start_time < route.end_time
                        AND route.start_time < active_route.end_time
                        AND (
                            active_route.driver_id = route.driver_id
                            OR active_route.vehicle_id = route.vehicle_id
                        )
                  );
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
