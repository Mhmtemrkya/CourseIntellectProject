using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPlatformAdminMfa : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AdminMfaRecoveryHashesSerialized",
                table: "users",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<long>(
                name: "AdminMfaVersion",
                table: "users",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

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
                name: "PlatformAccessEmail",
                table: "users",
                type: "character varying(254)",
                maxLength: 254,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AdminMfaVerifiedAtUtc",
                table: "refresh_token_sessions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "admin_mfa_challenges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    AccessEmail = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    SecurityVersion = table.Column<long>(type: "bigint", nullable: false),
                    SetupSecretProtected = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    ConsumedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_admin_mfa_challenges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_admin_mfa_challenges_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_admin_mfa_challenges_ExpiresAtUtc",
                table: "admin_mfa_challenges",
                column: "ExpiresAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_admin_mfa_challenges_TokenHash",
                table: "admin_mfa_challenges",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_admin_mfa_challenges_UserId",
                table: "admin_mfa_challenges",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "admin_mfa_challenges");

            migrationBuilder.DropColumn(
                name: "AdminMfaRecoveryHashesSerialized",
                table: "users");

            migrationBuilder.DropColumn(
                name: "AdminMfaVersion",
                table: "users");

            migrationBuilder.DropColumn(
                name: "AdminTotpLastStep",
                table: "users");

            migrationBuilder.DropColumn(
                name: "AdminTotpSecretProtected",
                table: "users");

            migrationBuilder.DropColumn(
                name: "PlatformAccessEmail",
                table: "users");

            migrationBuilder.DropColumn(
                name: "AdminMfaVerifiedAtUtc",
                table: "refresh_token_sessions");
        }
    }
}
