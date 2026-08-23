using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantRegistrationApplications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "tenant_registration_applications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    institution_name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    contact_name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    contact_email = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    contact_email_normalized = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    contact_phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    plan = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    institution_type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    estimated_students = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    registration_ip = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    registration_user_agent = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    registration_referer = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    kvkk_consent_version = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    kvkk_consent_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    approved_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    rejected_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    rejection_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_tenant_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenant_registration_applications", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_tenant_registration_applications_contact_email_normalized",
                table: "tenant_registration_applications",
                column: "contact_email_normalized",
                unique: true,
                filter: "status = 'pending'");

            migrationBuilder.CreateIndex(
                name: "IX_tenant_registration_applications_status_created_at_utc",
                table: "tenant_registration_applications",
                columns: new[] { "status", "created_at_utc" });

            // --- Mevcut bekleyen/reddedilmiş başvuruları yeni tabloya taşı ---
            //
            // Yalnız GERÇEKTEN başvuru olan satırlar taşınır: yönetici hesabı olmayan,
            // altında kullanıcı ve abonelik faturası bulunmayanlar. Yarı hazırlanmış bir
            // kurum satırı varsa hiç dokunulmaz — deploy sırasında yarım kalan bir
            // taşımaktansa elde birkaç artık satır kalması yeğdir.
            //
            // Eski kodda tekilleştirme olmadığı için bekleyen satırlarda aynı e-posta
            // birden çok kez olabilir; filtreli benzersiz indeks bunu reddederdi. En
            // yenisi "pending" kalır, eskiler "rejected" olur ve temizlik görevi 30 gün
            // sonra siler.
            //
            // NOT: Down() tabloyu düşürür; taşınan satırlar geri gelmez.
            migrationBuilder.Sql("""
                INSERT INTO tenant_registration_applications (
                    id, institution_name, contact_name, contact_email, contact_email_normalized,
                    contact_phone, plan, institution_type, estimated_students, status,
                    registration_ip, registration_user_agent, registration_referer,
                    kvkk_consent_version, kvkk_consent_at_utc, created_at_utc, rejected_at_utc)
                SELECT
                    src.id,
                    src.name,
                    src."ContactName",
                    src.contact_email,
                    lower(src.contact_email),
                    src."ContactPhone",
                    src.plan,
                    src.institution_type,
                    COALESCE(src.registration_estimated_students, src.student_count, 0),
                    CASE WHEN src.status = 'pending' AND src.rn > 1 THEN 'rejected' ELSE src.status END,
                    src.registration_ip,
                    src.registration_user_agent,
                    src.registration_referer,
                    src.kvkk_consent_version,
                    src.kvkk_consent_at_utc,
                    src.created_at_utc,
                    CASE WHEN src.status = 'pending' AND src.rn > 1 THEN now() ELSE src.rejected_at_utc END
                FROM (
                    SELECT
                        tw.*,
                        ROW_NUMBER() OVER (
                            PARTITION BY lower(tw.contact_email), tw.status
                            ORDER BY tw.created_at_utc DESC) AS rn
                    FROM tenant_workspaces tw
                    WHERE tw.status IN ('pending', 'rejected')
                      AND tw."AdminUserId" IS NULL
                      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = tw.id)
                      AND NOT EXISTS (SELECT 1 FROM platform_subscription_invoices i WHERE i.tenant_id = tw.id)
                ) src;
                """);

            migrationBuilder.Sql("""
                DELETE FROM tenant_workspaces tw
                WHERE tw.status IN ('pending', 'rejected')
                  AND tw."AdminUserId" IS NULL
                  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = tw.id)
                  AND NOT EXISTS (SELECT 1 FROM platform_subscription_invoices i WHERE i.tenant_id = tw.id);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "tenant_registration_applications");
        }
    }
}
