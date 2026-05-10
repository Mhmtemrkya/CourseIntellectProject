using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// EF snapshot drift düzeltmesi: <c>MessageItem.Attachments</c> entity'de ve
    /// DbContext mapping'inde tanımlı, snapshot'lara dahil edilmiş; ancak veritabanına
    /// kolon ekleyen bir migration mevcut değildi. Bu yüzden <c>/api/messages/threads</c>
    /// EF kolonu okumaya çalışınca tüm rollerde 500 hatası dönüyordu.
    /// Bu migration eksik AddColumn'u idempotent şekilde uygular: kolon zaten varsa
    /// hata vermez (`IF NOT EXISTS`).
    /// </summary>
    public partial class AddMessageItemAttachments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE message_items
                ADD COLUMN IF NOT EXISTS attachments character varying(8000) NOT NULL DEFAULT '[]';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE message_items
                DROP COLUMN IF EXISTS attachments;
            ");
        }
    }
}
