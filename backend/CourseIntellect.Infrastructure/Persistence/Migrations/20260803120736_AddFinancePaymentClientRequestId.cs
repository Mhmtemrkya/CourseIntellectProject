using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFinancePaymentClientRequestId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "client_request_id",
                table: "finance_payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_finance_payments_tenant_id_client_request_id",
                table: "finance_payments",
                columns: new[] { "tenant_id", "client_request_id" },
                unique: true,
                filter: "client_request_id IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_finance_payments_tenant_id_client_request_id",
                table: "finance_payments");

            migrationBuilder.DropColumn(
                name: "client_request_id",
                table: "finance_payments");
        }
    }
}
