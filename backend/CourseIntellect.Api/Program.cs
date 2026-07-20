using CourseIntellect.Infrastructure;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
using CourseIntellect.Api.Hubs;
using CourseIntellect.Api.Realtime;
using CourseIntellect.Application.Interfaces;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

// ── Claim mapping'i global olarak kapat ──────────────────────────────────────
// .NET 8+ JsonWebTokenHandler kullanır; JwtSecurityTokenHandler ayarları artık
// token OKUMA tarafını etkilemez. Her iki handler'ı da kapatalım.
JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();
JwtSecurityTokenHandler.DefaultOutboundClaimTypeMap.Clear();
JwtSecurityTokenHandler.DefaultMapInboundClaims = false;
JsonWebTokenHandler.DefaultInboundClaimTypeMap.Clear();

var builder = WebApplication.CreateBuilder(args);
const long MaxUploadSizeBytes = 10L * 1024 * 1024 * 1024;

builder.WebHost.ConfigureKestrel(options =>
{
    // Desktop WebView and dev proxy requests can stream small JSON bodies slowly.
    // Disable the minimum data rate guard in development to avoid false 408 errors.
    options.Limits.MinRequestBodyDataRate = null;
    options.Limits.MaxRequestBodySize = MaxUploadSizeBytes;
});

if (builder.Environment.IsDevelopment()
    && string.IsNullOrWhiteSpace(builder.Configuration["ASPNETCORE_URLS"])
    && string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
{
    builder.WebHost.UseUrls("http://0.0.0.0:5206");
}

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = MaxUploadSizeBytes;
    options.ValueLengthLimit = int.MaxValue;
    options.MultipartHeadersLengthLimit = int.MaxValue;
});

builder.Services.AddControllers();
// Kütüphane ISBN sorgusu (Open Library) sunucu tarafında yapılır.
builder.Services.AddHttpClient();
builder.Services.AddInfrastructure(builder.Configuration);

// EF migration araçları servis sağlayıcıyı kurarken canlı başlangıç işleri ve
// Hangfire bağlantıları çalışmamalıdır. Değişken yalnız geliştirici komutunda
// kullanılır; normal uygulama davranışını etkilemez.
var isEfDesignTime = string.Equals(Environment.GetEnvironmentVariable("COURSE_INTELLECT_EF_DESIGN_TIME"), "1", StringComparison.Ordinal);

// ─── Hangfire (arka plan zamanlanmış işler) ──────────────────────────────
// Aynı backend process'i içinde çalışır; işleri mevcut PostgreSQL'de saklar
// (ayrı altyapı yok). Pano public'e AÇILMAZ (güvenlik) — headless çalışır.
var jobsEnabled = !isEfDesignTime && (builder.Configuration.GetValue<bool?>("Jobs:Enabled") ?? true);
var hangfireConnection = Environment.GetEnvironmentVariable("COURSE_INTELLECT_DB")
    ?? builder.Configuration.GetConnectionString("DefaultConnection");
var hangfireAvailable = !isEfDesignTime && !string.IsNullOrWhiteSpace(hangfireConnection);
if (hangfireAvailable)
{
    // AddHangfire IBackgroundJobClient'ı da kaydeder → servisler işleri kuyruğa
    // atabilir. İşleyici sunucu (AddHangfireServer) ve zamanlanmış işler ise
    // Jobs:Enabled'a bağlı; kapalıyken işler kuyruğa yazılır ama işlenmez.
    builder.Services.AddHangfire(cfg => cfg
        .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
        .UseSimpleAssemblyNameTypeSerializer()
        .UseRecommendedSerializerSettings()
        .UsePostgreSqlStorage(opt => opt.UseNpgsqlConnection(hangfireConnection)));
    if (jobsEnabled)
    {
        builder.Services.AddHangfireServer();
    }
}
else
{
    // DB yoksa (beklenmez) uygulamanın DI'sı çökmesin diye no-op istemci.
    builder.Services.AddSingleton<Hangfire.IBackgroundJobClient, CourseIntellect.Infrastructure.Services.NoOpBackgroundJobClient>();
}

builder.Services.AddSignalR(options =>
{
    // Sınav canlı kamera kareleri (küçük JPEG data URL) varsayılan 32 KB sınırını
    // aşabildiği için izin verilen mesaj boyutunu yükseltiyoruz.
    options.MaximumReceiveMessageSize = 512 * 1024;
});
builder.Services.AddSingleton<IMessageRealtimeNotifier, SignalRMessageRealtimeNotifier>();
builder.Services.AddSingleton<IServiceTrackingRealtimeNotifier, SignalRServiceTrackingRealtimeNotifier>();
builder.Services.AddSingleton<IExamSolvingRealtimeNotifier, SignalRExamSolvingRealtimeNotifier>();

// ─── Hız sınırlama (auth uçları) ─────────────────────────────────────────
// Kaba kuvvet / hacimsel saldırılara karşı istemci IP'si başına "auth" politikası.
// Hedefli parola denemesini AuthService'teki hesap kilitleme durdurur; bu katman
// altyapıyı ve toplu spray'i sınırlar. Okulların tek NAT IP'sinden aynı anda çok
// sayıda meşru giriş olabildiği için sınır bilinçli olarak cömert (yapılandırılabilir).
var authRateLimitPermit = builder.Configuration.GetValue<int?>("Auth:RateLimit:PermitPerMinute") ?? 60;
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "60";
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            code = "RATE_LIMITED",
            message = "Çok fazla istek gönderildi. Lütfen bir dakika sonra tekrar deneyin.",
        }, token);
    };
    options.AddPolicy("auth", httpContext =>
        System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = authRateLimitPermit,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));
    options.AddPolicy("certificate-verification", httpContext =>
        System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));
    options.AddPolicy("photo-analysis", httpContext =>
        System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.User.FindFirstValue("user_id")
                ?? httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? httpContext.Connection.RemoteIpAddress?.ToString()
                ?? "unknown",
            factory: _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));
});

var defaultCorsOrigins = new[]
{
    // Production web/API domains
    "https://courseintellect.com",
    "https://www.courseintellect.com",
    "https://api.courseintellect.com",
    // React dev (desktop & web)
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    // Tauri dev
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "tauri://localhost",
    "https://tauri.localhost",
    // Flutter web dev
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5000",
    "http://127.0.0.1:5000"
};
var configuredCorsOrigins = builder.Configuration["Cors:AllowedOrigins"]?
    .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? Array.Empty<string>();
var allowedCorsOrigins = defaultCorsOrigins.Concat(configuredCorsOrigins).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
var allowedCorsOriginSet = new HashSet<string>(allowedCorsOrigins, StringComparer.OrdinalIgnoreCase);

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    // The API is exposed only through local Nginx/Cloudflare; allow forwarded headers from the reverse proxy path.
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("ConfiguredOrigins", policy =>
    {
        policy
            .WithOrigins(allowedCorsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection["Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    throw new InvalidOperationException(
        "Jwt:Key configuration is missing or shorter than 32 bytes. " +
        "Set it via environment variable 'Jwt__Key' or 'dotnet user-secrets set Jwt:Key <value>'.");
}
var jwtIssuer = jwtSection["Issuer"] ?? "CourseIntellect";
var jwtAudience = jwtSection["Audience"] ?? "CourseIntellectClients";

// Ayrıntılı JWT/claim tanılaması yalnız geliştirmede; üretim loglarına
// token claim'leri (kullanıcı id, rol, tenant) sızmasın.
var jwtDiagnosticsVerbose = builder.Environment.IsDevelopment();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // ── 1) Inbound claim mapping'i kapat ────────────────────────────
        // .NET 8+ varsayılan olarak JsonWebTokenHandler kullanır.
        // options.MapInboundClaims = false  bu handler üzerinde ayarlanır.
        options.MapInboundClaims = false;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            // ── 2) ClaimsIdentity'ye hangi claim tipinin rol olduğunu bildir ─
            RoleClaimType = "role",
            NameClaimType = "name"
        };

        // ── 3) Token handler üzerinde de mapping'i ayrıca garantile ─────
        // JwtBearerOptions.MapInboundClaims setter'ı TokenHandlers
        // koleksiyonundaki handler'a yansır; ama emin olmak için
        // elle de ayarlıyoruz.
        foreach (var handler in options.TokenHandlers)
        {
            if (handler is JsonWebTokenHandler jsonHandler)
            {
                jsonHandler.MapInboundClaims = false;
            }
        }

        // ── 4) Development ortamında claim'leri logla ───────────────────
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrWhiteSpace(accessToken)
                    && (path.StartsWithSegments("/hubs/messages")
                        || path.StartsWithSegments("/hubs/exam-solving")
                        || path.StartsWithSegments("/hubs/service-tracking")))
                {
                    context.Token = accessToken;
                }

                return Task.CompletedTask;
            },
            OnTokenValidated = context =>
            {
                if (!jwtDiagnosticsVerbose)
                {
                    return Task.CompletedTask;
                }

                var logger = context.HttpContext
                    .RequestServices
                    .GetRequiredService<ILoggerFactory>()
                    .CreateLogger("JwtDiagnostics");

                var identity = context.Principal?.Identity as ClaimsIdentity;
                if (identity is not null)
                {
                    logger.LogInformation(
                        "JWT validated — RoleClaimType={RoleClaimType}, NameClaimType={NameClaimType}",
                        identity.RoleClaimType,
                        identity.NameClaimType);

                    foreach (var claim in identity.Claims)
                    {
                        logger.LogInformation(
                            "  Claim: Type={Type}, Value={Value}",
                            claim.Type,
                            claim.Value);
                    }
                }

                return Task.CompletedTask;
            },
            OnAuthenticationFailed = context =>
            {
                var logger = context.HttpContext
                    .RequestServices
                    .GetRequiredService<ILoggerFactory>()
                    .CreateLogger("JwtDiagnostics");

                logger.LogWarning(
                    context.Exception,
                    "JWT authentication failed: {Message}",
                    context.Exception.Message);

                return Task.CompletedTask;
            }
        };
    });

// dotnet-ef yalnız model/factory kullanır; web host'u kurup başlangıç işleri
// çalıştırmasına gerek yoktur. Normal çalışmada değişken false olduğu için bu
// dal uygulamanın davranışını değiştirmez.
if (isEfDesignTime) return;

var app = builder.Build();

if (app.Environment.IsProduction())
{
    var publicCertificateBaseUrl = app.Configuration["CertificateVerification:PublicBaseUrl"];
    if (!Uri.TryCreate(publicCertificateBaseUrl, UriKind.Absolute, out var certificateUri) || certificateUri.Scheme != Uri.UriSchemeHttps)
        throw new InvalidOperationException("Production ortamında CertificateVerification:PublicBaseUrl geçerli bir HTTPS adresi olmalıdır.");
}

var autoMigrateDatabase = !isEfDesignTime && (builder.Configuration.GetValue<bool?>("Database:AutoMigrate") ?? true);
var seedDatabase = !isEfDesignTime && (builder.Configuration.GetValue<bool?>("Database:Seed") ?? true);

if (autoMigrateDatabase || seedDatabase)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<CourseIntellectDbContext>();
    var logger = scope.ServiceProvider
        .GetRequiredService<ILoggerFactory>()
        .CreateLogger("StartupMigration");

    if (autoMigrateDatabase)
    {
        try
        {
            await dbContext.Database.MigrateAsync();
        }
        catch (PostgresException ex) when (ex.SqlState == "42P07")
        {
            logger.LogWarning(ex, "Migration skipped because target schema objects already exist. Continuing with existing database.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException postgres && postgres.SqlState == "42P07")
        {
            logger.LogWarning(ex, "Migration skipped because target schema objects already exist. Continuing with existing database.");
        }
    }
    else
    {
        logger.LogInformation("Database auto migration is disabled by Database:AutoMigrate=false.");
    }

    if (seedDatabase)
    {
        var seeder = scope.ServiceProvider.GetRequiredService<DatabaseSeeder>();
        await seeder.SeedAsync();

        // Sürücü kursu demo verisi YALNIZCA geliştirme ortamında üretilir —
        // canlıda gerçek kurumların yanına sahte bir kurum düşmemeli.
        if (app.Environment.IsDevelopment())
        {
            var drivingSeeder = scope.ServiceProvider.GetRequiredService<DrivingSchoolSeeder>();
            await drivingSeeder.SeedAsync();
        }
    }
    else
    {
        logger.LogInformation("Database seed is disabled by Database:Seed=false.");
    }
}

// ─── Zamanlanmış işler (cron UTC; 05:00 UTC = 08:00 TR) ──────────────────
// Statik RecurringJob değil, DI'dan IRecurringJobManager kullanılır
// (JobStorage.Current bu kurulumda set edilmez).
if (jobsEnabled && !string.IsNullOrWhiteSpace(hangfireConnection))
{
    using var jobScope = app.Services.CreateScope();
    var recurringJobs = jobScope.ServiceProvider.GetRequiredService<IRecurringJobManager>();
    var utc = new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc };
    // Kütüphane iade hatırlatması: her gün 08:00 TR
    recurringJobs.AddOrUpdate<IReminderJobService>(
        "library-reminders", x => x.RunLibraryRemindersAsync(CancellationToken.None), "0 5 * * *", utc);
    // Ödeme hatırlatması: Pazartesi & Perşembe 08:00 TR (spam olmasın diye seyrek)
    recurringJobs.AddOrUpdate<IReminderJobService>(
        "finance-reminders", x => x.RunFinanceRemindersAsync(CancellationToken.None), "0 5 * * 1,4", utc);
    // Ölü push token temizliği: Pazar 03:00 UTC
    recurringJobs.AddOrUpdate<IReminderJobService>(
        "stale-push-token-cleanup", x => x.CleanupStalePushTokensAsync(CancellationToken.None), "0 3 * * 0", utc);

    // ─── Sürücü kursu hatırlatmaları ──────────────────────────────────────
    // Tüm bildirimler dedupe anahtarlı; iş tekrar çalışsa da kimse iki kez rahatsız edilmez.

    // Araç evrakı, muayene/sigorta ve bakım kilometresi: her gün 07:00 TR.
    recurringJobs.AddOrUpdate<IDrivingReminderJobService>(
        "driving-vehicle-compliance", x => x.RunVehicleComplianceRemindersAsync(CancellationToken.None), "0 4 * * *", utc);

    // Yarınki dersler için öğrenci/öğretmen hatırlatması: her gün 15:00 TR
    // (akşam üstü, ertesi güne hazırlanabilecekleri saatte).
    recurringJobs.AddOrUpdate<IDrivingReminderJobService>(
        "driving-appointment-reminders", x => x.RunAppointmentRemindersAsync(CancellationToken.None), "0 12 * * *", utc);

    // Eksik evrak, azalan ders hakkı, gecikmiş ödeme: Pazartesi & Perşembe 09:00 TR.
    recurringJobs.AddOrUpdate<IDrivingReminderJobService>(
        "driving-student-reminders", x => x.RunStudentRemindersAsync(CancellationToken.None), "0 6 * * 1,4", utc);

    // Yöneticiye günlük operasyon özeti: her gün 07:30 TR.
    recurringJobs.AddOrUpdate<IDrivingReminderJobService>(
        "driving-daily-summary", x => x.RunDailyOperationsSummaryAsync(CancellationToken.None), "30 4 * * *", utc);

    // MEBBİS/mevzuat uyumu: dönem kesim tarihi, çalışma izni, son sınav hakkı,
    // devam riski — her gün 08:00 TR (dedupe basamakları tekrarı engeller).
    recurringJobs.AddOrUpdate<IDrivingReminderJobService>(
        "driving-compliance-reminders", x => x.RunComplianceRemindersAsync(CancellationToken.None), "0 5 * * *", utc);
}

app.UseForwardedHeaders();
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseCors("ConfiguredOrigins");
// Hız sınırlama; endpoint'e özel "auth" politikasını uygulayabilmesi için
// (implicit) routing sonrası, kimlik doğrulamadan önce çalışır → gereksiz iş yapılmadan reddeder.
app.UseRateLimiter();
var staticFileContentTypes = new FileExtensionContentTypeProvider();
staticFileContentTypes.Mappings[".mp4"] = "video/mp4";
staticFileContentTypes.Mappings[".m4v"] = "video/mp4";
staticFileContentTypes.Mappings[".mov"] = "video/quicktime";
staticFileContentTypes.Mappings[".webm"] = "video/webm";
staticFileContentTypes.Mappings[".pdf"] = "application/pdf";
var uploadsRoot = UploadStoragePathResolver.ResolveUploadsRoot(app.Environment, app.Configuration);
UploadStoragePathResolver.ValidateProductionStorage(app.Environment, app.Configuration);
Directory.CreateDirectory(uploadsRoot);
UploadStoragePathResolver.CopyReleaseUploadsToShared(
    app.Environment,
    app.Configuration,
    app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("UploadStorage"));
// Müdür imzası, kurum logosunun belge kaynağı ve oluşturulan sertifikalar genel
// statik dosya uçlarından yayınlanmaz. Bunlara yalnız yetki/tenant kontrolü yapan
// sürücü kursu API'leri erişebilir. Dosya adının tahmin edilemez olması tek başına
// bir erişim kontrolü değildir.
app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value ?? string.Empty;
    if (path.StartsWith("/uploads/driving-certificate-assets/", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/uploads/driving-certificates/", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/uploads/driving-mebbis-photos/", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/uploads/driving-student-documents/", StringComparison.OrdinalIgnoreCase))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }
    await next();
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsRoot),
    RequestPath = "/uploads",
    ContentTypeProvider = staticFileContentTypes,
    OnPrepareResponse = context =>
    {
        var request = context.Context.Request;
        context.Context.Response.Headers.TryAdd("Cache-Control", "public, max-age=604800");
        context.Context.Response.Headers.TryAdd("Access-Control-Allow-Headers", "Range, Authorization, Content-Type");
        context.Context.Response.Headers.TryAdd("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");

        var origin = request.Headers["Origin"].ToString();
        if (!string.IsNullOrWhiteSpace(origin) && allowedCorsOriginSet.Contains(origin))
        {
            context.Context.Response.Headers["Access-Control-Allow-Origin"] = origin;
            context.Context.Response.Headers["Access-Control-Allow-Credentials"] = "true";
        }
    }
});
app.UseAuthentication();

// ── Claims debug middleware (sadece Development) ─────────────────────────────
// 403 sorunlarını teşhis etmek için: Authentication sonrası, Authorization
// öncesi çalışır ve ClaimsIdentity'nin tam durumunu loglar.
if (app.Environment.IsDevelopment())
{
    app.Use(async (context, next) =>
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var logger = context.RequestServices
                .GetRequiredService<ILoggerFactory>()
                .CreateLogger("ClaimsDebugMiddleware");

            var identity = context.User.Identity as ClaimsIdentity;
            logger.LogDebug(
                "Request {Method} {Path} — Authenticated={IsAuth}, " +
                "RoleClaimType={RoleClaimType}, NameClaimType={NameClaimType}",
                context.Request.Method,
                context.Request.Path,
                true,
                identity?.RoleClaimType ?? "(null)",
                identity?.NameClaimType ?? "(null)");

            if (identity is not null)
            {
                foreach (var claim in identity.Claims)
                {
                    logger.LogDebug(
                        "  [{Type}] = {Value}",
                        claim.Type,
                        claim.Value);
                }

                // IsInRole kontrolü — [Authorize(Roles = "Admin")] tam olarak bunu çağırır
                var isAdmin = context.User.IsInRole("Admin");
                logger.LogDebug("  IsInRole(\"Admin\") = {IsAdmin}", isAdmin);
            }
        }

        await next();
    });
}

app.UseAuthorization();
// Kimlik + yetki sonrası aktif kurum/şube bağlamını istek başına bir kez çöz.
app.UseMiddleware<CourseIntellect.Api.Middleware.ActiveScopeMiddleware>();
app.MapControllers();
app.MapHub<MessagesHub>("/hubs/messages");
app.MapHub<ServiceTrackingHub>("/hubs/service-tracking");
app.MapHub<ExamSolvingHub>("/hubs/exam-solving");
app.MapHub<QuestionImportHub>("/hubs/question-import");
app.MapHub<StudyPlanHub>("/hubs/study-plan");

app.Run();
