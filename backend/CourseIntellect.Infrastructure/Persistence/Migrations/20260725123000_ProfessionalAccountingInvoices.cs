using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260725123000_ProfessionalAccountingInvoices")]
public sealed class ProfessionalAccountingInvoices : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "InvoiceNumber",
            table: "accounting_invoices",
            type: "character varying(60)",
            maxLength: 60,
            nullable: false,
            defaultValue: "");

        migrationBuilder.AddColumn<string>(
            name: "Counterparty",
            table: "accounting_invoices",
            type: "character varying(180)",
            maxLength: 180,
            nullable: false,
            defaultValue: "");

        migrationBuilder.AddColumn<DateTime>(
            name: "IssueDateUtc",
            table: "accounting_invoices",
            type: "timestamp with time zone",
            nullable: false,
            defaultValue: DateTime.UnixEpoch);

        migrationBuilder.AddColumn<DateTime>(
            name: "DueDateUtc",
            table: "accounting_invoices",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "PaidAtUtc",
            table: "accounting_invoices",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "PaymentMethod",
            table: "accounting_invoices",
            type: "character varying(60)",
            maxLength: 60,
            nullable: false,
            defaultValue: "");

        migrationBuilder.AddColumn<string>(
            name: "Note",
            table: "accounting_invoices",
            type: "character varying(1000)",
            maxLength: 1000,
            nullable: false,
            defaultValue: "");

        migrationBuilder.Sql(
            """
            UPDATE accounting_invoices
            SET "InvoiceNumber" = 'LEGACY-' || LEFT(REPLACE("Id"::text, '-', ''), 12),
                "Counterparty" = "Title",
                "IssueDateUtc" = "CreatedAtUtc",
                "Note" = "Subtitle",
                "Status" = CASE
                    WHEN LOWER("Status") IN ('ödendi', 'odendi', 'paid', 'onaylandı', 'onaylandi') THEN 'Ödendi'
                    ELSE 'Ödenmedi'
                END;
            """);

        migrationBuilder.CreateIndex(
            name: "IX_accounting_invoices_tenant_id_InvoiceNumber",
            table: "accounting_invoices",
            columns: new[] { "tenant_id", "InvoiceNumber" },
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_accounting_invoices_tenant_id_InvoiceNumber",
            table: "accounting_invoices");

        migrationBuilder.DropColumn(name: "InvoiceNumber", table: "accounting_invoices");
        migrationBuilder.DropColumn(name: "Counterparty", table: "accounting_invoices");
        migrationBuilder.DropColumn(name: "IssueDateUtc", table: "accounting_invoices");
        migrationBuilder.DropColumn(name: "DueDateUtc", table: "accounting_invoices");
        migrationBuilder.DropColumn(name: "PaidAtUtc", table: "accounting_invoices");
        migrationBuilder.DropColumn(name: "PaymentMethod", table: "accounting_invoices");
        migrationBuilder.DropColumn(name: "Note", table: "accounting_invoices");
    }
}
