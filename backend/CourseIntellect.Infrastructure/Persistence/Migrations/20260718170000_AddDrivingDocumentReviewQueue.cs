using System;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260718170000_AddDrivingDocumentReviewQueue")]
public sealed class AddDrivingDocumentReviewQueue : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "ReviewNote", table: "student_driving_documents", type: "character varying(1000)", maxLength: 1000, nullable: false, defaultValue: "");
        migrationBuilder.AddColumn<int>(name: "ReviewVersion", table: "student_driving_documents", type: "integer", nullable: false, defaultValue: 0);
        migrationBuilder.AddColumn<DateTime>(name: "ReuploadRequestedAtUtc", table: "student_driving_documents", type: "timestamp with time zone", nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "ReviewNote", table: "student_driving_documents");
        migrationBuilder.DropColumn(name: "ReviewVersion", table: "student_driving_documents");
        migrationBuilder.DropColumn(name: "ReuploadRequestedAtUtc", table: "student_driving_documents");
    }
}
