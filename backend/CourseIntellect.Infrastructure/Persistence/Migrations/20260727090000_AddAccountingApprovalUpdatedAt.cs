using System;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations;

/// <summary>
/// Onay kayıtlarına zaman damgası ekler. Finans Audit Log'da onay satırları
/// zamansız olduğu için "Zaman yok" görünüyordu. Sütun nullable'dır: mevcut
/// satırlar boş kalır, yeni ve güncellenen kayıtlar tarih taşır.
/// </summary>
[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260727090000_AddAccountingApprovalUpdatedAt")]
public sealed class AddAccountingApprovalUpdatedAt : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTime>(
            name: "UpdatedAtUtc",
            table: "accounting_approvals",
            type: "timestamp with time zone",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "UpdatedAtUtc",
            table: "accounting_approvals");
    }
}
