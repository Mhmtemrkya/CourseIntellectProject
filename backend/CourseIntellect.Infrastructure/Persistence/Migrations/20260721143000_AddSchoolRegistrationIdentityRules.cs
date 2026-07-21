using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
namespace CourseIntellect.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260721143000_AddSchoolRegistrationIdentityRules")]
public sealed class AddSchoolRegistrationIdentityRules : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "TcNo",
            table: "users",
            type: "character varying(11)",
            maxLength: 11,
            nullable: false,
            defaultValue: "");

        migrationBuilder.AddColumn<string>(
            name: "PhotoUrl",
            table: "users",
            type: "character varying(400)",
            maxLength: 400,
            nullable: false,
            defaultValue: "");

        migrationBuilder.AddColumn<string>(
            name: "PhotoUrl",
            table: "staff_profiles",
            type: "character varying(400)",
            maxLength: 400,
            nullable: false,
            defaultValue: "");

        migrationBuilder.Sql("""
            UPDATE users AS u
            SET "TcNo" = s."TcNo", "PhotoUrl" = s."PhotoUrl"
            FROM student_profiles AS s
            WHERE s."UserId" = u."Id";

            UPDATE users AS u
            SET "TcNo" = p."TcNo", "PhotoUrl" = p."PhotoUrl"
            FROM staff_profiles AS p
            WHERE p."UserId" = u."Id" AND u."TcNo" = '';

            WITH duplicate_tc AS (
                SELECT "Id", ROW_NUMBER() OVER (PARTITION BY tenant_id, "TcNo" ORDER BY "CreatedAtUtc", "Id") AS rn
                FROM users
                WHERE tenant_id IS NOT NULL AND "TcNo" <> ''
            )
            UPDATE users AS u SET "TcNo" = ''
            FROM duplicate_tc AS d
            WHERE u."Id" = d."Id" AND d.rn > 1;

            UPDATE student_profiles AS s
            SET "TcNo" = u."TcNo"
            FROM users AS u
            WHERE s."UserId" = u."Id";

            UPDATE staff_profiles AS p
            SET "TcNo" = u."TcNo"
            FROM users AS u
            WHERE p."UserId" = u."Id";

            WITH tenant_max AS (
                SELECT tenant_id,
                       GREATEST(COALESCE(MAX(CASE WHEN "SchoolNumber" ~ '^[0-9]+$' THEN "SchoolNumber"::bigint END), 1000), 1000) AS max_no
                FROM student_profiles
                WHERE tenant_id IS NOT NULL
                GROUP BY tenant_id
            ), ranked AS (
                SELECT "Id", tenant_id, "SchoolNumber",
                       ROW_NUMBER() OVER (PARTITION BY tenant_id, "SchoolNumber" ORDER BY "CreatedAtUtc", "Id") AS duplicate_rank
                FROM student_profiles
                WHERE tenant_id IS NOT NULL
            ), needs_number AS (
                SELECT r."Id", r.tenant_id,
                       ROW_NUMBER() OVER (PARTITION BY r.tenant_id ORDER BY r."Id") AS offset_no
                FROM ranked AS r
                WHERE r."SchoolNumber" !~ '^[0-9]+$' OR r.duplicate_rank > 1
            )
            UPDATE student_profiles AS s
            SET "SchoolNumber" = (m.max_no + n.offset_no)::text
            FROM needs_number AS n
            JOIN tenant_max AS m ON m.tenant_id = n.tenant_id
            WHERE s."Id" = n."Id";
            """);

        migrationBuilder.CreateIndex(
            name: "IX_users_tenant_id_TcNo",
            table: "users",
            columns: new[] { "tenant_id", "TcNo" },
            unique: true,
            filter: "\"TcNo\" <> '' AND tenant_id IS NOT NULL");

        migrationBuilder.CreateIndex(
            name: "IX_student_profiles_tenant_id_SchoolNumber",
            table: "student_profiles",
            columns: new[] { "tenant_id", "SchoolNumber" },
            unique: true,
            filter: "\"SchoolNumber\" <> '' AND tenant_id IS NOT NULL");

        migrationBuilder.CreateIndex(
            name: "IX_student_profiles_tenant_id_TcNo",
            table: "student_profiles",
            columns: new[] { "tenant_id", "TcNo" },
            unique: true,
            filter: "\"TcNo\" <> '' AND tenant_id IS NOT NULL");

        migrationBuilder.CreateIndex(
            name: "IX_staff_profiles_tenant_id_TcNo",
            table: "staff_profiles",
            columns: new[] { "tenant_id", "TcNo" },
            unique: true,
            filter: "\"TcNo\" <> '' AND tenant_id IS NOT NULL");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex("IX_users_tenant_id_TcNo", "users");
        migrationBuilder.DropIndex("IX_student_profiles_tenant_id_SchoolNumber", "student_profiles");
        migrationBuilder.DropIndex("IX_student_profiles_tenant_id_TcNo", "student_profiles");
        migrationBuilder.DropIndex("IX_staff_profiles_tenant_id_TcNo", "staff_profiles");
        migrationBuilder.DropColumn("TcNo", "users");
        migrationBuilder.DropColumn("PhotoUrl", "users");
        migrationBuilder.DropColumn("PhotoUrl", "staff_profiles");
    }
}
