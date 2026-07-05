using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "library_books",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Author = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Publisher = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Isbn = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Shelf = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    TotalCopies = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_library_books", x => x.Id);
                    table.ForeignKey(
                        name: "FK_library_books_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "library_loans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    BookId = table.Column<Guid>(type: "uuid", nullable: false),
                    BookTitle = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ClassName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    LoanedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DueAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReturnedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ExtensionCount = table.Column<int>(type: "integer", nullable: false),
                    IssuedBy = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    FineAmount = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_library_loans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_library_loans_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "library_recommendations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    BookId = table.Column<Guid>(type: "uuid", nullable: false),
                    BookTitle = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    TeacherName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ClassName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_library_recommendations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_library_recommendations_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "library_reservations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    BookId = table.Column<Guid>(type: "uuid", nullable: false),
                    BookTitle = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReadyAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_library_reservations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_library_reservations_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "library_settings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    LoanDays = table.Column<int>(type: "integer", nullable: false),
                    MaxActiveLoans = table.Column<int>(type: "integer", nullable: false),
                    MaxExtensions = table.Column<int>(type: "integer", nullable: false),
                    ExtensionDays = table.Column<int>(type: "integer", nullable: false),
                    FinePerDay = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_library_settings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_library_settings_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_library_books_Isbn",
                table: "library_books",
                column: "Isbn");

            migrationBuilder.CreateIndex(
                name: "IX_library_books_tenant_id",
                table: "library_books",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_library_books_Title",
                table: "library_books",
                column: "Title");

            migrationBuilder.CreateIndex(
                name: "IX_library_loans_BookId",
                table: "library_loans",
                column: "BookId");

            migrationBuilder.CreateIndex(
                name: "IX_library_loans_StudentName",
                table: "library_loans",
                column: "StudentName");

            migrationBuilder.CreateIndex(
                name: "IX_library_loans_tenant_id",
                table: "library_loans",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_library_recommendations_tenant_id",
                table: "library_recommendations",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_library_reservations_BookId",
                table: "library_reservations",
                column: "BookId");

            migrationBuilder.CreateIndex(
                name: "IX_library_reservations_tenant_id",
                table: "library_reservations",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_library_settings_tenant_id",
                table: "library_settings",
                column: "tenant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "library_books");

            migrationBuilder.DropTable(
                name: "library_loans");

            migrationBuilder.DropTable(
                name: "library_recommendations");

            migrationBuilder.DropTable(
                name: "library_reservations");

            migrationBuilder.DropTable(
                name: "library_settings");
        }
    }
}
