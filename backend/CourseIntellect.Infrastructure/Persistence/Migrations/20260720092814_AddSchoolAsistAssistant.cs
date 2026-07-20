using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSchoolAsistAssistant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "assistant_audit_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ConversationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Intent = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ToolName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    TargetStudentId = table.Column<Guid>(type: "uuid", nullable: true),
                    WasAuthorized = table.Column<bool>(type: "boolean", nullable: false),
                    FailureReasonCode = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    CorrelationId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IpAddressMasked = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UserAgent = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_assistant_audit_logs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_assistant_audit_logs_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "assistant_conversations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    SelectedStudentId = table.Column<Guid>(type: "uuid", nullable: true),
                    LastIntent = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastMessageAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsArchived = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_assistant_conversations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_assistant_conversations_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "assistant_messages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    ConversationId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MessageType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Text = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Intent = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    StructuredPayloadJson = table.Column<string>(type: "jsonb", nullable: false),
                    ClientMessageId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProcessingDurationMs = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_assistant_messages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_assistant_messages_assistant_conversations_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "assistant_conversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_assistant_messages_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_assistant_audit_logs_tenant_id",
                table: "assistant_audit_logs",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_assistant_audit_logs_tenant_id_UserId_CreatedAtUtc",
                table: "assistant_audit_logs",
                columns: new[] { "tenant_id", "UserId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_assistant_conversations_branch_id",
                table: "assistant_conversations",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_assistant_conversations_tenant_id",
                table: "assistant_conversations",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_assistant_conversations_tenant_id_UserId_IsArchived_LastMes~",
                table: "assistant_conversations",
                columns: new[] { "tenant_id", "UserId", "IsArchived", "LastMessageAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_assistant_messages_ConversationId_CreatedAtUtc",
                table: "assistant_messages",
                columns: new[] { "ConversationId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_assistant_messages_tenant_id",
                table: "assistant_messages",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_assistant_messages_UserId_ClientMessageId_SenderType",
                table: "assistant_messages",
                columns: new[] { "UserId", "ClientMessageId", "SenderType" },
                unique: true,
                filter: "\"ClientMessageId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "assistant_audit_logs");

            migrationBuilder.DropTable(
                name: "assistant_messages");

            migrationBuilder.DropTable(
                name: "assistant_conversations");
        }
    }
}
