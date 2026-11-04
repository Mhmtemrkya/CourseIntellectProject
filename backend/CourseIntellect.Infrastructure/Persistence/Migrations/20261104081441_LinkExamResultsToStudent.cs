using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LinkExamResultsToStudent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "StudentId",
                table: "exam_results",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_exam_results_tenant_id_StudentId",
                table: "exam_results",
                columns: new[] { "tenant_id", "StudentId" });

            // Mevcut sonuçları yalnız TEK anlamlı eşleşmede bağla: önce aynı kurum +
            // ad + sınıf, kalanlarda aynı kurum + ad. Aynı adlı birden çok öğrenci
            // varsa kayıt null kalır ve eskisi gibi adla eşleşir (tahmin edilmez).
            foreach (var classClause in new[] { "AND lower(btrim(s.\"ClassName\")) = lower(btrim(r.\"ClassName\"))", string.Empty })
            {
                migrationBuilder.Sql($"""
                    WITH matches AS (
                        SELECT r."Id" AS result_id, MIN(s."Id"::text) AS student_id, COUNT(*) AS candidates
                        FROM exam_results r
                        JOIN student_profiles s
                          ON s.tenant_id IS NOT DISTINCT FROM r.tenant_id
                         AND lower(btrim(s."FullName")) = lower(btrim(r."StudentName"))
                         {classClause}
                        WHERE r."StudentId" IS NULL
                        GROUP BY r."Id"
                    )
                    UPDATE exam_results r
                    SET "StudentId" = m.student_id::uuid
                    FROM matches m
                    WHERE r."Id" = m.result_id AND m.candidates = 1;
                    """);
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_exam_results_tenant_id_StudentId",
                table: "exam_results");

            migrationBuilder.DropColumn(
                name: "StudentId",
                table: "exam_results");
        }
    }
}
