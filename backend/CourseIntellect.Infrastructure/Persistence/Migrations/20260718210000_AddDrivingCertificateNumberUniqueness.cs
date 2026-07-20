using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260718210000_AddDrivingCertificateNumberUniqueness")]
public sealed class AddDrivingCertificateNumberUniqueness : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("UPDATE driving_certificates SET \"MebbisCertificateNo\" = upper(trim(\"MebbisCertificateNo\")) WHERE \"MebbisCertificateNo\" <> ''; ");
        migrationBuilder.CreateIndex(
            name: "IX_driving_certificates_tenant_id_MebbisCertificateNo",
            table: "driving_certificates",
            columns: new[] { "tenant_id", "MebbisCertificateNo" },
            unique: true,
            filter: "\"MebbisCertificateNo\" <> ''");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_driving_certificates_tenant_id_MebbisCertificateNo",
            table: "driving_certificates");
    }
}
