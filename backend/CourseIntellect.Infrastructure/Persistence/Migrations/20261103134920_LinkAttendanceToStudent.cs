using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LinkAttendanceToStudent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "student_id",
                table: "attendance_entries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_attendance_entries_tenant_id_student_id",
                table: "attendance_entries",
                columns: new[] { "tenant_id", "student_id" });

            // Mevcut kayıtları yalnız TEK anlamlı eşleşmede bağla: önce aynı kurum +
            // ad + sınıf, kalanlarda aynı kurum + ad. Aynı adlı birden çok öğrenci
            // varsa kayıt null kalır ve eskisi gibi adla eşleşir (tahmin edilmez).
            foreach (var classClause in new[] { "AND lower(btrim(s.\"ClassName\")) = lower(btrim(a.class_name))", string.Empty })
            {
                migrationBuilder.Sql($"""
                    WITH matches AS (
                        SELECT a.id AS entry_id, MIN(s."Id"::text) AS student_id, COUNT(*) AS candidates
                        FROM attendance_entries a
                        JOIN student_profiles s
                          ON s.tenant_id IS NOT DISTINCT FROM a.tenant_id
                         AND lower(btrim(s."FullName")) = lower(btrim(a.student_name))
                         {classClause}
                        WHERE a.student_id IS NULL
                        GROUP BY a.id
                    )
                    UPDATE attendance_entries a
                    SET student_id = m.student_id::uuid
                    FROM matches m
                    WHERE a.id = m.entry_id AND m.candidates = 1;
                    """);
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_attendance_entries_tenant_id_student_id",
                table: "attendance_entries");

            migrationBuilder.DropColumn(
                name: "student_id",
                table: "attendance_entries");
        }
    }
}
