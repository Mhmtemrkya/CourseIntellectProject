using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Auth;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace CourseIntellect.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = Environment.GetEnvironmentVariable("COURSE_INTELLECT_DB")
            ?? configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString) || connectionString.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Veritabanı bağlantısı ayarlı değil. COURSE_INTELLECT_DB veya ConnectionStrings:DefaultConnection yapılandırılmalı.");
        }
        var jwtSection = configuration.GetSection(JwtOptions.SectionName);
        var jwtOptions = new JwtOptions
        {
            Issuer = jwtSection["Issuer"] ?? "CourseIntellect",
            Audience = jwtSection["Audience"] ?? "CourseIntellectClients",
            Key = jwtSection["Key"] ?? "CourseIntellect-Super-Secret-Key-Change-In-Production-2026",
            AccessTokenMinutes = int.TryParse(jwtSection["AccessTokenMinutes"], out var minutes) ? minutes : 480
        };

        services.AddSingleton<IOptions<JwtOptions>>(Options.Create(jwtOptions));
        services.AddHttpContextAccessor();
        services.AddDbContext<CourseIntellectDbContext>(options =>
            options.UseNpgsql(connectionString));

        services.AddScoped<DatabaseSeeder>();
        services.AddHostedService<RejectedTenantCleanupService>();
        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserDirectoryService, UserDirectoryService>();
        services.AddScoped<IAcademicQueryService, AcademicQueryService>();
        services.AddScoped<IAttendanceService, AttendanceService>();
        services.AddScoped<IStudyPlanService, StudyPlanService>();
        services.AddScoped<IAnnouncementQueryService, AnnouncementQueryService>();
        services.AddScoped<IMeetingRequestService, MeetingRequestService>();
        services.AddScoped<IMessageService, MessageService>();
        services.AddScoped<IContentService, ContentService>();
        services.AddScoped<IQuestionBankService, QuestionBankService>();
        services.AddScoped<IQuestionThreadService, QuestionThreadService>();
        services.AddScoped<IHomeworkService, HomeworkService>();
        services.AddScoped<IFileStorageService, LocalFileStorageService>();
        services.AddScoped<IAccountingService, AccountingService>();
        services.AddScoped<IStaffManagementService, StaffManagementService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IPlatformConfigurationService, PlatformConfigurationService>();
        services.AddScoped<IPlatformOperationsService, PlatformOperationsService>();
        services.AddScoped<IPlatformSubscriptionService, PlatformSubscriptionService>();
        services.AddScoped<ISiteContentService, SiteContentService>();
        services.AddScoped<IContactMessageService, ContactMessageService>();
        services.AddScoped<ITranslationService, TranslationService>();
        services.AddScoped<IAppSettingService, AppSettingService>();
        services.AddScoped<ISystemService, SystemService>();
        services.AddScoped<ICourseService, CourseService>();
        services.AddScoped<ILoginAttemptService, LoginAttemptService>();
        services.AddScoped<IDashboardService, DashboardService>();

        return services;
    }
}
