using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingAppointmentAutoCompletion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AttendanceConfirmed",
                table: "driving_appointments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "AttendanceMarkedAtUtc",
                table: "driving_appointments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AttendanceMarkedByUserId",
                table: "driving_appointments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AutoCompleted",
                table: "driving_appointments",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AttendanceConfirmed",
                table: "driving_appointments");

            migrationBuilder.DropColumn(
                name: "AttendanceMarkedAtUtc",
                table: "driving_appointments");

            migrationBuilder.DropColumn(
                name: "AttendanceMarkedByUserId",
                table: "driving_appointments");

            migrationBuilder.DropColumn(
                name: "AutoCompleted",
                table: "driving_appointments");
        }
    }
}
