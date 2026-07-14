using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260714120000_AddDrivingSchoolInstitutionType")]
public sealed class AddDrivingSchoolInstitutionType : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "institution_type",
            table: "tenant_workspaces",
            type: "character varying(40)",
            maxLength: 40,
            nullable: false,
            defaultValue: "PrivateSchool");

        migrationBuilder.AddColumn<bool>(
            name: "driving_school_module_enabled",
            table: "tenant_workspaces",
            type: "boolean",
            nullable: false,
            defaultValue: false);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "institution_type", table: "tenant_workspaces");
        migrationBuilder.DropColumn(name: "driving_school_module_enabled", table: "tenant_workspaces");
    }
}
