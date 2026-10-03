using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceAdminTotpWithEmailCode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_admin_mfa_challenges_UserId",
                table: "admin_mfa_challenges");

            migrationBuilder.DropColumn(
                name: "AdminMfaRecoveryHashesSerialized",
                table: "users");

            migrationBuilder.DropColumn(
                name: "AdminTotpLastStep",
                table: "users");

            migrationBuilder.DropColumn(
                name: "AdminTotpSecretProtected",
                table: "users");

            migrationBuilder.DropColumn(
                name: "SetupSecretProtected",
                table: "admin_mfa_challenges");

            migrationBuilder.AddColumn<string>(
                name: "AdminVerificationMethod",
                table: "refresh_token_sessions",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CodeHash",
                table: "admin_mfa_challenges",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAtUtc",
                table: "admin_mfa_challenges",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "DeliveredAtUtc",
                table: "admin_mfa_challenges",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_admin_mfa_challenges_UserId_CreatedAtUtc",
                table: "admin_mfa_challenges",
                columns: new[] { "UserId", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_admin_mfa_challenges_UserId_CreatedAtUtc",
                table: "admin_mfa_challenges");

            migrationBuilder.DropColumn(
                name: "AdminVerificationMethod",
                table: "refresh_token_sessions");

            migrationBuilder.DropColumn(
                name: "CodeHash",
                table: "admin_mfa_challenges");

            migrationBuilder.DropColumn(
                name: "CreatedAtUtc",
                table: "admin_mfa_challenges");

            migrationBuilder.DropColumn(
                name: "DeliveredAtUtc",
                table: "admin_mfa_challenges");

            migrationBuilder.AddColumn<string>(
                name: "AdminMfaRecoveryHashesSerialized",
                table: "users",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<long>(
                name: "AdminTotpLastStep",
                table: "users",
                type: "bigint",
                nullable: false,
                defaultValue: -1L);

            migrationBuilder.AddColumn<string>(
                name: "AdminTotpSecretProtected",
                table: "users",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SetupSecretProtected",
                table: "admin_mfa_challenges",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_admin_mfa_challenges_UserId",
                table: "admin_mfa_challenges",
                column: "UserId");
        }
    }
}
