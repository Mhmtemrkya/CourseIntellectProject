using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingMebbisTransferPackages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "driving_mebbis_transfer_packages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    PackageType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    StudentGroupId = table.Column<Guid>(type: "uuid", nullable: true),
                    TermYear = table.Column<int>(type: "integer", nullable: true),
                    TermNumber = table.Column<int>(type: "integer", nullable: true),
                    MebbisTermCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    FileVersion = table.Column<int>(type: "integer", nullable: false),
                    RowCount = table.Column<int>(type: "integer", nullable: false),
                    StudentCount = table.Column<int>(type: "integer", nullable: false),
                    FileName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    FileUrl = table.Column<string>(type: "character varying(700)", maxLength: 700, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    Sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ErrorResult = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    StatusVersion = table.Column<int>(type: "integer", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TransferredAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_mebbis_transfer_packages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_mebbis_transfer_packages_driving_student_groups_Stu~",
                        column: x => x.StudentGroupId,
                        principalTable: "driving_student_groups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_driving_mebbis_transfer_packages_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_transfer_packages_StudentGroupId",
                table: "driving_mebbis_transfer_packages",
                column: "StudentGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_transfer_packages_tenant_id",
                table: "driving_mebbis_transfer_packages",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_transfer_packages_tenant_id_CreatedAtUtc",
                table: "driving_mebbis_transfer_packages",
                columns: new[] { "tenant_id", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_transfer_packages_tenant_id_PackageType_Stud~",
                table: "driving_mebbis_transfer_packages",
                columns: new[] { "tenant_id", "PackageType", "StudentGroupId", "FileVersion" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "driving_mebbis_transfer_packages");

        }
    }
}
