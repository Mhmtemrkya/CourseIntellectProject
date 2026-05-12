using CourseIntellect.Infrastructure;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Api.Hubs;
using CourseIntellect.Api.Realtime;
using CourseIntellect.Application.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
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

builder.WebHost.ConfigureKestrel(options =>
{
    // Desktop WebView and dev proxy requests can stream small JSON bodies slowly.
    // Disable the minimum data rate guard in development to avoid false 408 errors.
    options.Limits.MinRequestBodyDataRate = null;
});

if (builder.Environment.IsDevelopment()
    && string.IsNullOrWhiteSpace(builder.Configuration["ASPNETCORE_URLS"])
    && string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
{
    builder.WebHost.UseUrls("http://0.0.0.0:5206");
}

builder.Services.AddControllers();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddSignalR();
builder.Services.AddSingleton<IMessageRealtimeNotifier, SignalRMessageRealtimeNotifier>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("DesktopDev", policy =>
    {
        policy
            .WithOrigins(
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
                "http://127.0.0.1:5000")
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
                if (!string.IsNullOrWhiteSpace(accessToken) && path.StartsWithSegments("/hubs/messages"))
                {
                    context.Token = accessToken;
                }

                return Task.CompletedTask;
            },
            OnTokenValidated = context =>
            {
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

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<CourseIntellectDbContext>();
    var logger = scope.ServiceProvider
        .GetRequiredService<ILoggerFactory>()
        .CreateLogger("StartupMigration");

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

    var seeder = scope.ServiceProvider.GetRequiredService<DatabaseSeeder>();
    await seeder.SeedAsync();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseStaticFiles();
app.UseCors("DesktopDev");
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
app.MapControllers();
app.MapHub<MessagesHub>("/hubs/messages");

app.Run();
