using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStudentFinanceModule : Migration
    {
        // Not: Bu migration yalnızca normalize finans tablolarını ekler.
        // (Repodaki model snapshot, exam-solving modülünden bu yana eksikti;
        // EF otomatik üretimde o tabloları da dahil etmek istedi ancak bunlar
        // zaten mevcut olduğundan migration finans tablolarıyla sınırlandırıldı.)

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "enrollment_contracts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ClassName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    AcademicYear = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    GrossAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountReason = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    NetAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DownPayment = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    InstallmentCount = table.Column<int>(type: "integer", nullable: false),
                    Currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_enrollment_contracts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_enrollment_contracts_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "finance_installments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    EnrollmentContractId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    SeqNo = table.Column<int>(type: "integer", nullable: false),
                    Label = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    DueDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PaidAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_finance_installments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_finance_installments_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "finance_payments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    EnrollmentContractId = table.Column<Guid>(type: "uuid", nullable: true),
                    FinanceInstallmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Method = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ReceiptNo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    PaidAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_finance_payments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_finance_payments_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_enrollment_contracts_StudentUserId",
                table: "enrollment_contracts",
                column: "StudentUserId");

            migrationBuilder.CreateIndex(
                name: "IX_enrollment_contracts_tenant_id",
                table: "enrollment_contracts",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_finance_installments_EnrollmentContractId",
                table: "finance_installments",
                column: "EnrollmentContractId");

            migrationBuilder.CreateIndex(
                name: "IX_finance_installments_StudentUserId",
                table: "finance_installments",
                column: "StudentUserId");

            migrationBuilder.CreateIndex(
                name: "IX_finance_installments_tenant_id",
                table: "finance_installments",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_finance_payments_FinanceInstallmentId",
                table: "finance_payments",
                column: "FinanceInstallmentId");

            migrationBuilder.CreateIndex(
                name: "IX_finance_payments_StudentUserId",
                table: "finance_payments",
                column: "StudentUserId");

            migrationBuilder.CreateIndex(
                name: "IX_finance_payments_tenant_id",
                table: "finance_payments",
                column: "tenant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "enrollment_contracts");

            migrationBuilder.DropTable(
                name: "finance_installments");

            migrationBuilder.DropTable(
                name: "finance_payments");
        }
    }
}
