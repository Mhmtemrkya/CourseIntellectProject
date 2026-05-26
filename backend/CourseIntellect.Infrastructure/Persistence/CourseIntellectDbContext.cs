using CourseIntellect.Domain.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System.Security.Claims;

namespace CourseIntellect.Infrastructure.Persistence;

public sealed class CourseIntellectDbContext : DbContext
{
    private readonly IHttpContextAccessor? httpContextAccessor;

    public CourseIntellectDbContext(
        DbContextOptions<CourseIntellectDbContext> options,
        IHttpContextAccessor? httpContextAccessor = null) : base(options)
    {
        this.httpContextAccessor = httpContextAccessor;
    }

    public Guid? CurrentTenantId
    {
        get
        {
            var raw = httpContextAccessor?.HttpContext?.User?.FindFirstValue("tenant_id");
            return Guid.TryParse(raw, out var tenantId) ? tenantId : null;
        }
    }

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
    public DbSet<PlatformSubscriptionInvoice> PlatformSubscriptionInvoices => Set<PlatformSubscriptionInvoice>();
    public DbSet<ServiceVehicle> ServiceVehicles => Set<ServiceVehicle>();
    public DbSet<ServiceDriver> ServiceDrivers => Set<ServiceDriver>();
    public DbSet<ServiceRoute> ServiceRoutes => Set<ServiceRoute>();
    public DbSet<ServiceRouteStop> ServiceRouteStops => Set<ServiceRouteStop>();
    public DbSet<StudentServiceAssignment> StudentServiceAssignments => Set<StudentServiceAssignment>();
    public DbSet<ServiceTrip> ServiceTrips => Set<ServiceTrip>();
    public DbSet<ServiceAttendance> ServiceAttendances => Set<ServiceAttendance>();
    public DbSet<ServiceVehicleLocation> ServiceVehicleLocations => Set<ServiceVehicleLocation>();
    public DbSet<ServiceAbsenceRequest> ServiceAbsenceRequests => Set<ServiceAbsenceRequest>();
    public DbSet<ExamSession> ExamSessions => Set<ExamSession>();
    public DbSet<ExamQuestion> ExamQuestions => Set<ExamQuestion>();
    public DbSet<QuestionAttempt> QuestionAttempts => Set<QuestionAttempt>();
    public DbSet<AnswerSelection> AnswerSelections => Set<AnswerSelection>();
    public DbSet<CanvasStroke> CanvasStrokes => Set<CanvasStroke>();
    public DbSet<CanvasSnapshot> CanvasSnapshots => Set<CanvasSnapshot>();
    public DbSet<StudentNote> StudentNotes => Set<StudentNote>();
    public DbSet<PdfReport> PdfReports => Set<PdfReport>();
    public DbSet<TeacherReviewComment> TeacherReviewComments => Set<TeacherReviewComment>();
    public DbSet<ReportRecipient> ReportRecipients => Set<ReportRecipient>();
    public DbSet<LiveExamState> LiveExamStates => Set<LiveExamState>();

    public override int SaveChanges()
    {
        ApplyTenantContext();
        return base.SaveChanges();
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        ApplyTenantContext();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyTenantContext();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        ApplyTenantContext();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.FullName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Username).HasMaxLength(80).IsRequired();
            entity.HasIndex(x => x.Username).IsUnique();
            entity.Property(x => x.PasswordHash).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Campus).HasMaxLength(80);
            entity.Property(x => x.DepartmentOrBranch).HasMaxLength(120);
            entity.Property(x => x.ExtraRolesSerialized).HasColumnName("extra_roles").HasMaxLength(400);
            entity.Property(x => x.RoleHistorySerialized).HasColumnName("role_history").HasMaxLength(4000);
            entity.Property(x => x.MustChangePassword).HasColumnName("must_change_password").HasDefaultValue(false);
        });

        modelBuilder.Entity<StudentProfile>(entity =>
        {
            entity.ToTable("student_profiles");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.HasIndex(x => x.UserId).IsUnique();
            entity.Property(x => x.FullName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.TcNo).HasMaxLength(11).IsRequired();
            entity.Property(x => x.ClassName).HasMaxLength(20).IsRequired();
            entity.Property(x => x.ParentEmail).HasMaxLength(120);
            entity.Property(x => x.ParentUserId).HasColumnName("parent_user_id");
            entity.HasIndex(x => x.ParentUserId);
        });

        modelBuilder.Entity<StaffProfile>(entity =>
        {
            entity.ToTable("staff_profiles");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
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
            ConfigureTenantScope(entity);
            entity.Property(x => x.Title).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Audience).HasMaxLength(80).IsRequired();
            entity.Property(x => x.DateLabel).HasMaxLength(40).IsRequired();
        });

        modelBuilder.Entity<ExamResult>(entity =>
        {
            entity.ToTable("exam_results");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.ExamTitle).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Subject).HasMaxLength(80).IsRequired();
            entity.Property(x => x.StudentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.ClassName).HasMaxLength(20).IsRequired();
        });

        modelBuilder.Entity<MeetingRequest>(entity =>
        {
            entity.ToTable("meeting_requests");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
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
            ConfigureTenantScope(entity);
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
            ConfigureTenantScope(entity);
            entity.Property(x => x.SenderName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.SenderRole).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Text).HasMaxLength(2000).IsRequired();
            entity.Property(x => x.Attachments)
                .HasColumnName("attachments")
                .HasMaxLength(8000)
                .IsRequired()
                .HasDefaultValue("[]");
            entity.HasIndex(x => x.ThreadId);
        });

        modelBuilder.Entity<ContentItem>(entity =>
        {
            entity.ToTable("content_items");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
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
            ConfigureTenantScope(entity);
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
            entity.Property(x => x.RichTextHtml).HasColumnName("rich_text_html").HasMaxLength(16000);
            entity.Property(x => x.SolutionTextHtml).HasColumnName("solution_text_html").HasMaxLength(16000);
            entity.Property(x => x.EditorMetadataJson).HasColumnName("editor_metadata_json").HasMaxLength(30000);
            entity.Property(x => x.PublicationStatus).HasColumnName("publication_status").HasMaxLength(30).HasDefaultValue("Published").IsRequired();
        });

        modelBuilder.Entity<QuestionPracticeAttempt>(entity =>
        {
            entity.ToTable("question_practice_attempts");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            ConfigureTenantScope(entity);
            entity.Property(x => x.QuestionId).HasColumnName("question_id");
            entity.HasIndex(x => new { x.QuestionId, x.StudentUsername });
            entity.Property(x => x.StudentName).HasColumnName("student_name").HasMaxLength(150).IsRequired();
            entity.Property(x => x.StudentUsername).HasColumnName("student_username").HasMaxLength(80).IsRequired();
            entity.Property(x => x.AnswerText).HasColumnName("answer_text").HasMaxLength(4000).IsRequired();
            entity.Property(x => x.IsCorrect).HasColumnName("is_correct");
            entity.Property(x => x.SubmittedAtUtc).HasColumnName("submitted_at_utc");
        });

        modelBuilder.Entity<StudentQuestionThread>(entity =>
        {
            entity.ToTable("student_question_threads");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
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
            ConfigureTenantScope(entity);
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
            ConfigureTenantScope(entity);
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
            ConfigureTenantScope(entity);
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
            ConfigureTenantScope(entity);
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
            entity.Property(x => x.Id).HasColumnName("id");
            ConfigureTenantScope(entity);
            entity.Property(x => x.Title).HasColumnName("title").HasMaxLength(180).IsRequired();
            entity.Property(x => x.ClassName).HasColumnName("class_name").HasMaxLength(20).IsRequired();
            entity.Property(x => x.Subject).HasColumnName("subject").HasMaxLength(80).IsRequired();
            entity.Property(x => x.Teacher).HasColumnName("teacher").HasMaxLength(150).IsRequired();
            entity.Property(x => x.DeadlineLabel).HasColumnName("deadline_label").HasMaxLength(80).IsRequired();
            entity.Property(x => x.Description).HasColumnName("description").HasMaxLength(4000).IsRequired();
            entity.Property(x => x.MaterialsSerialized).HasColumnName("materials").HasMaxLength(4000).IsRequired();
            entity.Property(x => x.TotalStudents).HasColumnName("total_students");
            entity.Property(x => x.CreatedAtLabel).HasColumnName("created_at_label").HasMaxLength(40).IsRequired();
        });

        modelBuilder.Entity<HomeworkSubmission>(entity =>
        {
            entity.ToTable("homework_submissions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            ConfigureTenantScope(entity);
            entity.Property(x => x.AssignmentId).HasColumnName("assignment_id");
            entity.HasIndex(x => x.AssignmentId);
            entity.Property(x => x.StudentName).HasColumnName("student_name").HasMaxLength(150).IsRequired();
            entity.Property(x => x.Note).HasColumnName("note").HasMaxLength(4000).IsRequired();
            entity.Property(x => x.FilesSerialized).HasColumnName("files").HasMaxLength(4000).IsRequired();
            entity.Property(x => x.SubmittedAtLabel).HasColumnName("submitted_at_label").HasMaxLength(40).IsRequired();
        });

        modelBuilder.Entity<AttendanceEntry>(entity =>
        {
            entity.ToTable("attendance_entries");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            ConfigureTenantScope(entity);
            entity.Property(x => x.StudentName).HasColumnName("student_name").HasMaxLength(150).IsRequired();
            entity.Property(x => x.ClassName).HasColumnName("class_name").HasMaxLength(20).IsRequired();
            entity.Property(x => x.LessonDate).HasColumnName("lesson_date");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.Lesson).HasColumnName("lesson").HasMaxLength(120).IsRequired();
            entity.HasIndex(x => x.ClassName);
        });

        modelBuilder.Entity<PlatformConfiguration>(entity =>
        {
            entity.ToTable("platform_configurations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            ConfigureTenantScope(entity);
            entity.Property(x => x.ConfigurationType).HasColumnName("configuration_type").HasMaxLength(80).IsRequired();
            entity.Property(x => x.ScopeKey).HasColumnName("scope_key").HasMaxLength(180).IsRequired();
            entity.Property(x => x.DisplayName).HasColumnName("display_name").HasMaxLength(180).IsRequired();
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json").HasColumnType("text").IsRequired();
            entity.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
            entity.HasIndex(x => new { x.TenantId, x.ConfigurationType, x.ScopeKey }).IsUnique();
        });

        modelBuilder.Entity<TenantWorkspace>(entity =>
        {
            entity.ToTable("tenant_workspaces");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(180).IsRequired();
            entity.Property(x => x.Slug).HasColumnName("slug").HasMaxLength(180).IsRequired();
            entity.Property(x => x.ContactEmail).HasColumnName("contact_email").HasMaxLength(180).IsRequired();
            entity.Property(x => x.ContactName).HasMaxLength(150);
            entity.Property(x => x.ContactPhone).HasMaxLength(40);
            entity.Property(x => x.PendingAdminPasswordHash).HasMaxLength(300);
            entity.Property(x => x.Plan).HasColumnName("plan").HasMaxLength(60).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(40).IsRequired();
            entity.Property(x => x.UserCount).HasColumnName("user_count");
            entity.Property(x => x.BranchCount).HasColumnName("branch_count");
            entity.Property(x => x.StudentCount).HasColumnName("student_count");
            entity.Property(x => x.StaffCount).HasColumnName("staff_count");
            entity.Property(x => x.MonthlyFee).HasColumnName("monthly_fee").HasColumnType("numeric(18,2)");
            entity.Property(x => x.CollectedAmount).HasColumnName("collected_amount").HasColumnType("numeric(18,2)");
            entity.Property(x => x.StorageUsedGb).HasColumnName("storage_used_gb").HasColumnType("numeric(18,2)");
            entity.Property(x => x.ApiUsage).HasColumnName("api_usage");
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
            entity.HasIndex(x => x.Slug).IsUnique();
            entity.HasIndex(x => x.AdminUserId);
            entity.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(x => x.AdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<PlatformSubscriptionInvoice>(entity =>
        {
            entity.ToTable("platform_subscription_invoices");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            entity.Property(x => x.TenantName).HasColumnName("tenant_name").HasMaxLength(180).IsRequired();
            entity.Property(x => x.TenantContactEmail).HasColumnName("tenant_contact_email").HasMaxLength(180).IsRequired();
            entity.Property(x => x.InvoiceNumber).HasColumnName("invoice_number").HasMaxLength(40).IsRequired();
            entity.Property(x => x.PlanId).HasColumnName("plan_id").HasMaxLength(80).IsRequired();
            entity.Property(x => x.PlanName).HasColumnName("plan_name").HasMaxLength(120).IsRequired();
            entity.Property(x => x.Amount).HasColumnName("amount").HasColumnType("numeric(18,2)");
            entity.Property(x => x.Currency).HasColumnName("currency").HasMaxLength(8).IsRequired();
            entity.Property(x => x.BillingPeriod).HasColumnName("billing_period").HasMaxLength(20).IsRequired();
            entity.Property(x => x.PeriodStartUtc).HasColumnName("period_start_utc");
            entity.Property(x => x.PeriodEndUtc).HasColumnName("period_end_utc");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
            entity.Property(x => x.IssuedAtUtc).HasColumnName("issued_at_utc");
            entity.Property(x => x.DueAtUtc).HasColumnName("due_at_utc");
            entity.Property(x => x.PaidAtUtc).HasColumnName("paid_at_utc");
            entity.Property(x => x.Notes).HasColumnName("notes").HasMaxLength(1000);
            entity.HasIndex(x => x.InvoiceNumber).IsUnique();
            entity.HasIndex(x => x.TenantId);
            entity.HasIndex(x => x.Status);
        });

        modelBuilder.Entity<SupportTicket>(entity =>
        {
            entity.ToTable("support_tickets");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TicketNumber).HasColumnName("ticket_number").HasMaxLength(40).IsRequired();
            entity.Property(x => x.Subject).HasColumnName("subject").HasMaxLength(180).IsRequired();
            entity.Property(x => x.TenantName).HasColumnName("tenant_name").HasMaxLength(180).IsRequired();
            entity.Property(x => x.RequestedBy).HasColumnName("requested_by").HasMaxLength(150).IsRequired();
            entity.Property(x => x.RequestedRole).HasColumnName("requested_role").HasMaxLength(60).IsRequired();
            entity.Property(x => x.Category).HasColumnName("category").HasMaxLength(80).IsRequired();
            entity.Property(x => x.Priority).HasColumnName("priority").HasMaxLength(20).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
            entity.Property(x => x.Summary).HasColumnName("summary").HasMaxLength(2000).IsRequired();
            entity.Property(x => x.LastMessage).HasColumnName("last_message").HasMaxLength(2000).IsRequired();
            entity.Property(x => x.MessageCount).HasColumnName("message_count");
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
            entity.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
            entity.HasIndex(x => x.TicketNumber).IsUnique();
        });

        modelBuilder.Entity<StudyPlanState>(entity =>
        {
            entity.ToTable("study_plan_states");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.HasIndex(x => new { x.TenantId, x.StudentName }).IsUnique();
            entity.Property(x => x.StudentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.PlanItemsSerialized).HasColumnName("plan_items").HasMaxLength(12000).IsRequired();
        });

        modelBuilder.Entity<AccountingCollection>(entity =>
        {
            entity.ToTable("accounting_collections");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
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
            ConfigureTenantScope(entity);
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
            ConfigureTenantScope(entity);
            entity.Property(x => x.Title).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Message).HasMaxLength(500).IsRequired();
            entity.Property(x => x.Time).HasMaxLength(40).IsRequired();
        });

        modelBuilder.Entity<AccountingAuditLog>(entity =>
        {
            entity.ToTable("accounting_audit_logs");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
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
            ConfigureTenantScope(entity);
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
            ConfigureTenantScope(entity);
            entity.Property(x => x.SectionKey).HasMaxLength(120).IsRequired();
            entity.Property(x => x.ContentJson).HasMaxLength(12000).IsRequired();
            entity.Property(x => x.Language).HasMaxLength(10).IsRequired();
            entity.Property(x => x.UpdatedBy).HasMaxLength(150).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.SectionKey, x.Language, x.Version }).IsUnique();
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

        ConfigureServiceTracking(modelBuilder);
    }

    private void ConfigureServiceTracking(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ServiceVehicle>(entity =>
        {
            entity.ToTable("service_vehicles");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.PlateNumber).HasColumnName("plate_number").HasMaxLength(20).IsRequired();
            entity.Property(x => x.Brand).HasColumnName("brand").HasMaxLength(80);
            entity.Property(x => x.Model).HasColumnName("model").HasMaxLength(80);
            entity.Property(x => x.Capacity).HasColumnName("capacity");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => x.PlateNumber);
        });

        modelBuilder.Entity<ServiceDriver>(entity =>
        {
            entity.ToTable("service_drivers");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.PhoneNumber).HasColumnName("phone_number").HasMaxLength(40);
            entity.Property(x => x.LicenseNumber).HasColumnName("license_number").HasMaxLength(80);
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => x.UserId);
            entity.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ServiceRoute>(entity =>
        {
            entity.ToTable("service_routes");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(150).IsRequired();
            entity.Property(x => x.RouteType).HasColumnName("route_type").HasConversion<string>().HasMaxLength(20);
            entity.Property(x => x.VehicleId).HasColumnName("vehicle_id");
            entity.Property(x => x.DriverId).HasColumnName("driver_id");
            entity.Property(x => x.StartTime).HasColumnName("start_time");
            entity.Property(x => x.EndTime).HasColumnName("end_time");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.TenantId, x.RouteType, x.IsActive });
            entity.HasOne<ServiceVehicle>()
                .WithMany()
                .HasForeignKey(x => x.VehicleId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ServiceDriver>()
                .WithMany()
                .HasForeignKey(x => x.DriverId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ServiceRouteStop>(entity =>
        {
            entity.ToTable("service_route_stops");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.RouteId).HasColumnName("route_id");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(150).IsRequired();
            entity.Property(x => x.Address).HasColumnName("address").HasMaxLength(600).IsRequired();
            entity.Property(x => x.Latitude).HasColumnName("latitude");
            entity.Property(x => x.Longitude).HasColumnName("longitude");
            entity.Property(x => x.SortOrder).HasColumnName("sort_order");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.RouteId, x.SortOrder }).IsUnique();
            entity.HasOne<ServiceRoute>()
                .WithMany()
                .HasForeignKey(x => x.RouteId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<StudentServiceAssignment>(entity =>
        {
            entity.ToTable("student_service_assignments");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.StudentId).HasColumnName("student_id");
            entity.Property(x => x.ParentId).HasColumnName("parent_id");
            entity.Property(x => x.RouteId).HasColumnName("route_id");
            entity.Property(x => x.StopId).HasColumnName("stop_id");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.StudentId, x.RouteId, x.IsActive });
            entity.HasOne<StudentProfile>()
                .WithMany()
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(x => x.ParentId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ServiceRoute>()
                .WithMany()
                .HasForeignKey(x => x.RouteId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ServiceRouteStop>()
                .WithMany()
                .HasForeignKey(x => x.StopId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ServiceTrip>(entity =>
        {
            entity.ToTable("service_trips");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.RouteId).HasColumnName("route_id");
            entity.Property(x => x.DriverId).HasColumnName("driver_id");
            entity.Property(x => x.VehicleId).HasColumnName("vehicle_id");
            entity.Property(x => x.TripDate).HasColumnName("trip_date");
            entity.Property(x => x.TripType).HasColumnName("trip_type").HasConversion<string>().HasMaxLength(20);
            entity.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(30);
            entity.Property(x => x.StartedAt).HasColumnName("started_at");
            entity.Property(x => x.ArrivedAtSchoolAt).HasColumnName("arrived_at_school_at");
            entity.Property(x => x.CompletedAt).HasColumnName("completed_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.RouteId, x.TripDate, x.TripType }).IsUnique();
            entity.HasOne<ServiceRoute>()
                .WithMany()
                .HasForeignKey(x => x.RouteId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ServiceDriver>()
                .WithMany()
                .HasForeignKey(x => x.DriverId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ServiceVehicle>()
                .WithMany()
                .HasForeignKey(x => x.VehicleId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ServiceAttendance>(entity =>
        {
            entity.ToTable("service_attendances");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TripId).HasColumnName("trip_id");
            entity.Property(x => x.StudentId).HasColumnName("student_id");
            entity.Property(x => x.ParentId).HasColumnName("parent_id");
            entity.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(30);
            entity.Property(x => x.MarkedByDriverId).HasColumnName("marked_by_driver_id");
            entity.Property(x => x.MarkedAt).HasColumnName("marked_at");
            entity.Property(x => x.Note).HasColumnName("note").HasMaxLength(500);
            entity.HasIndex(x => new { x.TripId, x.StudentId }).IsUnique();
            entity.HasOne<ServiceTrip>()
                .WithMany()
                .HasForeignKey(x => x.TripId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<StudentProfile>()
                .WithMany()
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(x => x.ParentId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ServiceDriver>()
                .WithMany()
                .HasForeignKey(x => x.MarkedByDriverId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ServiceVehicleLocation>(entity =>
        {
            entity.ToTable("service_vehicle_locations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VehicleId).HasColumnName("vehicle_id");
            entity.Property(x => x.DriverId).HasColumnName("driver_id");
            entity.Property(x => x.TripId).HasColumnName("trip_id");
            entity.Property(x => x.Latitude).HasColumnName("latitude");
            entity.Property(x => x.Longitude).HasColumnName("longitude");
            entity.Property(x => x.Speed).HasColumnName("speed");
            entity.Property(x => x.Heading).HasColumnName("heading");
            entity.Property(x => x.RecordedAt).HasColumnName("recorded_at");
            entity.HasIndex(x => new { x.VehicleId, x.RecordedAt });
            entity.HasOne<ServiceVehicle>()
                .WithMany()
                .HasForeignKey(x => x.VehicleId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ServiceDriver>()
                .WithMany()
                .HasForeignKey(x => x.DriverId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ServiceTrip>()
                .WithMany()
                .HasForeignKey(x => x.TripId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ServiceAbsenceRequest>(entity =>
        {
            entity.ToTable("service_absence_requests");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.StudentId).HasColumnName("student_id");
            entity.Property(x => x.ParentId).HasColumnName("parent_id");
            entity.Property(x => x.RouteId).HasColumnName("route_id");
            entity.Property(x => x.Date).HasColumnName("date");
            entity.Property(x => x.TripType).HasColumnName("trip_type").HasConversion<string>().HasMaxLength(20);
            entity.Property(x => x.Reason).HasColumnName("reason").HasMaxLength(500);
            entity.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(30);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.StudentId, x.Date, x.TripType });
            entity.HasOne<StudentProfile>()
                .WithMany()
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(x => x.ParentId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ServiceRoute>()
                .WithMany()
                .HasForeignKey(x => x.RouteId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ExamSession>(entity =>
        {
            entity.ToTable("exam_sessions");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.PlannedExamId).HasColumnName("planned_exam_id");
            entity.Property(x => x.StudentUserId).HasColumnName("student_user_id");
            entity.Property(x => x.TeacherPreviewUserId).HasColumnName("teacher_preview_user_id");
            entity.Property(x => x.StudentName).HasColumnName("student_name").HasMaxLength(150).IsRequired();
            entity.Property(x => x.StudentUsername).HasColumnName("student_username").HasMaxLength(80).IsRequired();
            entity.Property(x => x.ClassName).HasColumnName("class_name").HasMaxLength(40).IsRequired();
            entity.Property(x => x.Title).HasColumnName("title").HasMaxLength(220).IsRequired();
            entity.Property(x => x.Subject).HasColumnName("subject").HasMaxLength(100).IsRequired();
            entity.Property(x => x.DurationSeconds).HasColumnName("duration_seconds");
            entity.Property(x => x.IsTeacherPreview).HasColumnName("is_teacher_preview");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(40).IsRequired();
            entity.Property(x => x.StartedAtUtc).HasColumnName("started_at_utc");
            entity.Property(x => x.CompletedAtUtc).HasColumnName("completed_at_utc");
            entity.HasIndex(x => new { x.TenantId, x.StudentUsername, x.Status });
            entity.HasIndex(x => x.PlannedExamId);
        });

        modelBuilder.Entity<ExamQuestion>(entity =>
        {
            entity.ToTable("exam_questions");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.PlannedExamId).HasColumnName("planned_exam_id");
            entity.Property(x => x.QuestionBankItemId).HasColumnName("question_bank_item_id");
            entity.Property(x => x.SortOrder).HasColumnName("sort_order");
            entity.Property(x => x.Point).HasColumnName("point");
            entity.HasIndex(x => new { x.PlannedExamId, x.SortOrder });
            entity.HasOne<QuestionBankItem>().WithMany().HasForeignKey(x => x.QuestionBankItemId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<QuestionAttempt>(entity =>
        {
            entity.ToTable("question_attempts");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ExamSessionId).HasColumnName("exam_session_id");
            entity.Property(x => x.QuestionBankItemId).HasColumnName("question_bank_item_id");
            entity.Property(x => x.SortOrder).HasColumnName("sort_order");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(40).IsRequired();
            entity.Property(x => x.IsFlagged).HasColumnName("is_flagged");
            entity.Property(x => x.FlagType).HasColumnName("flag_type").HasMaxLength(40).IsRequired();
            entity.Property(x => x.TimeSpentSeconds).HasColumnName("time_spent_seconds");
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
            entity.Property(x => x.LastInteractionAtUtc).HasColumnName("last_interaction_at_utc");
            entity.HasIndex(x => new { x.ExamSessionId, x.SortOrder }).IsUnique();
            entity.HasIndex(x => x.QuestionBankItemId);
            entity.HasOne<ExamSession>().WithMany().HasForeignKey(x => x.ExamSessionId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<QuestionBankItem>().WithMany().HasForeignKey(x => x.QuestionBankItemId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AnswerSelection>(entity =>
        {
            entity.ToTable("answer_selections");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.QuestionAttemptId).HasColumnName("question_attempt_id");
            entity.Property(x => x.SelectedOptionIndex).HasColumnName("selected_option_index");
            entity.Property(x => x.OpenAnswer).HasColumnName("open_answer").HasMaxLength(4000);
            entity.Property(x => x.IsCorrect).HasColumnName("is_correct");
            entity.Property(x => x.SavedAtUtc).HasColumnName("saved_at_utc");
            entity.HasIndex(x => x.QuestionAttemptId);
            entity.HasOne<QuestionAttempt>().WithMany().HasForeignKey(x => x.QuestionAttemptId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CanvasStroke>(entity =>
        {
            entity.ToTable("canvas_strokes");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.QuestionAttemptId).HasColumnName("question_attempt_id");
            entity.Property(x => x.Tool).HasColumnName("tool").HasMaxLength(40).IsRequired();
            entity.Property(x => x.Color).HasColumnName("color").HasMaxLength(24).IsRequired();
            entity.Property(x => x.Width).HasColumnName("width");
            entity.Property(x => x.Opacity).HasColumnName("opacity");
            entity.Property(x => x.Pressure).HasColumnName("pressure");
            entity.Property(x => x.PointsJson).HasColumnName("points_json").HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
            entity.HasIndex(x => new { x.QuestionAttemptId, x.CreatedAtUtc });
            entity.HasOne<QuestionAttempt>().WithMany().HasForeignKey(x => x.QuestionAttemptId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CanvasSnapshot>(entity =>
        {
            entity.ToTable("canvas_snapshots");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.QuestionAttemptId).HasColumnName("question_attempt_id");
            entity.Property(x => x.StorageKey).HasColumnName("storage_key").HasMaxLength(700).IsRequired();
            entity.Property(x => x.ContentType).HasColumnName("content_type").HasMaxLength(80).IsRequired();
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
            entity.HasIndex(x => new { x.QuestionAttemptId, x.CreatedAtUtc });
            entity.HasOne<QuestionAttempt>().WithMany().HasForeignKey(x => x.QuestionAttemptId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<StudentNote>(entity =>
        {
            entity.ToTable("student_notes");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.QuestionAttemptId).HasColumnName("question_attempt_id");
            entity.Property(x => x.Note).HasColumnName("note").HasMaxLength(4000).IsRequired();
            entity.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
            entity.HasIndex(x => x.QuestionAttemptId).IsUnique();
            entity.HasOne<QuestionAttempt>().WithMany().HasForeignKey(x => x.QuestionAttemptId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PdfReport>(entity =>
        {
            entity.ToTable("pdf_reports");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ExamSessionId).HasColumnName("exam_session_id");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(40).IsRequired();
            entity.Property(x => x.StorageKey).HasColumnName("storage_key").HasMaxLength(700);
            entity.Property(x => x.ErrorMessage).HasColumnName("error_message").HasMaxLength(1000);
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
            entity.Property(x => x.ReadyAtUtc).HasColumnName("ready_at_utc");
            entity.HasIndex(x => new { x.ExamSessionId, x.Status });
            entity.HasOne<ExamSession>().WithMany().HasForeignKey(x => x.ExamSessionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TeacherReviewComment>(entity =>
        {
            entity.ToTable("teacher_review_comments");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.QuestionAttemptId).HasColumnName("question_attempt_id");
            entity.Property(x => x.TeacherUserId).HasColumnName("teacher_user_id");
            entity.Property(x => x.TeacherName).HasColumnName("teacher_name").HasMaxLength(150).IsRequired();
            entity.Property(x => x.Comment).HasColumnName("comment").HasMaxLength(4000).IsRequired();
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
            entity.HasIndex(x => new { x.QuestionAttemptId, x.TeacherUserId });
            entity.HasOne<QuestionAttempt>().WithMany().HasForeignKey(x => x.QuestionAttemptId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ReportRecipient>(entity =>
        {
            entity.ToTable("report_recipients");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.PdfReportId).HasColumnName("pdf_report_id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.Role).HasColumnName("role").HasMaxLength(40).IsRequired();
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
            entity.HasIndex(x => new { x.PdfReportId, x.Role });
            entity.HasOne<PdfReport>().WithMany().HasForeignKey(x => x.PdfReportId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LiveExamState>(entity =>
        {
            entity.ToTable("live_exam_states");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ExamSessionId).HasColumnName("exam_session_id");
            entity.Property(x => x.ActiveQuestionAttemptId).HasColumnName("active_question_attempt_id");
            entity.Property(x => x.RemainingSeconds).HasColumnName("remaining_seconds");
            entity.Property(x => x.StatusSummaryJson).HasColumnName("status_summary_json").HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
            entity.HasIndex(x => x.ExamSessionId).IsUnique();
            entity.HasOne<ExamSession>().WithMany().HasForeignKey(x => x.ExamSessionId).OnDelete(DeleteBehavior.Cascade);
        });
    }

    private void ConfigureTenantScope<TEntity>(EntityTypeBuilder<TEntity> entity)
        where TEntity : class, ITenantScopedEntity
    {
        entity.Property(x => x.TenantId).HasColumnName("tenant_id");
        entity.HasIndex(x => x.TenantId);
        entity.HasOne<TenantWorkspace>()
            .WithMany()
            .HasForeignKey(x => x.TenantId)
            .OnDelete(DeleteBehavior.SetNull);
        entity.HasQueryFilter(x => CurrentTenantId == null || x.TenantId == CurrentTenantId);
    }

    private void ApplyTenantContext()
    {
        var tenantId = CurrentTenantId;
        if (!tenantId.HasValue)
        {
            return;
        }

        foreach (var entry in ChangeTracker.Entries<ITenantScopedEntity>())
        {
            if (entry.State == EntityState.Added && entry.Entity.TenantId is null)
            {
                entry.Entity.TenantId = tenantId;
            }
        }
    }
}
