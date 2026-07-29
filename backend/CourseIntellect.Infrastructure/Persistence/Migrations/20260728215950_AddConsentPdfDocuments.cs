using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddConsentPdfDocuments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DocumentId",
                table: "consent_form_templates",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceKind",
                table: "consent_form_templates",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                // Var olan satırlar metin kaynaklıdır; boş dize enum'a çevrilemez.
                defaultValue: "Text");

            migrationBuilder.AddColumn<Guid>(
                name: "DocumentId",
                table: "consent_form_records",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceKind",
                table: "consent_form_records",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                // Var olan satırlar metin kaynaklıdır; boş dize enum'a çevrilemez.
                defaultValue: "Text");

            migrationBuilder.CreateTable(
                name: "consent_documents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    FileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    Sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ByteSize = table.Column<int>(type: "integer", nullable: false),
                    PageCount = table.Column<int>(type: "integer", nullable: false),
                    Content = table.Column<byte[]>(type: "bytea", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_consent_documents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_consent_documents_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_consent_form_templates_DocumentId",
                table: "consent_form_templates",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_consent_form_records_DocumentId",
                table: "consent_form_records",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_consent_documents_tenant_id",
                table: "consent_documents",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_consent_documents_tenant_id_Sha256",
                table: "consent_documents",
                columns: new[] { "tenant_id", "Sha256" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_consent_form_records_consent_documents_DocumentId",
                table: "consent_form_records",
                column: "DocumentId",
                principalTable: "consent_documents",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_consent_form_templates_consent_documents_DocumentId",
                table: "consent_form_templates",
                column: "DocumentId",
                principalTable: "consent_documents",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_consent_form_records_consent_documents_DocumentId",
                table: "consent_form_records");

            migrationBuilder.DropForeignKey(
                name: "FK_consent_form_templates_consent_documents_DocumentId",
                table: "consent_form_templates");

            migrationBuilder.DropTable(
                name: "consent_documents");

            migrationBuilder.DropIndex(
                name: "IX_consent_form_templates_DocumentId",
                table: "consent_form_templates");

            migrationBuilder.DropIndex(
                name: "IX_consent_form_records_DocumentId",
                table: "consent_form_records");

            migrationBuilder.DropColumn(
                name: "DocumentId",
                table: "consent_form_templates");

            migrationBuilder.DropColumn(
                name: "SourceKind",
                table: "consent_form_templates");

            migrationBuilder.DropColumn(
                name: "DocumentId",
                table: "consent_form_records");

            migrationBuilder.DropColumn(
                name: "SourceKind",
                table: "consent_form_records");
        }
    }
}
