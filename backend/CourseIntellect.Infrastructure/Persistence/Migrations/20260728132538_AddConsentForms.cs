using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddConsentForms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "consent_form_templates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Body = table.Column<string>(type: "text", nullable: false),
                    CheckItemsJson = table.Column<string>(type: "text", nullable: false),
                    RequiresSignature = table.Column<bool>(type: "boolean", nullable: false),
                    SignerRole = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_consent_form_templates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_consent_form_templates_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "consent_signature_stations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    StationKey = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    DeviceInfo = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    LastSeenAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_consent_signature_stations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_consent_signature_stations_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "consent_form_records",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ContextKind = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ContextKey = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    ContextRefId = table.Column<Guid>(type: "uuid", nullable: true),
                    ContextLabel = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Body = table.Column<string>(type: "text", nullable: false),
                    CheckItemsJson = table.Column<string>(type: "text", nullable: false),
                    RequiresSignature = table.Column<bool>(type: "boolean", nullable: false),
                    SignerRole = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StaffUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    StaffName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    StaffNotes = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    SessionToken = table.Column<Guid>(type: "uuid", nullable: true),
                    StationName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    StationKey = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    SessionExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CheckedItemsJson = table.Column<string>(type: "text", nullable: false),
                    SignatureImage = table.Column<string>(type: "text", nullable: false),
                    SignedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SignerName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    SignerRelation = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    SignerDevice = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    SignerIp = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_consent_form_records", x => x.Id);
                    table.ForeignKey(
                        name: "FK_consent_form_records_consent_form_templates_TemplateId",
                        column: x => x.TemplateId,
                        principalTable: "consent_form_templates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_consent_form_records_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "consent_form_requirements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    ContextKind = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ContextKey = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_consent_form_requirements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_consent_form_requirements_consent_form_templates_TemplateId",
                        column: x => x.TemplateId,
                        principalTable: "consent_form_templates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_consent_form_requirements_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_consent_form_records_branch_id",
                table: "consent_form_records",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_consent_form_records_SessionToken",
                table: "consent_form_records",
                column: "SessionToken");

            migrationBuilder.CreateIndex(
                name: "IX_consent_form_records_TemplateId",
                table: "consent_form_records",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_consent_form_records_tenant_id",
                table: "consent_form_records",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_consent_form_records_tenant_id_ContextKind_ContextRefId",
                table: "consent_form_records",
                columns: new[] { "tenant_id", "ContextKind", "ContextRefId" });

            migrationBuilder.CreateIndex(
                name: "IX_consent_form_records_tenant_id_Status_StationKey",
                table: "consent_form_records",
                columns: new[] { "tenant_id", "Status", "StationKey" });

            migrationBuilder.CreateIndex(
                name: "IX_consent_form_records_tenant_id_StudentProfileId",
                table: "consent_form_records",
                columns: new[] { "tenant_id", "StudentProfileId" });

            migrationBuilder.CreateIndex(
                name: "IX_consent_form_requirements_TemplateId",
                table: "consent_form_requirements",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_consent_form_requirements_tenant_id",
                table: "consent_form_requirements",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_consent_form_requirements_tenant_id_ContextKind_ContextKey",
                table: "consent_form_requirements",
                columns: new[] { "tenant_id", "ContextKind", "ContextKey" });

            migrationBuilder.CreateIndex(
                name: "IX_consent_form_requirements_tenant_id_TemplateId",
                table: "consent_form_requirements",
                columns: new[] { "tenant_id", "TemplateId" });

            migrationBuilder.CreateIndex(
                name: "IX_consent_form_templates_tenant_id",
                table: "consent_form_templates",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_consent_form_templates_tenant_id_IsDeleted_IsActive_SortOrd~",
                table: "consent_form_templates",
                columns: new[] { "tenant_id", "IsDeleted", "IsActive", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_consent_signature_stations_tenant_id",
                table: "consent_signature_stations",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_consent_signature_stations_tenant_id_StationKey",
                table: "consent_signature_stations",
                columns: new[] { "tenant_id", "StationKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "consent_form_records");

            migrationBuilder.DropTable(
                name: "consent_form_requirements");

            migrationBuilder.DropTable(
                name: "consent_signature_stations");

            migrationBuilder.DropTable(
                name: "consent_form_templates");
        }
    }
}
