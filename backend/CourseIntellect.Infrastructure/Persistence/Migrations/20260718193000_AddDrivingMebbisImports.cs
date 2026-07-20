using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingMebbisImports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "driving_mebbis_import_sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    ImportType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StudentGroupId = table.Column<Guid>(type: "uuid", nullable: true),
                    FileName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    FileUrl = table.Column<string>(type: "character varying(700)", maxLength: 700, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    Sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PreviewVersion = table.Column<int>(type: "integer", nullable: false),
                    TotalRows = table.Column<int>(type: "integer", nullable: false),
                    MatchedRows = table.Column<int>(type: "integer", nullable: false),
                    NotFoundRows = table.Column<int>(type: "integer", nullable: false),
                    ConflictRows = table.Column<int>(type: "integer", nullable: false),
                    ChangeRows = table.Column<int>(type: "integer", nullable: false),
                    NewRows = table.Column<int>(type: "integer", nullable: false),
                    InvalidRows = table.Column<int>(type: "integer", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AppliedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    AppliedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApplySummaryJson = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_mebbis_import_sessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_mebbis_import_sessions_driving_student_groups_Stude~",
                        column: x => x.StudentGroupId,
                        principalTable: "driving_student_groups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_driving_mebbis_import_sessions_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "driving_mebbis_import_rows",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    ImportSessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    RowNumber = table.Column<int>(type: "integer", nullable: false),
                    Classification = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MatchKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    MatchedStudentProfileId = table.Column<Guid>(type: "uuid", nullable: true),
                    MatchedEntityId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceJson = table.Column<string>(type: "jsonb", nullable: false),
                    ChangesJson = table.Column<string>(type: "jsonb", nullable: false),
                    MessagesJson = table.Column<string>(type: "jsonb", nullable: false),
                    SelectedForApply = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_mebbis_import_rows", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_mebbis_import_rows_driving_mebbis_import_sessions_I~",
                        column: x => x.ImportSessionId,
                        principalTable: "driving_mebbis_import_sessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_driving_mebbis_import_rows_student_driving_profiles_Matched~",
                        column: x => x.MatchedStudentProfileId,
                        principalTable: "student_driving_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_driving_mebbis_import_rows_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_import_rows_ImportSessionId_RowNumber",
                table: "driving_mebbis_import_rows",
                columns: new[] { "ImportSessionId", "RowNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_import_rows_MatchedStudentProfileId",
                table: "driving_mebbis_import_rows",
                column: "MatchedStudentProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_import_rows_tenant_id",
                table: "driving_mebbis_import_rows",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_import_sessions_StudentGroupId",
                table: "driving_mebbis_import_sessions",
                column: "StudentGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_import_sessions_tenant_id",
                table: "driving_mebbis_import_sessions",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_import_sessions_tenant_id_CreatedAtUtc",
                table: "driving_mebbis_import_sessions",
                columns: new[] { "tenant_id", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "driving_mebbis_import_rows");

            migrationBuilder.DropTable(
                name: "driving_mebbis_import_sessions");
        }
    }
}
