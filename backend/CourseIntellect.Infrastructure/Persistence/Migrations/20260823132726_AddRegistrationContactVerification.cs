using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRegistrationContactVerification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "verification_expires_at_utc",
                table: "tenant_registration_applications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "verification_sent_at_utc",
                table: "tenant_registration_applications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "verification_token_hash",
                table: "tenant_registration_applications",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "verified_at_utc",
                table: "tenant_registration_applications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_tenant_registration_applications_verification_token_hash",
                table: "tenant_registration_applications",
                column: "verification_token_hash");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_tenant_registration_applications_verification_token_hash",
                table: "tenant_registration_applications");

            migrationBuilder.DropColumn(
                name: "verification_expires_at_utc",
                table: "tenant_registration_applications");

            migrationBuilder.DropColumn(
                name: "verification_sent_at_utc",
                table: "tenant_registration_applications");

            migrationBuilder.DropColumn(
                name: "verification_token_hash",
                table: "tenant_registration_applications");

            migrationBuilder.DropColumn(
                name: "verified_at_utc",
                table: "tenant_registration_applications");
        }
    }
}
