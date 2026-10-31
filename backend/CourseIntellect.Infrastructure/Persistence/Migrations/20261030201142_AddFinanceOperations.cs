using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFinanceOperations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "StatusChangedAtUtc",
                table: "enrollment_contracts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StatusReason",
                table: "enrollment_contracts",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ApprovalStatus",
                table: "driving_expenses",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Onaylandı");

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAtUtc",
                table: "driving_expenses",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApprovedByUserId",
                table: "driving_expenses",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "driving_expenses",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "PaidAtUtc",
                table: "accounting_salaries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "accounting_salaries",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CancelReason",
                table: "accounting_invoices",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAtUtc",
                table: "accounting_invoices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAtUtc",
                table: "accounting_invoices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ActorName",
                table: "accounting_audit_logs",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "ActorUserId",
                table: "accounting_audit_logs",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAtUtc",
                table: "accounting_audit_logs",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.CreateTable(
                name: "bank_reconciliation_entries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    Reference = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    BankDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MatchedType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MatchedId = table.Column<Guid>(type: "uuid", nullable: true),
                    MatchedLabel = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bank_reconciliation_entries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bank_reconciliation_entries_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "finance_day_closings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    Day = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CashIn = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CashOut = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ExpectedCash = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CountedCash = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Difference = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CardIn = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TransferIn = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CollectionCount = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ClosedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ClosedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ClosedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_finance_day_closings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_finance_day_closings_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "finance_reminder_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    DedupeKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Channel = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    SentAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_finance_reminder_logs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_finance_reminder_logs_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_accounting_audit_logs_CreatedAtUtc",
                table: "accounting_audit_logs",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_bank_reconciliation_entries_MatchedType_MatchedId",
                table: "bank_reconciliation_entries",
                columns: new[] { "MatchedType", "MatchedId" });

            migrationBuilder.CreateIndex(
                name: "IX_bank_reconciliation_entries_tenant_id",
                table: "bank_reconciliation_entries",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_bank_reconciliation_entries_tenant_id_Reference_BankDate_Am~",
                table: "bank_reconciliation_entries",
                columns: new[] { "tenant_id", "Reference", "BankDate", "Amount" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_finance_day_closings_tenant_id",
                table: "finance_day_closings",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_finance_day_closings_tenant_id_Day",
                table: "finance_day_closings",
                columns: new[] { "tenant_id", "Day" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_finance_reminder_logs_tenant_id",
                table: "finance_reminder_logs",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_finance_reminder_logs_tenant_id_DedupeKey",
                table: "finance_reminder_logs",
                columns: new[] { "tenant_id", "DedupeKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bank_reconciliation_entries");

            migrationBuilder.DropTable(
                name: "finance_day_closings");

            migrationBuilder.DropTable(
                name: "finance_reminder_logs");

            migrationBuilder.DropIndex(
                name: "IX_accounting_audit_logs_CreatedAtUtc",
                table: "accounting_audit_logs");

            migrationBuilder.DropColumn(
                name: "StatusChangedAtUtc",
                table: "enrollment_contracts");

            migrationBuilder.DropColumn(
                name: "StatusReason",
                table: "enrollment_contracts");

            migrationBuilder.DropColumn(
                name: "ApprovalStatus",
                table: "driving_expenses");

            migrationBuilder.DropColumn(
                name: "ApprovedAtUtc",
                table: "driving_expenses");

            migrationBuilder.DropColumn(
                name: "ApprovedByUserId",
                table: "driving_expenses");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "driving_expenses");

            migrationBuilder.DropColumn(
                name: "PaidAtUtc",
                table: "accounting_salaries");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "accounting_salaries");

            migrationBuilder.DropColumn(
                name: "CancelReason",
                table: "accounting_invoices");

            migrationBuilder.DropColumn(
                name: "CancelledAtUtc",
                table: "accounting_invoices");

            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                table: "accounting_invoices");

            migrationBuilder.DropColumn(
                name: "ActorName",
                table: "accounting_audit_logs");

            migrationBuilder.DropColumn(
                name: "ActorUserId",
                table: "accounting_audit_logs");

            migrationBuilder.DropColumn(
                name: "CreatedAtUtc",
                table: "accounting_audit_logs");
        }
    }
}
