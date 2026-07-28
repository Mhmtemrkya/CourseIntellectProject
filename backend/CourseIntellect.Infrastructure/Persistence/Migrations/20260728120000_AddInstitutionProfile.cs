using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations;

/// <summary>
/// Kurum belge künyesi (ad, adres, iletişim, vergi bilgisi). Ekstre/makbuz gibi
/// çıktıların başlığı buradan üretilir; okul kurumlarında adres tutulacak bir
/// alan yoktu, bu tablo o boşluğu kapatır. Kurum başına tek satır.
/// </summary>
[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260728120000_AddInstitutionProfile")]
public sealed class AddInstitutionProfile : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "institution_profiles",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false, defaultValue: ""),
                Address = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false, defaultValue: ""),
                District = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false, defaultValue: ""),
                City = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false, defaultValue: ""),
                Phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValue: ""),
                Email = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false, defaultValue: ""),
                Website = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false, defaultValue: ""),
                TaxOffice = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false, defaultValue: ""),
                TaxNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValue: ""),
                DocumentFooterNote = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false, defaultValue: ""),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_institution_profiles", x => x.Id);
                table.ForeignKey(
                    name: "FK_institution_profiles_tenant_workspaces_tenant_id",
                    column: x => x.tenant_id,
                    principalTable: "tenant_workspaces",
                    principalColumn: "id",
                    onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateIndex(
            name: "IX_institution_profiles_tenant_id",
            table: "institution_profiles",
            column: "tenant_id",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "institution_profiles");
    }
}
