using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LinkStudyPlansToStudent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_study_plan_states_tenant_id_StudentName",
                table: "study_plan_states");

            migrationBuilder.AddColumn<Guid>(
                name: "StudentUserId",
                table: "study_plan_states",
                type: "uuid",
                nullable: true);

            // Eski (ada göre tutulmuş) planlar: ad kurumda TEK bir kullanıcıya aitse o kullanıcıya bağlanır.
            // Aynı adı taşıyan birden çok kullanıcı varsa plan bağlanmaz (kime ait olduğu bilinemez); bu kişiler
            // bir sonraki girişte kendi kimlikleriyle yeni ve ayrı bir plan alır.
            migrationBuilder.Sql("""
                UPDATE study_plan_states s
                SET "StudentUserId" = u."Id"
                FROM users u
                WHERE s."StudentUserId" IS NULL
                  AND u.tenant_id = s.tenant_id
                  AND u.deleted_at_utc IS NULL
                  AND btrim(u."FullName") = btrim(s."StudentName")
                  AND (SELECT count(*) FROM users x
                       WHERE x.tenant_id = s.tenant_id AND x.deleted_at_utc IS NULL
                         AND btrim(x."FullName") = btrim(s."StudentName")) = 1;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_study_plan_states_tenant_id_StudentName",
                table: "study_plan_states",
                columns: new[] { "tenant_id", "StudentName" });

            migrationBuilder.CreateIndex(
                name: "IX_study_plan_states_tenant_id_StudentUserId",
                table: "study_plan_states",
                columns: new[] { "tenant_id", "StudentUserId" },
                unique: true,
                filter: "\"StudentUserId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_study_plan_states_tenant_id_StudentName",
                table: "study_plan_states");

            migrationBuilder.DropIndex(
                name: "IX_study_plan_states_tenant_id_StudentUserId",
                table: "study_plan_states");

            migrationBuilder.DropColumn(
                name: "StudentUserId",
                table: "study_plan_states");

            migrationBuilder.CreateIndex(
                name: "IX_study_plan_states_tenant_id_StudentName",
                table: "study_plan_states",
                columns: new[] { "tenant_id", "StudentName" },
                unique: true);
        }
    }
}
