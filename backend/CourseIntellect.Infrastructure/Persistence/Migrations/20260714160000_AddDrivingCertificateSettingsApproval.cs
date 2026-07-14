using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingCertificateSettingsApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CertificateSettingsApprovedAtUtc",
                table: "driving_school_settings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CertificateSettingsApprovedByUserId",
                table: "driving_school_settings",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CertificateSettingsApprovedRevision",
                table: "driving_school_settings",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CertificateSettingsRevision",
                table: "driving_school_settings",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CertificateSettingsApprovedAtUtc",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "CertificateSettingsApprovedByUserId",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "CertificateSettingsApprovedRevision",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "CertificateSettingsRevision",
                table: "driving_school_settings");
        }
    }
}
