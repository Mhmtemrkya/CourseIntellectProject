using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations;

/// <summary>
/// Direksiyon randevusuna şube damgası. Araç filosu şubeler arasında ortak
/// olduğu için randevu şubeye KİLİTLENMEZ (query filter'a girmez); bu kolon
/// yalnızca "slotu hangi şube kullanıyor" bilgisini taşır — tek takvimde
/// gösterim, şube filtresi ve gider/kullanım dağıtımı için.
/// </summary>
[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260728143000_AddDrivingAppointmentBranch")]
public sealed class AddDrivingAppointmentBranch : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "branch_id",
            table: "driving_appointments",
            type: "uuid",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_driving_appointments_branch_id_StartsAtUtc",
            table: "driving_appointments",
            columns: ["branch_id", "StartsAtUtc"]);

        migrationBuilder.AddForeignKey(
            name: "FK_driving_appointments_org_units_branch_id",
            table: "driving_appointments",
            column: "branch_id",
            principalTable: "org_units",
            principalColumn: "Id",
            onDelete: ReferentialAction.SetNull);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "FK_driving_appointments_org_units_branch_id",
            table: "driving_appointments");
        migrationBuilder.DropIndex(
            name: "IX_driving_appointments_branch_id_StartsAtUtc",
            table: "driving_appointments");
        migrationBuilder.DropColumn(name: "branch_id", table: "driving_appointments");
    }
}
