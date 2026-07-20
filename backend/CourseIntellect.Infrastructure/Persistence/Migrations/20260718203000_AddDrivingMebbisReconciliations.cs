using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingMebbisReconciliations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "driving_mebbis_reconciliations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentGroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SourceSessionsJson = table.Column<string>(type: "jsonb", nullable: false),
                    TotalRows = table.Column<int>(type: "integer", nullable: false),
                    MatchedRows = table.Column<int>(type: "integer", nullable: false),
                    CourseOnlyRows = table.Column<int>(type: "integer", nullable: false),
                    MebbisOnlyRows = table.Column<int>(type: "integer", nullable: false),
                    DifferentRows = table.Column<int>(type: "integer", nullable: false),
                    LicenseClassDifferenceRows = table.Column<int>(type: "integer", nullable: false),
                    TermDifferenceRows = table.Column<int>(type: "integer", nullable: false),
                    CertificateDifferenceRows = table.Column<int>(type: "integer", nullable: false),
                    ExamResultDifferenceRows = table.Column<int>(type: "integer", nullable: false),
                    StudentStatusDifferenceRows = table.Column<int>(type: "integer", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_mebbis_reconciliations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_mebbis_reconciliations_driving_student_groups_Stude~",
                        column: x => x.StudentGroupId,
                        principalTable: "driving_student_groups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_driving_mebbis_reconciliations_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "driving_mebbis_reconciliation_rows",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    ReconciliationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Classification = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MaskedIdentity = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    StudentDrivingProfileId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceImportRowId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceRowNumber = table.Column<int>(type: "integer", nullable: true),
                    DifferenceCodesJson = table.Column<string>(type: "jsonb", nullable: false),
                    CourseSnapshotJson = table.Column<string>(type: "jsonb", nullable: false),
                    MebbisSnapshotJson = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_mebbis_reconciliation_rows", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_mebbis_reconciliation_rows_driving_mebbis_import_ro~",
                        column: x => x.SourceImportRowId,
                        principalTable: "driving_mebbis_import_rows",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_driving_mebbis_reconciliation_rows_driving_mebbis_reconcili~",
                        column: x => x.ReconciliationId,
                        principalTable: "driving_mebbis_reconciliations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_driving_mebbis_reconciliation_rows_student_driving_profiles~",
                        column: x => x.StudentDrivingProfileId,
                        principalTable: "student_driving_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_driving_mebbis_reconciliation_rows_tenant_workspaces_tenant~",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_reconciliation_rows_ReconciliationId_Classif~",
                table: "driving_mebbis_reconciliation_rows",
                columns: new[] { "ReconciliationId", "Classification" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_reconciliation_rows_SourceImportRowId",
                table: "driving_mebbis_reconciliation_rows",
                column: "SourceImportRowId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_reconciliation_rows_StudentDrivingProfileId",
                table: "driving_mebbis_reconciliation_rows",
                column: "StudentDrivingProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_reconciliation_rows_tenant_id",
                table: "driving_mebbis_reconciliation_rows",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_reconciliations_StudentGroupId",
                table: "driving_mebbis_reconciliations",
                column: "StudentGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_reconciliations_tenant_id",
                table: "driving_mebbis_reconciliations",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_reconciliations_tenant_id_StudentGroupId_Cre~",
                table: "driving_mebbis_reconciliations",
                columns: new[] { "tenant_id", "StudentGroupId", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "driving_mebbis_reconciliation_rows");

            migrationBuilder.DropTable(
                name: "driving_mebbis_reconciliations");
        }
    }
}
