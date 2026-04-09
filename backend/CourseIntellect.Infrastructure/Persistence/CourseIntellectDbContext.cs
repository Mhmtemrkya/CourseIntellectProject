using CourseIntellect.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Persistence;

public sealed class CourseIntellectDbContext(DbContextOptions<CourseIntellectDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<StudentProfile> Students => Set<StudentProfile>();
    public DbSet<StaffProfile> Staff => Set<StaffProfile>();
    public DbSet<AnnouncementItem> Announcements => Set<AnnouncementItem>();
    public DbSet<ExamResult> ExamResults => Set<ExamResult>();
    public DbSet<MeetingRequest> MeetingRequests => Set<MeetingRequest>();
    public DbSet<MessageThread> MessageThreads => Set<MessageThread>();
    public DbSet<MessageItem> MessageItems => Set<MessageItem>();
    public DbSet<ContentItem> ContentItems => Set<ContentItem>();
    public DbSet<QuestionBankItem> QuestionBankItems => Set<QuestionBankItem>();
    public DbSet<QuestionPracticeAttempt> QuestionPracticeAttempts => Set<QuestionPracticeAttempt>();
    public DbSet<StudentQuestionThread> StudentQuestionThreads => Set<StudentQuestionThread>();
    public DbSet<StudentQuestionReply> StudentQuestionReplies => Set<StudentQuestionReply>();
    public DbSet<AccountingInvoice> AccountingInvoices => Set<AccountingInvoice>();
    public DbSet<AccountingSalary> AccountingSalaries => Set<AccountingSalary>();
    public DbSet<AccountingApproval> AccountingApprovals => Set<AccountingApproval>();
    public DbSet<AccountingCollection> AccountingCollections => Set<AccountingCollection>();
    public DbSet<AccountingInstallment> AccountingInstallments => Set<AccountingInstallment>();
    public DbSet<AccountingNotification> AccountingNotifications => Set<AccountingNotification>();
    public DbSet<AccountingAuditLog> AccountingAuditLogs => Set<AccountingAuditLog>();
    public DbSet<AttendanceEntry> AttendanceEntries => Set<AttendanceEntry>();
    public DbSet<HomeworkAssignment> HomeworkAssignments => Set<HomeworkAssignment>();
    public DbSet<HomeworkSubmission> HomeworkSubmissions => Set<HomeworkSubmission>();
    public DbSet<StudyPlanState> StudyPlanStates => Set<StudyPlanState>();
    public DbSet<RolePolicy> RolePolicies => Set<RolePolicy>();
    public DbSet<NotificationItem> Notifications => Set<NotificationItem>();
    public DbSet<PlatformConfiguration> PlatformConfigurations => Set<PlatformConfiguration>();
    public DbSet<TenantWorkspace> TenantWorkspaces => Set<TenantWorkspace>();
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();
    public DbSet<RefreshTokenSession> RefreshTokenSessions => Set<RefreshTokenSession>();
    public DbSet<SiteContentItem> SiteContentItems => Set<SiteContentItem>();
    public DbSet<ContactMessage> ContactMessages => Set<ContactMessage>();
    public DbSet<TranslationItem> TranslationItems => Set<TranslationItem>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();
    public DbSet<CourseItem> CourseItems => Set<CourseItem>();
    public DbSet<LoginAttemptItem> LoginAttempts => Set<LoginAttemptItem>();
    public DbSet<AuthorizationCode> AuthorizationCodes => Set<AuthorizationCode>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.FullName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Username).HasMaxLength(80).IsRequired();
            entity.HasIndex(x => x.Username).IsUnique();
            entity.Property(x => x.PasswordHash).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Campus).HasMaxLength(80);
            entity.Property(x => x.DepartmentOrBranch).HasMaxLength(120);
            entity.Property(x => x.ExtraRolesSerialized).HasColumnName("extra_roles").HasMaxLength(400);
            entity.Property(x => x.RoleHistorySerialized).HasColumnName("role_history").HasMaxLength(4000);
        });

        modelBuilder.Entity<StudentProfile>(entity =>
        {
            entity.ToTable("student_profiles");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.UserId).IsUnique();
            entity.Property(x => x.FullName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.TcNo).HasMaxLength(11).IsRequired();
            entity.Property(x => x.ClassName).HasMaxLength(20).IsRequired();
            entity.Property(x => x.ParentEmail).HasMaxLength(120);
        });

        modelBuilder.Entity<StaffProfile>(entity =>
        {
            entity.ToTable("staff_profiles");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.UserId).IsUnique();
            entity.Property(x => x.FullName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.TcNo).HasMaxLength(11).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(120);
            entity.Property(x => x.DepartmentOrBranch).HasMaxLength(120).IsRequired();
            entity.Property(x => x.AssignedClassesSerialized).HasColumnName("assigned_classes").HasMaxLength(400);
        });

        modelBuilder.Entity<AnnouncementItem>(entity =>
        {
            entity.ToTable("announcements");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Title).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Audience).HasMaxLength(80).IsRequired();
            entity.Property(x => x.DateLabel).HasMaxLength(40).IsRequired();
        });

        modelBuilder.Entity<ExamResult>(entity =>
        {
            entity.ToTable("exam_results");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ExamTitle).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Subject).HasMaxLength(80).IsRequired();
            entity.Property(x => x.StudentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.ClassName).HasMaxLength(20).IsRequired();
        });

        modelBuilder.Entity<MeetingRequest>(entity =>
        {
            entity.ToTable("meeting_requests");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ParentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.StudentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Advisor).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Topic).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Slot).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
        });

        modelBuilder.Entity<MessageThread>(entity =>
        {
            entity.ToTable("message_threads");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ParticipantOneName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.ParticipantOneRole).HasMaxLength(50).IsRequired();
            entity.Property(x => x.ParticipantTwoName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.ParticipantTwoRole).HasMaxLength(50).IsRequired();
            entity.Property(x => x.LastMessagePreview).HasMaxLength(400).IsRequired();
        });

        modelBuilder.Entity<MessageItem>(entity =>
        {
            entity.ToTable("message_items");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.SenderName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.SenderRole).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Text).HasMaxLength(2000).IsRequired();
            entity.HasIndex(x => x.ThreadId);
        });

        modelBuilder.Entity<ContentItem>(entity =>
        {
            entity.ToTable("content_items");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Subject).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Title).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Teacher).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Info).HasMaxLength(60).IsRequired();
            entity.Property(x => x.FileType).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Grade).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Views).HasMaxLength(60).IsRequired();
            entity.Property(x => x.Size).HasMaxLength(40).IsRequired();
            entity.Property(x => x.FileName).HasMaxLength(200);
            entity.Property(x => x.FileUrl).HasMaxLength(600);
            entity.Property(x => x.PublishStatus).HasMaxLength(30).IsRequired();
        });

        modelBuilder.Entity<QuestionBankItem>(entity =>
        {
            entity.ToTable("question_bank_items");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Subject).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Topic).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Difficulty).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Type).HasMaxLength(40).IsRequired();
            entity.Property(x => x.QuestionText).HasMaxLength(4000).IsRequired();
            entity.Property(x => x.Teacher).HasMaxLength(150).IsRequired();
            entity.Property(x => x.CreatedAtLabel).HasMaxLength(40).IsRequired();
            entity.Property(x => x.ImagePath).HasMaxLength(500);
            entity.Property(x => x.ImagePlacement).HasMaxLength(20).IsRequired();
            entity.Property(x => x.OptionsSerialized).HasColumnName("options").HasMaxLength(4000).IsRequired();
            entity.Property(x => x.ClassTargetsSerialized).HasColumnName("class_targets").HasMaxLength(1000).IsRequired();
            entity.Property(x => x.SolutionAssetPath).HasMaxLength(500);
            entity.Property(x => x.SolutionAssetType).HasMaxLength(40);
            entity.Property(x => x.ExpectedAnswer).HasMaxLength(1000);
        });

        modelBuilder.Entity<QuestionPracticeAttempt>(entity =>
        {
            entity.ToTable("question_practice_attempts");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.QuestionId, x.StudentUsername });
            entity.Property(x => x.StudentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.StudentUsername).HasMaxLength(80).IsRequired();
            entity.Property(x => x.AnswerText).HasMaxLength(4000).IsRequired();
        });

        modelBuilder.Entity<StudentQuestionThread>(entity =>
        {
            entity.ToTable("student_question_threads");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Title).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Subject).HasMaxLength(80).IsRequired();
            entity.Property(x => x.StudentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.StudentUsername).HasMaxLength(80).IsRequired();
            entity.Property(x => x.TeacherName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.QuestionText).HasMaxLength(4000).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.CreatedAtLabel).HasMaxLength(40).IsRequired();
            entity.Property(x => x.LastActivityLabel).HasMaxLength(40).IsRequired();
            entity.Property(x => x.AttachmentSummary).HasMaxLength(240).IsRequired();
            entity.Property(x => x.AttachmentsSerialized).HasColumnName("attachments").HasMaxLength(4000).IsRequired();
        });

        modelBuilder.Entity<StudentQuestionReply>(entity =>
        {
            entity.ToTable("student_question_replies");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.ThreadId);
            entity.Property(x => x.SenderName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.SenderRole).HasMaxLength(50).IsRequired();
            entity.Property(x => x.MessageText).HasMaxLength(4000).IsRequired();
            entity.Property(x => x.CreatedAtLabel).HasMaxLength(40).IsRequired();
            entity.Property(x => x.AttachmentsSerialized).HasColumnName("attachments").HasMaxLength(4000).IsRequired();
        });

        modelBuilder.Entity<AccountingInvoice>(entity =>
        {
            entity.ToTable("accounting_invoices");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Title).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Category).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Subtitle).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Amount).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
        });

        modelBuilder.Entity<AccountingSalary>(entity =>
        {
            entity.ToTable("accounting_salaries");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Employee).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Role).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Amount).HasMaxLength(40).IsRequired();
            entity.Property(x => x.PayDate).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
        });

        modelBuilder.Entity<AccountingApproval>(entity =>
        {
            entity.ToTable("accounting_approvals");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Title).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Category).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.SourceType).HasMaxLength(40).IsRequired();
            entity.Property(x => x.SourceKey).HasMaxLength(180).IsRequired();
        });

        modelBuilder.Entity<HomeworkAssignment>(entity =>
        {
            entity.ToTable("homework_assignments");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Title).HasMaxLength(180).IsRequired();
            entity.Property(x => x.ClassName).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Subject).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Teacher).HasMaxLength(150).IsRequired();
            entity.Property(x => x.DeadlineLabel).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(4000).IsRequired();
            entity.Property(x => x.MaterialsSerialized).HasColumnName("materials").HasMaxLength(4000).IsRequired();
            entity.Property(x => x.CreatedAtLabel).HasMaxLength(40).IsRequired();
        });

        modelBuilder.Entity<HomeworkSubmission>(entity =>
        {
            entity.ToTable("homework_submissions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.AssignmentId);
            entity.Property(x => x.StudentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(4000).IsRequired();
            entity.Property(x => x.FilesSerialized).HasColumnName("files").HasMaxLength(4000).IsRequired();
            entity.Property(x => x.SubmittedAtLabel).HasMaxLength(40).IsRequired();
        });

        modelBuilder.Entity<AttendanceEntry>(entity =>
        {
            entity.ToTable("attendance_entries");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.StudentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.ClassName).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Lesson).HasMaxLength(120).IsRequired();
            entity.HasIndex(x => x.ClassName);
        });

        modelBuilder.Entity<PlatformConfiguration>(entity =>
        {
            entity.ToTable("platform_configurations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ConfigurationType).HasMaxLength(80).IsRequired();
            entity.Property(x => x.ScopeKey).HasMaxLength(180).IsRequired();
            entity.Property(x => x.DisplayName).HasMaxLength(180).IsRequired();
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json").HasMaxLength(12000).IsRequired();
            entity.HasIndex(x => new { x.ConfigurationType, x.ScopeKey }).IsUnique();
        });

        modelBuilder.Entity<TenantWorkspace>(entity =>
        {
            entity.ToTable("tenant_workspaces");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Slug).HasMaxLength(180).IsRequired();
            entity.Property(x => x.ContactEmail).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Plan).HasMaxLength(60).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.MonthlyFee).HasColumnType("numeric(18,2)");
            entity.Property(x => x.CollectedAmount).HasColumnType("numeric(18,2)");
            entity.Property(x => x.StorageUsedGb).HasColumnType("numeric(18,2)");
            entity.HasIndex(x => x.Slug).IsUnique();
        });

        modelBuilder.Entity<SupportTicket>(entity =>
        {
            entity.ToTable("support_tickets");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.TicketNumber).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Subject).HasMaxLength(180).IsRequired();
            entity.Property(x => x.TenantName).HasMaxLength(180).IsRequired();
            entity.Property(x => x.RequestedBy).HasMaxLength(150).IsRequired();
            entity.Property(x => x.RequestedRole).HasMaxLength(60).IsRequired();
            entity.Property(x => x.Category).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Priority).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Summary).HasMaxLength(2000).IsRequired();
            entity.Property(x => x.LastMessage).HasMaxLength(2000).IsRequired();
            entity.HasIndex(x => x.TicketNumber).IsUnique();
        });

        modelBuilder.Entity<StudyPlanState>(entity =>
        {
            entity.ToTable("study_plan_states");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.StudentName).IsUnique();
            entity.Property(x => x.StudentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.PlanItemsSerialized).HasColumnName("plan_items").HasMaxLength(12000).IsRequired();
        });

        modelBuilder.Entity<AccountingCollection>(entity =>
        {
            entity.ToTable("accounting_collections");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(150).IsRequired();
            entity.Property(x => x.ClassName).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Amount).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Method).HasMaxLength(60).IsRequired();
            entity.Property(x => x.Time).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(500).IsRequired();
        });

        modelBuilder.Entity<AccountingInstallment>(entity =>
        {
            entity.ToTable("accounting_installments");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Student).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Amount).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Due).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(500).IsRequired();
        });

        modelBuilder.Entity<AccountingNotification>(entity =>
        {
            entity.ToTable("accounting_notifications");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Title).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Message).HasMaxLength(500).IsRequired();
            entity.Property(x => x.Time).HasMaxLength(40).IsRequired();
        });

        modelBuilder.Entity<AccountingAuditLog>(entity =>
        {
            entity.ToTable("accounting_audit_logs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Title).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Detail).HasMaxLength(500).IsRequired();
            entity.Property(x => x.Time).HasMaxLength(60).IsRequired();
        });

        modelBuilder.Entity<RolePolicy>(entity =>
        {
            entity.ToTable("role_policies");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.RoleName).IsUnique();
            entity.Property(x => x.RoleName).HasMaxLength(40).IsRequired();
            entity.Property(x => x.MessagingScope).HasMaxLength(200).IsRequired();
            entity.Property(x => x.ModuleAccessSerialized).HasColumnName("module_access").HasMaxLength(1000).IsRequired();
        });

        modelBuilder.Entity<NotificationItem>(entity =>
        {
            entity.ToTable("notifications");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Title).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Message).HasMaxLength(600).IsRequired();
            entity.Property(x => x.TimeLabel).HasMaxLength(60).IsRequired();
            entity.Property(x => x.Audience).HasMaxLength(80).IsRequired();
            entity.Property(x => x.TargetRole).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Category).HasMaxLength(80).IsRequired();
        });

        modelBuilder.Entity<RefreshTokenSession>(entity =>
        {
            entity.ToTable("refresh_token_sessions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.TokenHash).IsUnique();
            entity.Property(x => x.TokenHash).HasMaxLength(300).IsRequired();
        });

        modelBuilder.Entity<SiteContentItem>(entity =>
        {
            entity.ToTable("site_content_items");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.SectionKey).HasMaxLength(120).IsRequired();
            entity.Property(x => x.ContentJson).HasMaxLength(12000).IsRequired();
            entity.Property(x => x.Language).HasMaxLength(10).IsRequired();
            entity.Property(x => x.UpdatedBy).HasMaxLength(150).IsRequired();
            entity.HasIndex(x => new { x.SectionKey, x.Language, x.Version }).IsUnique();
        });

        modelBuilder.Entity<ContactMessage>(entity =>
        {
            entity.ToTable("contact_messages");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Subject).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Message).HasMaxLength(4000).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.IpAddress).HasMaxLength(60).IsRequired();
            entity.HasIndex(x => x.Status);
        });

        modelBuilder.Entity<TranslationItem>(entity =>
        {
            entity.ToTable("translation_items");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Key).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Language).HasMaxLength(10).IsRequired();
            entity.Property(x => x.Value).HasMaxLength(4000).IsRequired();
            entity.Property(x => x.Category).HasMaxLength(80).IsRequired();
            entity.HasIndex(x => new { x.Key, x.Language }).IsUnique();
        });

        modelBuilder.Entity<AppSetting>(entity =>
        {
            entity.ToTable("app_settings");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Key).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Value).HasMaxLength(4000).IsRequired();
            entity.Property(x => x.Type).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Category).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(500).IsRequired();
            entity.HasIndex(x => x.Key).IsUnique();
        });

        modelBuilder.Entity<CourseItem>(entity =>
        {
            entity.ToTable("course_items");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(4000).IsRequired();
            entity.Property(x => x.Category).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Price).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Duration).HasMaxLength(60).IsRequired();
            entity.Property(x => x.Level).HasMaxLength(40).IsRequired();
            entity.HasIndex(x => x.Category);
        });

        modelBuilder.Entity<LoginAttemptItem>(entity =>
        {
            entity.ToTable("login_attempts");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Email).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Role).HasMaxLength(40).IsRequired();
            entity.Property(x => x.IpAddress).HasMaxLength(60).IsRequired();
            entity.Property(x => x.UserAgent).HasMaxLength(500).IsRequired();
            entity.Property(x => x.DeviceId).HasMaxLength(200).IsRequired();
            entity.HasIndex(x => x.Email);
            entity.HasIndex(x => x.Timestamp);
        });

        modelBuilder.Entity<AuthorizationCode>(entity =>
        {
            entity.ToTable("authorization_codes");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Code).HasMaxLength(200).IsRequired();
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.ClientId).HasMaxLength(80).IsRequired();
            entity.Property(x => x.RedirectUri).HasMaxLength(500).IsRequired();
            entity.Property(x => x.CodeChallengeHash).HasMaxLength(200).IsRequired();
        });
    }
}
