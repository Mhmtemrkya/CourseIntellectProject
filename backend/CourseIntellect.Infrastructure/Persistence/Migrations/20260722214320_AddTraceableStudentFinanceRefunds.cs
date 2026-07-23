using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTraceableStudentFinanceRefunds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EntryType",
                table: "finance_payments",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Collection");

            migrationBuilder.AddColumn<string>(
                name: "ExternalReference",
                table: "finance_payments",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "OriginalPaymentId",
                table: "finance_payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RefundChannel",
                table: "finance_payments",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "RefundReason",
                table: "finance_payments",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "RefundStatus",
                table: "finance_payments",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "RefundType",
                table: "finance_payments",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "DownPaymentPaidAmount",
                table: "enrollment_contracts",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.Sql("UPDATE finance_payments SET \"EntryType\" = CASE WHEN \"Amount\" < 0 OR \"Method\" = 'İade' THEN 'LegacyRefund' ELSE 'Collection' END");
            migrationBuilder.Sql("UPDATE enrollment_contracts SET \"DownPaymentPaidAmount\" = CASE WHEN \"DownPaymentPaid\" THEN \"DownPayment\" ELSE 0 END");

            migrationBuilder.CreateTable(
                name: "finance_payment_allocations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    FinancePaymentId = table.Column<Guid>(type: "uuid", nullable: false),
                    FinanceInstallmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RefundedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Sequence = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_finance_payment_allocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_finance_payment_allocations_finance_installments_FinanceIns~",
                        column: x => x.FinanceInstallmentId,
                        principalTable: "finance_installments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_finance_payment_allocations_finance_payments_FinancePayment~",
                        column: x => x.FinancePaymentId,
                        principalTable: "finance_payments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_finance_payment_allocations_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_finance_payments_OriginalPaymentId",
                table: "finance_payments",
                column: "OriginalPaymentId");

            migrationBuilder.CreateIndex(
                name: "IX_finance_payment_allocations_branch_id",
                table: "finance_payment_allocations",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_finance_payment_allocations_FinanceInstallmentId",
                table: "finance_payment_allocations",
                column: "FinanceInstallmentId");

            migrationBuilder.CreateIndex(
                name: "IX_finance_payment_allocations_FinancePaymentId",
                table: "finance_payment_allocations",
                column: "FinancePaymentId");

            migrationBuilder.CreateIndex(
                name: "IX_finance_payment_allocations_tenant_id",
                table: "finance_payment_allocations",
                column: "tenant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "finance_payment_allocations");

            migrationBuilder.DropIndex(
                name: "IX_finance_payments_OriginalPaymentId",
                table: "finance_payments");

            migrationBuilder.DropColumn(
                name: "EntryType",
                table: "finance_payments");

            migrationBuilder.DropColumn(
                name: "ExternalReference",
                table: "finance_payments");

            migrationBuilder.DropColumn(
                name: "OriginalPaymentId",
                table: "finance_payments");

            migrationBuilder.DropColumn(
                name: "RefundChannel",
                table: "finance_payments");

            migrationBuilder.DropColumn(
                name: "RefundReason",
                table: "finance_payments");

            migrationBuilder.DropColumn(
                name: "RefundStatus",
                table: "finance_payments");

            migrationBuilder.DropColumn(
                name: "RefundType",
                table: "finance_payments");

            migrationBuilder.DropColumn(
                name: "DownPaymentPaidAmount",
                table: "enrollment_contracts");
        }
    }
}
