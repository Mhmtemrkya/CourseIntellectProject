using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInstitutionRegistrationDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "address_line",
                table: "tenant_workspaces",
                type: "character varying(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "city",
                table: "tenant_workspaces",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "contact_title",
                table: "tenant_workspaces",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "district",
                table: "tenant_workspaces",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "institution_email",
                table: "tenant_workspaces",
                type: "character varying(180)",
                maxLength: 180,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "institution_phone",
                table: "tenant_workspaces",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "meb_code",
                table: "tenant_workspaces",
                type: "character varying(8)",
                maxLength: 8,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "postal_code",
                table: "tenant_workspaces",
                type: "character varying(5)",
                maxLength: 5,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "tax_number",
                table: "tenant_workspaces",
                type: "character varying(11)",
                maxLength: 11,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "tax_office",
                table: "tenant_workspaces",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "website",
                table: "tenant_workspaces",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "address_line",
                table: "tenant_registration_applications",
                type: "character varying(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "city",
                table: "tenant_registration_applications",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "contact_title",
                table: "tenant_registration_applications",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "district",
                table: "tenant_registration_applications",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "institution_email",
                table: "tenant_registration_applications",
                type: "character varying(180)",
                maxLength: 180,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "institution_phone",
                table: "tenant_registration_applications",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "meb_code",
                table: "tenant_registration_applications",
                type: "character varying(8)",
                maxLength: 8,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "postal_code",
                table: "tenant_registration_applications",
                type: "character varying(5)",
                maxLength: 5,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "tax_number",
                table: "tenant_registration_applications",
                type: "character varying(11)",
                maxLength: 11,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "tax_office",
                table: "tenant_registration_applications",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "website",
                table: "tenant_registration_applications",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "address_line",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "city",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "contact_title",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "district",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "institution_email",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "institution_phone",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "meb_code",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "postal_code",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "tax_number",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "tax_office",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "website",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "address_line",
                table: "tenant_registration_applications");

            migrationBuilder.DropColumn(
                name: "city",
                table: "tenant_registration_applications");

            migrationBuilder.DropColumn(
                name: "contact_title",
                table: "tenant_registration_applications");

            migrationBuilder.DropColumn(
                name: "district",
                table: "tenant_registration_applications");

            migrationBuilder.DropColumn(
                name: "institution_email",
                table: "tenant_registration_applications");

            migrationBuilder.DropColumn(
                name: "institution_phone",
                table: "tenant_registration_applications");

            migrationBuilder.DropColumn(
                name: "meb_code",
                table: "tenant_registration_applications");

            migrationBuilder.DropColumn(
                name: "postal_code",
                table: "tenant_registration_applications");

            migrationBuilder.DropColumn(
                name: "tax_number",
                table: "tenant_registration_applications");

            migrationBuilder.DropColumn(
                name: "tax_office",
                table: "tenant_registration_applications");

            migrationBuilder.DropColumn(
                name: "website",
                table: "tenant_registration_applications");
        }
    }
}
