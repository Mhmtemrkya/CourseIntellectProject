using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEnrollmentDownPaymentPaid : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Varsayılan true: eski sözleşmelerde peşinat (varsa) zaten makbuzlu
            // tahsil edilmişti; hepsi geriye dönük "ödendi" sayılır. Yeni kayıtlarda
            // uygulama değeri açıkça yazar.
            migrationBuilder.AddColumn<bool>(
                name: "DownPaymentPaid",
                table: "enrollment_contracts",
                type: "boolean",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DownPaymentPaid",
                table: "enrollment_contracts");
        }
    }
}
