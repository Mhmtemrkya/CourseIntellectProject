using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System.Security.Claims;

namespace CourseIntellect.Infrastructure.Persistence;

public sealed class CourseIntellectDbContext : DbContext
{
    private readonly IHttpContextAccessor? httpContextAccessor;
    private readonly ITenantContext? tenantContext;
    private readonly IActiveScope? activeScope;

    private Guid? tenantOverride;

    public CourseIntellectDbContext(
        DbContextOptions<CourseIntellectDbContext> options,
        IHttpContextAccessor? httpContextAccessor = null,
        ITenantContext? tenantContext = null,
        IActiveScope? activeScope = null) : base(options)
    {
        this.httpContextAccessor = httpContextAccessor;
        this.tenantContext = tenantContext;
        this.activeScope = activeScope;
    }

    /// <summary>Arka plan işleri (Hangfire) gibi HttpContext'in olmadığı akışlarda
    /// tenant bağlamını elle set etmek için. Ayarlandığında claim'i EZER; böylece
    /// hem sorgu filtresi hem SaveChanges tenant-stamp doğru kuruma göre çalışır.
    /// İş bitince <c>null</c>'a çekilerek temizlenmeli.</summary>
    public void SetTenantOverride(Guid? tenantId) => tenantOverride = tenantId;

    public Guid? CurrentTenantId
    {
        get
        {
            if (tenantOverride is Guid overridden) return overridden;
            // Aktif tenant tek kaynaktan (ITenantContext) okunur; claim okuması yalnızca
            // context enjekte edilmemişse (ör. testlerdeki elle kurulan DbContext) fallback'tir.
            if (tenantContext is not null) return tenantContext.CurrentTenantId;
            var raw = httpContextAccessor?.HttpContext?.User?.FindFirstValue("tenant_id");
            return Guid.TryParse(raw, out var tenantId) ? tenantId : null;
        }
    }

    // Şube (branch) izolasyonu: Admin/owner tüm şubeleri görür (override header ile
    // tek şubeye odaklanabilir); diğer roller kendi şube claim'ine kilitlidir.
    // null = filtre yok (tüm şubeler / kimlik yok / atanmamış).
    public Guid? EffectiveBranchId
    {
        get
        {
            // Middleware istek başına şubeyi çözdüyse (grant + header doğrulaması dahil)
            // onu kullan. Çözülmemişse (HTTP dışı akış / middleware öncesi) eski rol/claim
            // mantığına fallback — geriye tam uyum.
            if (activeScope?.IsResolved == true) return activeScope.BranchId;

            var ctx = httpContextAccessor?.HttpContext;
            var user = ctx?.User;
            if (user?.Identity?.IsAuthenticated != true) return null;

            // BranchManager JWT'de Admin alias'ı taşır ama şubesine KİLİTLİDİR; grant'ı
            // eksik olsa bile yedek yol onu kısıtsız saymamalı (fail-closed).
            var unrestricted = (user.IsInRole("Admin") || user.IsInRole("SuperAdmin") || user.IsInRole("Developer")
                || string.Equals(user.FindFirstValue("role"), "admin", StringComparison.OrdinalIgnoreCase))
                && !user.IsInRole("BranchManager");
            if (unrestricted)
            {
                var overrideRaw = ctx?.Request?.Headers["X-Branch-Filter"].ToString();
                return Guid.TryParse(overrideRaw, out var picked) ? picked : null;
            }

            var branchRaw = user.FindFirstValue("branch_id");
            return Guid.TryParse(branchRaw, out var branchId) ? branchId : null;
        }
    }

    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<StudentProfile> Students => Set<StudentProfile>();
    public DbSet<StaffProfile> Staff => Set<StaffProfile>();
    public DbSet<AnnouncementItem> Announcements => Set<AnnouncementItem>();
    public DbSet<ExamResult> ExamResults => Set<ExamResult>();
    public DbSet<MeetingRequest> MeetingRequests => Set<MeetingRequest>();
    public DbSet<GuidanceSessionRecord> GuidanceSessions => Set<GuidanceSessionRecord>();
    public DbSet<GuidanceAppointment> GuidanceAppointments => Set<GuidanceAppointment>();
    public DbSet<GuidanceAvailabilitySlot> GuidanceAvailabilitySlots => Set<GuidanceAvailabilitySlot>();
    public DbSet<GuidanceGoal> GuidanceGoals => Set<GuidanceGoal>();
    public DbSet<GuidanceRiskReview> GuidanceRiskReviews => Set<GuidanceRiskReview>();
    public DbSet<GuidanceInventoryAssignment> GuidanceInventories => Set<GuidanceInventoryAssignment>();
    public DbSet<LibraryBook> LibraryBooks => Set<LibraryBook>();
    public DbSet<LibraryLoan> LibraryLoans => Set<LibraryLoan>();
    public DbSet<LibraryReservation> LibraryReservations => Set<LibraryReservation>();
    public DbSet<LibraryRecommendation> LibraryRecommendations => Set<LibraryRecommendation>();
    public DbSet<LibrarySettings> LibrarySettings => Set<LibrarySettings>();
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
    public DbSet<AccountingNotification> AccountingNotifications => Set<AccountingNotification>();
    public DbSet<AccountingAuditLog> AccountingAuditLogs => Set<AccountingAuditLog>();
    public DbSet<ApprovalRequest> ApprovalRequests => Set<ApprovalRequest>();
    public DbSet<AuditLogEntry> AuditLogEntries => Set<AuditLogEntry>();
    public DbSet<StaffLeaveRequest> StaffLeaveRequests => Set<StaffLeaveRequest>();
    public DbSet<StaffAssetAssignment> StaffAssetAssignments => Set<StaffAssetAssignment>();
    public DbSet<AdminDocument> AdminDocuments => Set<AdminDocument>();
    public DbSet<AdminTask> AdminTasks => Set<AdminTask>();
    public DbSet<OrgUnit> OrgUnits => Set<OrgUnit>();
    public DbSet<EnrollmentContract> EnrollmentContracts => Set<EnrollmentContract>();
    public DbSet<FinanceInstallment> FinanceInstallments => Set<FinanceInstallment>();
    public DbSet<FinancePayment> FinancePayments => Set<FinancePayment>();
    public DbSet<AttendanceEntry> AttendanceEntries => Set<AttendanceEntry>();
    public DbSet<HomeworkAssignment> HomeworkAssignments => Set<HomeworkAssignment>();
    public DbSet<HomeworkSubmission> HomeworkSubmissions => Set<HomeworkSubmission>();
    public DbSet<StudyPlanState> StudyPlanStates => Set<StudyPlanState>();
    public DbSet<RolePolicy> RolePolicies => Set<RolePolicy>();
    public DbSet<NotificationItem> Notifications => Set<NotificationItem>();
    public DbSet<PlatformConfiguration> PlatformConfigurations => Set<PlatformConfiguration>();
    public DbSet<TenantWorkspace> TenantWorkspaces => Set<TenantWorkspace>();
    public DbSet<TenantGroup> TenantGroups => Set<TenantGroup>();
    public DbSet<UserScopeGrant> UserScopeGrants => Set<UserScopeGrant>();
    public DbSet<CustomRole> CustomRoles => Set<CustomRole>();
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();
    public DbSet<RefreshTokenSession> RefreshTokenSessions => Set<RefreshTokenSession>();
    public DbSet<PasswordResetRequest> PasswordResetRequests => Set<PasswordResetRequest>();
    public DbSet<SiteContentItem> SiteContentItems => Set<SiteContentItem>();
    public DbSet<ContactMessage> ContactMessages => Set<ContactMessage>();
    public DbSet<TranslationItem> TranslationItems => Set<TranslationItem>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();
    public DbSet<CourseItem> CourseItems => Set<CourseItem>();
    public DbSet<LoginAttemptItem> LoginAttempts => Set<LoginAttemptItem>();
    public DbSet<AuthorizationCode> AuthorizationCodes => Set<AuthorizationCode>();
    public DbSet<PlatformSubscriptionInvoice> PlatformSubscriptionInvoices => Set<PlatformSubscriptionInvoice>();
    public DbSet<PushDeviceRegistration> PushDeviceRegistrations => Set<PushDeviceRegistration>();
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
    public DbSet<TeacherDuty> TeacherDuties => Set<TeacherDuty>();
    public DbSet<TeacherTimetableSlot> TeacherTimetableSlots => Set<TeacherTimetableSlot>();
    public DbSet<LiveExamState> LiveExamStates => Set<LiveExamState>();
    public DbSet<DrivingPackage> DrivingPackages => Set<DrivingPackage>();
    public DbSet<DrivingVehicle> DrivingVehicles => Set<DrivingVehicle>();
    public DbSet<DrivingInstructorProfile> DrivingInstructorProfiles => Set<DrivingInstructorProfile>();
    public DbSet<StudentDrivingProfile> StudentDrivingProfiles => Set<StudentDrivingProfile>();
    public DbSet<DrivingStudentGroup> DrivingStudentGroups => Set<DrivingStudentGroup>();
    public DbSet<StudentDrivingDocument> StudentDrivingDocuments => Set<StudentDrivingDocument>();
    public DbSet<DrivingRegistrationDraft> DrivingRegistrationDrafts => Set<DrivingRegistrationDraft>();
    public DbSet<DrivingAppointment> DrivingAppointments => Set<DrivingAppointment>();
    public DbSet<DrivingLesson> DrivingLessons => Set<DrivingLesson>();
    public DbSet<DrivingLessonLedgerEntry> DrivingLessonLedgerEntries => Set<DrivingLessonLedgerEntry>();
    public DbSet<DrivingAppointmentStatusHistory> DrivingAppointmentStatusHistory => Set<DrivingAppointmentStatusHistory>();
    public DbSet<DrivingInstructorVehicleAssignment> DrivingInstructorVehicleAssignments => Set<DrivingInstructorVehicleAssignment>();
    public DbSet<DrivingInstructorWorkingHour> DrivingInstructorWorkingHours => Set<DrivingInstructorWorkingHour>();
    public DbSet<DrivingInstructorLeave> DrivingInstructorLeaves => Set<DrivingInstructorLeave>();
    public DbSet<DrivingCharge> DrivingCharges => Set<DrivingCharge>();
    public DbSet<DrivingSchoolSettings> DrivingSchoolSettings => Set<DrivingSchoolSettings>();
    public DbSet<DrivingVehicleDocument> DrivingVehicleDocuments => Set<DrivingVehicleDocument>();
    public DbSet<DrivingVehicleServiceRecord> DrivingVehicleServiceRecords => Set<DrivingVehicleServiceRecord>();
    public DbSet<DrivingTheoryClass> DrivingTheoryClasses => Set<DrivingTheoryClass>();
    public DbSet<DrivingTheoryEnrollment> DrivingTheoryEnrollments => Set<DrivingTheoryEnrollment>();
    public DbSet<DrivingTheorySession> DrivingTheorySessions => Set<DrivingTheorySession>();
    public DbSet<DrivingTheoryAttendance> DrivingTheoryAttendances => Set<DrivingTheoryAttendance>();
    public DbSet<DrivingExamSession> DrivingExamSessions => Set<DrivingExamSession>();
    public DbSet<DrivingExamCommissionMember> DrivingExamCommissionMembers => Set<DrivingExamCommissionMember>();
    public DbSet<DrivingExamCandidate> DrivingExamCandidates => Set<DrivingExamCandidate>();
    public DbSet<DrivingGraduationRecord> DrivingGraduationRecords => Set<DrivingGraduationRecord>();
    public DbSet<DrivingCertificate> DrivingCertificates => Set<DrivingCertificate>();
    public DbSet<DrivingGraduationActionRequest> DrivingGraduationActionRequests => Set<DrivingGraduationActionRequest>();
    public DbSet<DrivingAppointmentRequest> DrivingAppointmentRequests => Set<DrivingAppointmentRequest>();

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
            ConfigureBranchScope(entity);
            entity.Property(x => x.FullName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Username).HasMaxLength(80).IsRequired();
            entity.HasIndex(x => x.Username).IsUnique();
            entity.Property(x => x.PasswordHash).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Campus).HasMaxLength(80);
            entity.Property(x => x.DepartmentOrBranch).HasMaxLength(120);
            entity.Property(x => x.ExtraRolesSerialized).HasColumnName("extra_roles").HasMaxLength(400);
            entity.Property(x => x.RoleHistorySerialized).HasColumnName("role_history").HasMaxLength(4000);
            entity.Property(x => x.MustChangePassword).HasColumnName("must_change_password").HasDefaultValue(false);
            entity.Property(x => x.CustomRoleId).HasColumnName("custom_role_id");
            entity.HasIndex(x => x.CustomRoleId);
            entity.HasOne<CustomRole>()
                .WithMany()
                .HasForeignKey(x => x.CustomRoleId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<CustomRole>(entity =>
        {
            entity.ToTable("custom_roles");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(80).IsRequired();
            entity.Property(x => x.BaseRole).HasColumnName("base_role").HasConversion<string>().HasMaxLength(40).IsRequired();
            entity.Property(x => x.ModulesSerialized).HasColumnName("modules").HasMaxLength(4000);
            entity.Property(x => x.PermissionsSerialized).HasColumnName("permissions").HasMaxLength(8000).HasDefaultValue("[]");
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
            entity.HasIndex(x => new { x.TenantId, x.Name }).IsUnique();
        });

        modelBuilder.Entity<StudentProfile>(entity =>
        {
            entity.ToTable("student_profiles");
            entity.HasKey(x => x.Id);
            ConfigureBranchScope(entity);
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
            ConfigureBranchScope(entity);
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
            entity.Property(x => x.Net).HasPrecision(6, 2);
        });

        modelBuilder.Entity<LibraryBook>(entity =>
        {
            entity.ToTable("library_books");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Title).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Author).HasMaxLength(200);
            entity.Property(x => x.Publisher).HasMaxLength(200);
            entity.Property(x => x.Isbn).HasMaxLength(20);
            entity.Property(x => x.Category).HasMaxLength(100);
            entity.Property(x => x.Shelf).HasMaxLength(50);
            entity.HasIndex(x => x.Isbn);
            entity.HasIndex(x => x.Title);
        });

        modelBuilder.Entity<LibraryLoan>(entity =>
        {
            entity.ToTable("library_loans");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.BookTitle).HasMaxLength(300);
            entity.Property(x => x.StudentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.ClassName).HasMaxLength(100);
            entity.Property(x => x.IssuedBy).HasMaxLength(150);
            entity.Property(x => x.FineAmount).HasPrecision(10, 2);
            entity.HasIndex(x => x.BookId);
            entity.HasIndex(x => x.StudentName);
        });

        modelBuilder.Entity<LibraryReservation>(entity =>
        {
            entity.ToTable("library_reservations");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.BookTitle).HasMaxLength(300);
            entity.Property(x => x.StudentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(20);
            entity.HasIndex(x => x.BookId);
        });

        modelBuilder.Entity<LibraryRecommendation>(entity =>
        {
            entity.ToTable("library_recommendations");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.BookTitle).HasMaxLength(300);
            entity.Property(x => x.TeacherName).HasMaxLength(150);
            entity.Property(x => x.StudentName).HasMaxLength(150);
            entity.Property(x => x.ClassName).HasMaxLength(100);
            entity.Property(x => x.Note).HasMaxLength(500);
        });

        modelBuilder.Entity<LibrarySettings>(entity =>
        {
            entity.ToTable("library_settings");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.FinePerDay).HasPrecision(10, 2);
        });

        modelBuilder.Entity<GuidanceSessionRecord>(entity =>
        {
            entity.ToTable("guidance_sessions");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.CounselorName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.StudentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.ClassName).HasMaxLength(100);
            entity.Property(x => x.SessionType).HasMaxLength(30);
            entity.Property(x => x.Topic).HasMaxLength(50);
            entity.Property(x => x.Visibility).HasMaxLength(20);
            entity.HasIndex(x => x.StudentName);
            entity.HasIndex(x => x.CounselorName);
        });

        modelBuilder.Entity<GuidanceAppointment>(entity =>
        {
            entity.ToTable("guidance_appointments");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.CounselorName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.RequesterName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.RequesterRole).HasMaxLength(20);
            entity.Property(x => x.StudentName).HasMaxLength(150);
            entity.Property(x => x.Slot).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(30);
            entity.HasIndex(x => x.CounselorName);
        });

        modelBuilder.Entity<GuidanceAvailabilitySlot>(entity =>
        {
            entity.ToTable("guidance_availability_slots");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.CounselorName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Slot).HasMaxLength(80).IsRequired();
            entity.HasIndex(x => x.CounselorName);
        });

        modelBuilder.Entity<GuidanceGoal>(entity =>
        {
            entity.ToTable("guidance_goals");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.StudentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.CounselorName).HasMaxLength(150);
            entity.Property(x => x.TargetSchool).HasMaxLength(200);
            entity.Property(x => x.TargetField).HasMaxLength(150);
            entity.Property(x => x.TargetScore).HasMaxLength(50);
            entity.HasIndex(x => x.StudentName).IsUnique(false);
        });

        modelBuilder.Entity<GuidanceRiskReview>(entity =>
        {
            entity.ToTable("guidance_risk_reviews");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.CounselorName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.StudentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.RiskLevel).HasMaxLength(20);
            entity.HasIndex(x => x.StudentName);
        });

        modelBuilder.Entity<GuidanceInventoryAssignment>(entity =>
        {
            entity.ToTable("guidance_inventories");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.CounselorName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.StudentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.InventoryType).HasMaxLength(50);
            entity.Property(x => x.Status).HasMaxLength(20);
            entity.HasIndex(x => x.StudentName);
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
            entity.Property(x => x.MeetingLink).HasMaxLength(500);
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
            entity.Property(x => x.CoverImageUrl).HasMaxLength(600);
            entity.Property(x => x.PlaylistKey).HasMaxLength(120);
            entity.Property(x => x.PlaylistTitle).HasMaxLength(180);
            entity.Property(x => x.AllowDownload).HasDefaultValue(true);
            entity.Property(x => x.AllowNotes).HasDefaultValue(true);
            entity.Property(x => x.CompletionCertificate).HasDefaultValue(false);
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
            entity.Property(x => x.QuestionSetKey).HasColumnName("question_set_key").HasMaxLength(120);
            entity.Property(x => x.QuestionSetTitle).HasColumnName("question_set_title").HasMaxLength(240);
            entity.Property(x => x.QuestionOrder).HasColumnName("question_order");
            entity.HasIndex(x => new { x.QuestionSetKey, x.QuestionOrder });
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

        modelBuilder.Entity<ApprovalRequest>(entity =>
        {
            entity.ToTable("approval_requests");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Category).HasMaxLength(60).IsRequired();
            entity.Property(x => x.Title).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(2000);
            entity.Property(x => x.RequesterName).HasMaxLength(150);
            entity.Property(x => x.Unit).HasMaxLength(120);
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.Priority).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.DecisionNote).HasMaxLength(2000);
            entity.Property(x => x.DecidedByName).HasMaxLength(150);
            entity.Property(x => x.ReferenceType).HasMaxLength(60);
            entity.Property(x => x.ReferenceKey).HasMaxLength(120);
            entity.HasIndex(x => new { x.TenantId, x.Status });
            entity.HasIndex(x => new { x.TenantId, x.Category });
        });

        modelBuilder.Entity<AuditLogEntry>(entity =>
        {
            entity.ToTable("audit_log_entries");
            entity.HasKey(x => x.Id);
            ConfigureBranchScope(entity);
            entity.Property(x => x.ActorName).HasMaxLength(150);
            entity.Property(x => x.Action).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Category).HasMaxLength(60).IsRequired();
            entity.Property(x => x.EntityType).HasMaxLength(80);
            entity.Property(x => x.EntityId).HasMaxLength(120);
            entity.Property(x => x.Detail).HasMaxLength(2000);
            entity.Property(x => x.BeforeValue).HasColumnName("before_value").HasMaxLength(4000);
            entity.Property(x => x.AfterValue).HasColumnName("after_value").HasMaxLength(4000);
            entity.Property(x => x.IpAddress).HasColumnName("ip_address").HasMaxLength(64);
            entity.Property(x => x.UserAgent).HasColumnName("user_agent").HasMaxLength(300);
            entity.HasIndex(x => new { x.TenantId, x.CreatedAtUtc });
            entity.HasIndex(x => new { x.TenantId, x.Category, x.CreatedAtUtc });
        });

        modelBuilder.Entity<OrgUnit>(entity =>
        {
            entity.ToTable("org_units");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Name).HasMaxLength(150).IsRequired();
            entity.Property(x => x.UnitType).HasMaxLength(40).IsRequired();
            entity.Property(x => x.ManagerName).HasMaxLength(150);
            entity.Property(x => x.ManagerUserId).HasColumnName("manager_user_id");
            entity.HasIndex(x => x.ManagerUserId);
            entity.Property(x => x.IsActive).HasColumnName("is_active").HasDefaultValue(true);
            entity.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(x => x.ManagerUserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.HasIndex(x => new { x.TenantId, x.ParentUnitId });
        });

        modelBuilder.Entity<AdminTask>(entity =>
        {
            entity.ToTable("admin_tasks");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Title).HasMaxLength(220).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(2000);
            entity.Property(x => x.Category).HasMaxLength(60).IsRequired();
            entity.Property(x => x.AssignedToName).HasMaxLength(150);
            entity.Property(x => x.Priority).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.CreatedByName).HasMaxLength(150);
            entity.Property(x => x.ResponseStatus).HasMaxLength(40).IsRequired();
            entity.Property(x => x.RejectionReason).HasMaxLength(1200);
            entity.HasIndex(x => new { x.TenantId, x.Status });
            entity.HasIndex(x => new { x.TenantId, x.AssignedToUserId });
        });

        modelBuilder.Entity<AdminDocument>(entity =>
        {
            entity.ToTable("admin_documents");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Title).HasMaxLength(220).IsRequired();
            entity.Property(x => x.Category).HasMaxLength(60).IsRequired();
            entity.Property(x => x.Direction).HasMaxLength(40).IsRequired();
            entity.Property(x => x.DocumentNo).HasMaxLength(80);
            entity.Property(x => x.RelatedParty).HasMaxLength(200);
            entity.Property(x => x.FileUrl).HasMaxLength(700);
            entity.Property(x => x.ContentType).HasMaxLength(120);
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.Property(x => x.UploadedByName).HasMaxLength(150);
            entity.HasIndex(x => new { x.TenantId, x.Category });
            entity.HasIndex(x => new { x.TenantId, x.Status });
        });

        modelBuilder.Entity<StaffLeaveRequest>(entity =>
        {
            entity.ToTable("staff_leave_requests");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.StaffName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.LeaveType).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Reason).HasMaxLength(1000);
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.DecidedByName).HasMaxLength(150);
            entity.HasIndex(x => new { x.TenantId, x.Status });
            entity.HasIndex(x => x.StaffUserId);
        });

        modelBuilder.Entity<StaffAssetAssignment>(entity =>
        {
            entity.ToTable("staff_asset_assignments");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.StaffName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.AssetName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.AssetCode).HasMaxLength(80);
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.HasIndex(x => x.StaffUserId);
        });

        modelBuilder.Entity<EnrollmentContract>(entity =>
        {
            entity.ToTable("enrollment_contracts");
            entity.HasKey(x => x.Id);
            ConfigureBranchScope(entity);
            entity.Property(x => x.StudentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.ClassName).HasMaxLength(120);
            entity.Property(x => x.AcademicYear).HasMaxLength(40);
            entity.Property(x => x.GrossAmount).HasPrecision(18, 2);
            entity.Property(x => x.DiscountAmount).HasPrecision(18, 2);
            entity.Property(x => x.DiscountReason).HasMaxLength(200);
            entity.Property(x => x.NetAmount).HasPrecision(18, 2);
            entity.Property(x => x.DownPayment).HasPrecision(18, 2);
            entity.Property(x => x.Currency).HasMaxLength(8).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(500);
            entity.HasIndex(x => x.StudentUserId);
        });

        modelBuilder.Entity<FinanceInstallment>(entity =>
        {
            entity.ToTable("finance_installments");
            entity.HasKey(x => x.Id);
            ConfigureBranchScope(entity);
            entity.Property(x => x.StudentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Label).HasMaxLength(80);
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.PaidAmount).HasPrecision(18, 2);
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Currency).HasMaxLength(8).IsRequired();
            entity.HasIndex(x => x.EnrollmentContractId);
            entity.HasIndex(x => x.StudentUserId);
        });

        modelBuilder.Entity<FinancePayment>(entity =>
        {
            entity.ToTable("finance_payments");
            entity.HasKey(x => x.Id);
            ConfigureBranchScope(entity);
            entity.Property(x => x.StudentName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.Method).HasMaxLength(40).IsRequired();
            entity.Property(x => x.ReceiptNo).HasMaxLength(40);
            entity.Property(x => x.Currency).HasMaxLength(8).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(500);
            entity.HasIndex(x => x.StudentUserId);
            entity.HasIndex(x => x.FinanceInstallmentId);
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
            ConfigureBranchScope(entity);
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
            entity.Property(x => x.InstitutionType).HasColumnName("institution_type").HasConversion<string>().HasMaxLength(40).IsRequired();
            entity.Property(x => x.DrivingSchoolModuleEnabled).HasColumnName("driving_school_module_enabled").HasDefaultValue(false);
            entity.Property(x => x.UserCount).HasColumnName("user_count");
            entity.Property(x => x.BranchCount).HasColumnName("branch_count");
            entity.Property(x => x.StudentCount).HasColumnName("student_count");
            entity.Property(x => x.StaffCount).HasColumnName("staff_count");
            entity.Property(x => x.MonthlyFee).HasColumnName("monthly_fee").HasColumnType("numeric(18,2)");
            entity.Property(x => x.CollectedAmount).HasColumnName("collected_amount").HasColumnType("numeric(18,2)");
            entity.Property(x => x.StorageUsedGb).HasColumnName("storage_used_gb").HasColumnType("numeric(18,2)");
            entity.Property(x => x.ApiUsage).HasColumnName("api_usage");
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
            entity.Property(x => x.GroupId).HasColumnName("group_id");
            entity.HasIndex(x => x.Slug).IsUnique();
            entity.HasIndex(x => x.AdminUserId);
            entity.HasIndex(x => x.GroupId);
            entity.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(x => x.AdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<TenantGroup>()
                .WithMany()
                .HasForeignKey(x => x.GroupId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<TenantGroup>(entity =>
        {
            entity.ToTable("tenant_groups");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(180).IsRequired();
            entity.Property(x => x.Slug).HasColumnName("slug").HasMaxLength(180).IsRequired();
            entity.Property(x => x.ParentGroupId).HasColumnName("parent_group_id");
            entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
            entity.Property(x => x.Note).HasColumnName("note").HasMaxLength(1000);
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
            entity.HasIndex(x => x.Slug).IsUnique();
            entity.HasIndex(x => x.OwnerUserId);
            entity.HasIndex(x => x.ParentGroupId);
            entity.HasOne<TenantGroup>()
                .WithMany()
                .HasForeignKey(x => x.ParentGroupId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Cross-cutting erişim tablosu: KASITLI olarak tenant query filter'sız.
        // Platform/Group grant'ları birden çok kuruma yayıldığından filtrelenmemeli.
        modelBuilder.Entity<UserScopeGrant>(entity =>
        {
            entity.ToTable("user_scope_grants");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.UserId).HasColumnName("user_id").IsRequired();
            entity.Property(x => x.Level).HasColumnName("level").HasConversion<string>().HasMaxLength(20).IsRequired();
            entity.Property(x => x.TargetId).HasColumnName("target_id");
            entity.Property(x => x.AccessMode).HasColumnName("access_mode").HasConversion<string>().HasMaxLength(20).IsRequired();
            entity.Property(x => x.IsHome).HasColumnName("is_home");
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
            entity.HasIndex(x => new { x.UserId, x.Level });
            entity.HasIndex(x => new { x.UserId, x.TargetId });
            entity.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
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
            entity.Property(x => x.TargetUserId).HasColumnName("target_user_id");
            entity.Property(x => x.DedupeKey).HasColumnName("dedupe_key").HasMaxLength(150);
            entity.Property(x => x.RelatedEntityType).HasColumnName("related_entity_type").HasMaxLength(80);
            entity.Property(x => x.RelatedEntityId).HasColumnName("related_entity_id").HasMaxLength(80);
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
            entity.HasIndex(x => new { x.TenantId, x.TargetUserId, x.IsRead });
            // Tekrar engeli sorgusu bu indeksten geçer.
            entity.HasIndex(x => new { x.DedupeKey, x.CreatedAtUtc });
        });

        modelBuilder.Entity<RefreshTokenSession>(entity =>
        {
            entity.ToTable("refresh_token_sessions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.TokenHash).IsUnique();
            entity.Property(x => x.TokenHash).HasMaxLength(300).IsRequired();
        });

        modelBuilder.Entity<PasswordResetRequest>(entity =>
        {
            entity.ToTable("password_reset_requests");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.RequestedEmail).HasColumnName("requested_email").HasMaxLength(180).IsRequired();
            entity.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(150).IsRequired();
            entity.Property(x => x.Username).HasColumnName("username").HasMaxLength(80).IsRequired();
            entity.Property(x => x.PrimaryRole).HasColumnName("primary_role").HasMaxLength(40).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.ReviewNote).HasColumnName("review_note").HasMaxLength(600).IsRequired();
            entity.Property(x => x.ReviewedByUserId).HasColumnName("reviewed_by_user_id");
            entity.Property(x => x.ReviewedByName).HasColumnName("reviewed_by_name").HasMaxLength(150).IsRequired();
            entity.Property(x => x.RequestedAtUtc).HasColumnName("requested_at_utc");
            entity.Property(x => x.ReviewedAtUtc).HasColumnName("reviewed_at_utc");
            entity.Property(x => x.TemporaryPasswordCreatedAtUtc).HasColumnName("temporary_password_created_at_utc");
            entity.Property(x => x.ExpiresAtUtc).HasColumnName("expires_at_utc");
            entity.Property(x => x.UsedAtUtc).HasColumnName("used_at_utc");
            entity.HasIndex(x => new { x.TenantId, x.Status, x.RequestedAtUtc });
            entity.HasIndex(x => new { x.TenantId, x.RequestedEmail });
            entity.HasIndex(x => new { x.UserId, x.Status });
            entity.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(x => x.ReviewedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<SiteContentItem>(entity =>
        {
            entity.ToTable("site_content_items");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.SectionKey).HasMaxLength(120).IsRequired();
            entity.Property(x => x.ContentJson).HasColumnType("text").IsRequired();
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

        modelBuilder.Entity<PushDeviceRegistration>(entity =>
        {
            entity.ToTable("push_device_registrations");
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.Token).HasColumnName("token").HasMaxLength(500).IsRequired();
            entity.Property(x => x.Platform).HasColumnName("platform").HasMaxLength(40).IsRequired();
            entity.Property(x => x.Username).HasColumnName("username").HasMaxLength(120).IsRequired();
            entity.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(180).IsRequired();
            entity.Property(x => x.Role).HasColumnName("role").HasMaxLength(60).IsRequired();
            entity.Property(x => x.DeviceId).HasColumnName("device_id").HasMaxLength(200).IsRequired();
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
            entity.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
            entity.Property(x => x.LastSeenAtUtc).HasColumnName("last_seen_at_utc");
            entity.HasIndex(x => x.Token).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.UserId, x.IsActive });
            entity.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
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
            entity.Property(x => x.VehicleNumber).HasColumnName("vehicle_number").HasMaxLength(40);
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
            ConfigureBranchScope(entity);
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

        modelBuilder.Entity<DrivingPackage>(entity =>
        {
            entity.ToTable("driving_packages"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.Name).HasMaxLength(140).IsRequired();
            entity.Property(x => x.LicenseClass).HasMaxLength(20).IsRequired();
            entity.Property(x => x.TransmissionType).HasConversion<string>().HasMaxLength(20);
            entity.Property(x => x.Price).HasColumnType("numeric(18,2)");
            entity.HasIndex(x => new { x.TenantId, x.Name }).IsUnique();
        });
        modelBuilder.Entity<DrivingVehicle>(entity =>
        {
            entity.ToTable("driving_vehicles"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.PlateNumber).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Brand).HasMaxLength(80).IsRequired(); entity.Property(x => x.Model).HasMaxLength(80).IsRequired();
            entity.Property(x => x.LicenseClass).HasMaxLength(20).IsRequired();
            entity.Property(x => x.TransmissionType).HasConversion<string>().HasMaxLength(20);
            entity.HasIndex(x => new { x.TenantId, x.PlateNumber }).IsUnique();
        });
        modelBuilder.Entity<DrivingInstructorProfile>(entity =>
        {
            entity.ToTable("driving_instructor_profiles"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.LicenseClasses).HasMaxLength(200).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.StaffId }).IsUnique();
            entity.HasOne<StaffProfile>().WithMany().HasForeignKey(x => x.StaffId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<DrivingStudentGroup>(entity =>
        {
            entity.ToTable("driving_student_groups"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.Name).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(500);
            entity.HasIndex(x => new { x.TenantId, x.Name }).IsUnique();
        });
        modelBuilder.Entity<StudentDrivingProfile>(entity =>
        {
            entity.ToTable("student_driving_profiles"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.LicenseClass).HasMaxLength(20).IsRequired();
            entity.Property(x => x.TransmissionType).HasConversion<string>().HasMaxLength(20);
            // Durum string olarak saklanır: mevcut "Active" satırları enum'a sorunsuz eşlenir.
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(40).IsRequired();
            entity.Property(x => x.IdentityKind).HasConversion<string>().HasMaxLength(20);
            entity.Property(x => x.DrivingExperience).HasConversion<string>().HasMaxLength(20);
            entity.Property(x => x.IdentityNumber).HasMaxLength(40);
            entity.Property(x => x.Nationality).HasMaxLength(60);
            entity.Property(x => x.Gender).HasMaxLength(20);
            entity.Property(x => x.BloodType).HasMaxLength(10);
            entity.Property(x => x.Occupation).HasMaxLength(80);
            entity.Property(x => x.EducationLevel).HasMaxLength(60);
            entity.Property(x => x.City).HasMaxLength(60);
            entity.Property(x => x.District).HasMaxLength(60);
            entity.Property(x => x.ResidenceAddress).HasMaxLength(500);
            entity.Property(x => x.WhatsAppPhone).HasMaxLength(30);
            entity.Property(x => x.EmergencyContactName).HasMaxLength(120);
            entity.Property(x => x.EmergencyContactPhone).HasMaxLength(30);
            entity.Property(x => x.PhotoUrl).HasMaxLength(400);
            entity.Property(x => x.LivePhotoUrl).HasMaxLength(400);
            entity.Property(x => x.ExistingLicenseNumber).HasMaxLength(40);
            entity.Property(x => x.ExistingLicenseClasses).HasMaxLength(60);
            entity.Property(x => x.LicenseIssuePlace).HasMaxLength(120);
            entity.Property(x => x.SignatureUrl).HasMaxLength(400);
            entity.Property(x => x.AccessibilityNotes).HasMaxLength(1000);
            entity.HasIndex(x => new { x.TenantId, x.StudentId }).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.Status });
            entity.HasIndex(x => x.StudentGroupId);
            entity.HasOne<StudentProfile>().WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<DrivingPackage>().WithMany().HasForeignKey(x => x.PackageId).OnDelete(DeleteBehavior.Restrict);
            // Grup silinirse kursiyer grupsuz kalır (dosyası silinmez).
            entity.HasOne<DrivingStudentGroup>().WithMany().HasForeignKey(x => x.StudentGroupId).OnDelete(DeleteBehavior.SetNull);
        });
        modelBuilder.Entity<StudentDrivingDocument>(entity =>
        {
            entity.ToTable("student_driving_documents"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.DocumentType).HasConversion<string>().HasMaxLength(40).IsRequired();
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(30).IsRequired();
            entity.Property(x => x.FileUrl).HasMaxLength(400).IsRequired();
            entity.Property(x => x.FileName).HasMaxLength(200);
            entity.Property(x => x.DocumentNumber).HasMaxLength(100);
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.Property(x => x.RejectionReason).HasMaxLength(500);
            // Bir belge türünün yalnız bir geçerli sürümü olabilir.
            entity.HasIndex(x => new { x.StudentDrivingProfileId, x.DocumentType, x.IsCurrent });
            entity.HasOne<StudentDrivingProfile>().WithMany().HasForeignKey(x => x.StudentDrivingProfileId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<DrivingRegistrationDraft>(entity =>
        {
            entity.ToTable("driving_registration_drafts"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.DisplayName).HasMaxLength(150);
            entity.Property(x => x.PayloadJson).HasMaxLength(20000).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.CreatedByUserId, x.UpdatedAtUtc });
        });
        modelBuilder.Entity<DrivingAppointment>(entity =>
        {
            entity.ToTable("driving_appointments"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.HasIndex(x => new { x.TenantId, x.StartsAtUtc, x.EndsAtUtc });
            entity.HasIndex(x => new { x.VehicleId, x.StartsAtUtc, x.EndsAtUtc });
            entity.HasIndex(x => new { x.InstructorProfileId, x.StartsAtUtc, x.EndsAtUtc });
            entity.HasOne<StudentDrivingProfile>().WithMany().HasForeignKey(x => x.StudentDrivingProfileId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<DrivingInstructorProfile>().WithMany().HasForeignKey(x => x.InstructorProfileId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<DrivingVehicle>().WithMany().HasForeignKey(x => x.VehicleId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<DrivingLesson>(entity =>
        {
            entity.ToTable("driving_lessons"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.PreCheckNote).HasMaxLength(1000);
            entity.Property(x => x.InstructorNote).HasMaxLength(2000);
            entity.Property(x => x.EvaluationScoresJson).HasColumnName("evaluation_scores_json").HasColumnType("jsonb").HasDefaultValue("{}").IsRequired();
            entity.Property(x => x.EvaluationVersion).HasColumnName("evaluation_version").HasDefaultValue(0);
            entity.HasIndex(x => new { x.TenantId, x.AppointmentId }).IsUnique();
            entity.HasIndex(x => new { x.StudentDrivingProfileId, x.StartedAtUtc });
            entity.HasOne<DrivingAppointment>().WithMany().HasForeignKey(x => x.AppointmentId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<StudentDrivingProfile>().WithMany().HasForeignKey(x => x.StudentDrivingProfileId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<DrivingInstructorProfile>().WithMany().HasForeignKey(x => x.InstructorProfileId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<DrivingVehicle>().WithMany().HasForeignKey(x => x.VehicleId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<DrivingLessonLedgerEntry>(entity =>
        {
            entity.ToTable("driving_lesson_ledger_entries"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.EntryType).HasConversion<string>().HasMaxLength(40).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(500).IsRequired();
            entity.Property(x => x.Reason).HasMaxLength(500);
            // Bir dersin yalnız bir kullanım hareketi olabilir (çift işleme karşı).
            // PostgreSQL birden çok NULL'a izin verir; rezervasyon/düzeltme satırları etkilenmez.
            entity.HasIndex(x => new { x.TenantId, x.DrivingLessonId }).IsUnique();
            entity.HasIndex(x => new { x.StudentDrivingProfileId, x.CreatedAtUtc });
            entity.HasIndex(x => x.AppointmentId);
            entity.HasOne<StudentDrivingProfile>().WithMany().HasForeignKey(x => x.StudentDrivingProfileId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<DrivingLesson>().WithMany().HasForeignKey(x => x.DrivingLessonId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<DrivingAppointment>().WithMany().HasForeignKey(x => x.AppointmentId).OnDelete(DeleteBehavior.SetNull);
        });
        modelBuilder.Entity<DrivingAppointmentStatusHistory>(entity =>
        {
            entity.ToTable("driving_appointment_status_history"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.FromStatus).HasConversion<string>().HasMaxLength(30);
            entity.Property(x => x.ToStatus).HasConversion<string>().HasMaxLength(30).IsRequired();
            entity.Property(x => x.ChangedByName).HasMaxLength(150);
            entity.Property(x => x.Reason).HasMaxLength(500);
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.HasIndex(x => new { x.AppointmentId, x.CreatedAtUtc });
            entity.HasOne<DrivingAppointment>().WithMany().HasForeignKey(x => x.AppointmentId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<DrivingSchoolSettings>(entity =>
        {
            entity.ToTable("driving_school_settings"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.FinancialHoldThreshold).HasPrecision(18, 2);
            entity.Property(x => x.MinimumTheoryAttendancePercent).HasPrecision(5, 2);
            entity.Property(x => x.ExcusedAbsencePolicy).HasConversion<string>().HasMaxLength(40);
            entity.Property(x => x.CertificateDirectorName).HasMaxLength(150);
            entity.Property(x => x.CertificateDirectorTitle).HasMaxLength(100);
            entity.Property(x => x.CertificateLogoUrl).HasMaxLength(700);
            entity.Property(x => x.CertificateSignatureUrl).HasMaxLength(700);
            entity.Property(x => x.CertificatePrimaryColor).HasMaxLength(20);
            entity.HasIndex(x => x.TenantId).IsUnique();
        });
        modelBuilder.Entity<DrivingInstructorVehicleAssignment>(entity =>
        {
            entity.ToTable("driving_instructor_vehicle_assignments"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.AssignmentType).HasConversion<string>().HasMaxLength(30).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(500);
            entity.HasIndex(x => new { x.InstructorProfileId, x.IsActive });
            entity.HasIndex(x => new { x.VehicleId, x.IsActive });
            entity.HasOne<DrivingInstructorProfile>().WithMany().HasForeignKey(x => x.InstructorProfileId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<DrivingVehicle>().WithMany().HasForeignKey(x => x.VehicleId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<DrivingInstructorWorkingHour>(entity =>
        {
            entity.ToTable("driving_instructor_working_hours"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.DayOfWeek).HasConversion<string>().HasMaxLength(20).IsRequired();
            entity.HasIndex(x => new { x.InstructorProfileId, x.DayOfWeek });
            entity.HasOne<DrivingInstructorProfile>().WithMany().HasForeignKey(x => x.InstructorProfileId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<DrivingCharge>(entity =>
        {
            entity.ToTable("driving_charges"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.ChargeType).HasConversion<string>().HasMaxLength(40).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(500);
            entity.Property(x => x.DiscountReason).HasMaxLength(300);
            entity.Property(x => x.RefundReason).HasMaxLength(500);
            entity.Property(x => x.GrossAmount).HasPrecision(18, 2);
            entity.Property(x => x.DiscountAmount).HasPrecision(18, 2);
            entity.Property(x => x.NetAmount).HasPrecision(18, 2);
            entity.Property(x => x.RefundedAmount).HasPrecision(18, 2);
            entity.HasIndex(x => new { x.StudentDrivingProfileId, x.CreatedAtUtc });
            entity.HasOne<StudentDrivingProfile>().WithMany().HasForeignKey(x => x.StudentDrivingProfileId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<DrivingInstructorLeave>(entity =>
        {
            entity.ToTable("driving_instructor_leaves"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.LeaveType).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Reason).HasMaxLength(500);
            entity.HasIndex(x => new { x.InstructorProfileId, x.StartsAtUtc, x.EndsAtUtc });
            entity.HasOne<DrivingInstructorProfile>().WithMany().HasForeignKey(x => x.InstructorProfileId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<DrivingVehicleDocument>(entity =>
        {
            entity.ToTable("driving_vehicle_documents"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.DocumentType).HasMaxLength(50).IsRequired();
            entity.Property(x => x.DocumentNumber).HasMaxLength(100).IsRequired();
            entity.Property(x => x.FileUrl).HasMaxLength(700).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.HasIndex(x => new { x.TenantId, x.VehicleId, x.DocumentType, x.ExpiresAtUtc });
            entity.HasOne<DrivingVehicle>().WithMany().HasForeignKey(x => x.VehicleId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<DrivingVehicleServiceRecord>(entity =>
        {
            entity.ToTable("driving_vehicle_service_records"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.RecordType).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Title).HasMaxLength(180).IsRequired();
            entity.Property(x => x.ServiceProvider).HasMaxLength(180);
            entity.Property(x => x.Description).HasMaxLength(2000);
            entity.Property(x => x.Priority).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Resolution).HasMaxLength(2000);
            entity.Property(x => x.LaborCost).HasColumnType("numeric(18,2)");
            entity.Property(x => x.PartsCost).HasColumnType("numeric(18,2)");
            entity.HasIndex(x => new { x.TenantId, x.VehicleId, x.Status });
            entity.HasIndex(x => new { x.NextServiceAtUtc, x.NextServiceKilometer });
            entity.HasOne<DrivingVehicle>().WithMany().HasForeignKey(x => x.VehicleId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<DrivingTheoryClass>(entity =>
        {
            entity.ToTable("driving_theory_classes"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.Name).HasMaxLength(150).IsRequired(); entity.Property(x => x.LicenseClass).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Room).HasMaxLength(100); entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
            entity.HasIndex(x => new { x.InstructorStaffId, x.StartsAtUtc });
            entity.HasOne<StaffProfile>().WithMany().HasForeignKey(x => x.InstructorStaffId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<DrivingTheoryEnrollment>(entity =>
        {
            entity.ToTable("driving_theory_enrollments"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.HasIndex(x => new { x.TheoryClassId, x.StudentDrivingProfileId }).IsUnique();
            entity.HasOne<DrivingTheoryClass>().WithMany().HasForeignKey(x => x.TheoryClassId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<StudentDrivingProfile>().WithMany().HasForeignKey(x => x.StudentDrivingProfileId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<DrivingTheorySession>(entity =>
        {
            entity.ToTable("driving_theory_sessions"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.Subject).HasMaxLength(120).IsRequired(); entity.Property(x => x.Topic).HasMaxLength(250).IsRequired();
            entity.Property(x => x.Room).HasMaxLength(100); entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
            entity.HasIndex(x => new { x.TheoryClassId, x.StartsAtUtc }); entity.HasIndex(x => new { x.InstructorStaffId, x.StartsAtUtc });
            entity.HasOne<DrivingTheoryClass>().WithMany().HasForeignKey(x => x.TheoryClassId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<StaffProfile>().WithMany().HasForeignKey(x => x.InstructorStaffId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<DrivingTheoryAttendance>(entity =>
        {
            entity.ToTable("driving_theory_attendances"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(30); entity.Property(x => x.Note).HasMaxLength(500);
            entity.HasIndex(x => new { x.TheorySessionId, x.StudentDrivingProfileId }).IsUnique();
            entity.HasOne<DrivingTheorySession>().WithMany().HasForeignKey(x => x.TheorySessionId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<StudentDrivingProfile>().WithMany().HasForeignKey(x => x.StudentDrivingProfileId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<DrivingExamSession>(entity =>
        {
            entity.ToTable("driving_exam_sessions"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.ExamType).HasConversion<string>().HasMaxLength(30); entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
            entity.Property(x => x.Title).HasMaxLength(180).IsRequired(); entity.Property(x => x.Location).HasMaxLength(250).IsRequired();
            entity.HasIndex(x => new { x.ExamType, x.StartsAtUtc });
        });
        modelBuilder.Entity<DrivingExamCommissionMember>(entity =>
        {
            entity.ToTable("driving_exam_commission_members"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.FullName).HasMaxLength(150).IsRequired(); entity.Property(x => x.Role).HasMaxLength(100).IsRequired(); entity.Property(x => x.Organization).HasMaxLength(150);
            entity.HasIndex(x => x.ExamSessionId);
            entity.HasOne<DrivingExamSession>().WithMany().HasForeignKey(x => x.ExamSessionId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<DrivingExamCandidate>(entity =>
        {
            entity.ToTable("driving_exam_candidates"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(30); entity.Property(x => x.Score).HasPrecision(6, 2);
            entity.Property(x => x.FailureReason).HasMaxLength(500); entity.Property(x => x.ResultNote).HasMaxLength(1000);
            entity.HasIndex(x => new { x.ExamSessionId, x.StudentDrivingProfileId }).IsUnique(); entity.HasIndex(x => new { x.StudentDrivingProfileId, x.AttemptNo });
            entity.HasOne<DrivingExamSession>().WithMany().HasForeignKey(x => x.ExamSessionId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<StudentDrivingProfile>().WithMany().HasForeignKey(x => x.StudentDrivingProfileId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<DrivingExamCandidate>().WithMany().HasForeignKey(x => x.PreviousCandidateId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<DrivingCharge>().WithMany().HasForeignKey(x => x.DrivingChargeId).OnDelete(DeleteBehavior.SetNull);
        });
        modelBuilder.Entity<DrivingGraduationRecord>(entity =>
        {
            entity.ToTable("driving_graduation_records"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
            entity.Property(x => x.ChecklistJson).HasColumnType("jsonb"); entity.Property(x => x.Note).HasMaxLength(1000);
            entity.Property(x => x.RevocationReason).HasMaxLength(1000);
            entity.HasIndex(x => x.StudentDrivingProfileId).IsUnique();
            entity.HasOne<StudentDrivingProfile>().WithMany().HasForeignKey(x => x.StudentDrivingProfileId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<DrivingCertificate>(entity =>
        {
            entity.ToTable("driving_certificates"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.CertificateType).HasConversion<string>().HasMaxLength(30);
            entity.Property(x => x.DeliveryStatus).HasConversion<string>().HasMaxLength(30);
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
            entity.Property(x => x.DocumentNumber).HasMaxLength(80).IsRequired();
            entity.Property(x => x.DeliveredTo).HasMaxLength(150); entity.Property(x => x.DeliveryNote).HasMaxLength(500);
            entity.Property(x => x.ReissueReason).HasMaxLength(1000);
            entity.Property(x => x.VerificationTokenHash).HasMaxLength(64).IsRequired();
            entity.Property(x => x.PdfFileUrl).HasMaxLength(700);
            entity.Property(x => x.SnapshotJson).HasColumnType("jsonb");
            entity.Property(x => x.RevocationReason).HasMaxLength(1000);
            entity.HasIndex(x => new { x.TenantId, x.DocumentNumber }).IsUnique();
            entity.HasIndex(x => x.VerificationTokenHash).IsUnique();
            entity.HasIndex(x => x.StudentDrivingProfileId);
            entity.HasOne<DrivingGraduationRecord>().WithMany().HasForeignKey(x => x.GraduationRecordId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<StudentDrivingProfile>().WithMany().HasForeignKey(x => x.StudentDrivingProfileId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<DrivingCertificate>().WithMany().HasForeignKey(x => x.ReissuedFromCertificateId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<DrivingGraduationActionRequest>(entity =>
        {
            entity.ToTable("driving_graduation_action_requests"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.ActionType).HasConversion<string>().HasMaxLength(40);
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
            entity.Property(x => x.RequestedChecklistKeysJson).HasColumnType("jsonb");
            entity.Property(x => x.Reason).HasMaxLength(1500).IsRequired();
            entity.Property(x => x.DecisionNote).HasMaxLength(1000);
            entity.HasIndex(x => new { x.StudentDrivingProfileId, x.Status, x.RequestedAtUtc });
            entity.HasOne<StudentDrivingProfile>().WithMany().HasForeignKey(x => x.StudentDrivingProfileId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<DrivingGraduationRecord>().WithMany().HasForeignKey(x => x.GraduationRecordId).OnDelete(DeleteBehavior.SetNull);
        });
        modelBuilder.Entity<DrivingAppointmentRequest>(entity =>
        {
            entity.ToTable("driving_appointment_requests"); entity.HasKey(x => x.Id); ConfigureTenantScope(entity);
            entity.Property(x => x.RequestType).HasConversion<string>().HasMaxLength(30);
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
            entity.Property(x => x.MeetingPoint).HasMaxLength(300); entity.Property(x => x.StudentNote).HasMaxLength(500); entity.Property(x => x.DecisionNote).HasMaxLength(500);
            entity.HasIndex(x => new { x.StudentDrivingProfileId, x.Status, x.CreatedAtUtc });
            entity.HasOne<StudentDrivingProfile>().WithMany().HasForeignKey(x => x.StudentDrivingProfileId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<DrivingAppointment>().WithMany().HasForeignKey(x => x.SourceAppointmentId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<DrivingAppointment>().WithMany().HasForeignKey(x => x.ResultAppointmentId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<DrivingInstructorProfile>().WithMany().HasForeignKey(x => x.PreferredInstructorProfileId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<DrivingVehicle>().WithMany().HasForeignKey(x => x.PreferredVehicleId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<TeacherDuty>(entity =>
        {
            entity.HasKey(x => x.Id);
            ConfigureBranchScope(entity);
        });

        modelBuilder.Entity<TeacherTimetableSlot>(entity =>
        {
            entity.HasKey(x => x.Id);
            ConfigureTenantScope(entity);
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

    // Tenant + şube izolasyonu: çekirdek operasyonel entity'ler için. Tek query
    // filter'da hem tenant hem şube koşulu birleştirilir (EF entity başına tek filtre).
    private void ConfigureBranchScope<TEntity>(EntityTypeBuilder<TEntity> entity)
        where TEntity : class, IBranchScopedEntity
    {
        entity.Property(x => x.TenantId).HasColumnName("tenant_id");
        entity.HasIndex(x => x.TenantId);
        entity.HasOne<TenantWorkspace>()
            .WithMany()
            .HasForeignKey(x => x.TenantId)
            .OnDelete(DeleteBehavior.SetNull);
        entity.Property(x => x.BranchId).HasColumnName("branch_id");
        entity.HasIndex(x => x.BranchId);
        entity.HasQueryFilter(x =>
            (CurrentTenantId == null || x.TenantId == CurrentTenantId)
            && (EffectiveBranchId == null || x.BranchId == EffectiveBranchId));
    }

    private void ApplyTenantContext()
    {
        var tenantId = CurrentTenantId;
        if (tenantId.HasValue)
        {
            foreach (var entry in ChangeTracker.Entries<ITenantScopedEntity>())
            {
                if (entry.State == EntityState.Added && entry.Entity.TenantId is null)
                {
                    entry.Entity.TenantId = tenantId;
                }
            }
        }

        // Şube stamp: kayıt akışları açıkça set etmediyse, aktörün etkin şubesine düş.
        var branchId = EffectiveBranchId;
        if (branchId.HasValue)
        {
            foreach (var entry in ChangeTracker.Entries<IBranchScopedEntity>())
            {
                if (entry.State == EntityState.Added && entry.Entity.BranchId is null)
                {
                    entry.Entity.BranchId = branchId;
                }
            }
        }

        // Home-grant: yeni eklenen her kullanıcıya (TenantId/BranchId stamp'lendikten SONRA)
        // otomatik "ev" grant'ı. Tüm oluşturma yollarını tek noktadan kapsar. İdempotent:
        // yalnız Added durumundaki kullanıcı için üretilir.
        var addedUsers = ChangeTracker.Entries<AppUser>()
            .Where(e => e.State == EntityState.Added)
            .Select(e => e.Entity)
            .ToList();
        foreach (var user in addedUsers)
        {
            UserScopeGrants.Add(UserScopeGrant.CreateHome(user));
        }
    }
}
