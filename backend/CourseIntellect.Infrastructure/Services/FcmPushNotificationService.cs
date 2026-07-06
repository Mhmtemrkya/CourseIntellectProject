using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace CourseIntellect.Infrastructure.Services;

public sealed class FcmPushNotificationService(
    CourseIntellectDbContext dbContext,
    HttpClient httpClient,
    IOptions<FcmPushOptions> options,
    ILogger<FcmPushNotificationService> logger) : IPushNotificationService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly SemaphoreSlim tokenLock = new(1, 1);
    private string? accessToken;
    private DateTimeOffset accessTokenExpiresAt;

    public bool IsConfigured => options.Value.IsConfigured;

    public async Task SendToUserAsync(
        Guid userId,
        string title,
        string body,
        IReadOnlyDictionary<string, string>? data = null,
        CancellationToken cancellationToken = default)
    {
        if (!options.Value.IsConfigured)
        {
            logger.LogDebug("FCM push skipped because Firebase service account configuration is missing.");
            return;
        }

        try
        {
            var devices = await dbContext.PushDeviceRegistrations
                .Where(x => x.UserId == userId && x.IsActive)
                .OrderByDescending(x => x.LastSeenAtUtc)
                .ToListAsync(cancellationToken);

            if (devices.Count == 0)
            {
                return;
            }

            var bearer = await GetAccessTokenAsync(cancellationToken);
            foreach (var device in devices)
            {
                await SendToDeviceAsync(device, title, body, data, bearer, cancellationToken);
            }
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(ex, "FCM push send failed for user {UserId}. The main workflow will continue.", userId);
        }
    }

    private static string NormalizeName(string? value)
        => (value ?? string.Empty).Trim().ToLowerInvariant()
            .Replace("ı", "i").Replace("ğ", "g").Replace("ü", "u")
            .Replace("ş", "s").Replace("ö", "o").Replace("ç", "c");

    public async Task SendToUserByNameAsync(
        string fullName,
        string title,
        string body,
        IReadOnlyDictionary<string, string>? data = null,
        CancellationToken cancellationToken = default)
        => await SendToDevicesAsync(
            d => d.IsActive && d.FullName != string.Empty,
            registrations => registrations.Where(d => NormalizeName(d.FullName) == NormalizeName(fullName)),
            title, body, data, cancellationToken);

    public async Task SendToRoleAsync(
        string role,
        string title,
        string body,
        IReadOnlyDictionary<string, string>? data = null,
        CancellationToken cancellationToken = default)
        => await SendToDevicesAsync(
            d => d.IsActive && d.Role != string.Empty,
            registrations => registrations.Where(d => NormalizeName(d.Role) == NormalizeName(role)),
            title, body, data, cancellationToken);

    /// <summary>Ortak push gönderim akışı: DB'den aktif cihazları çeker, verilen
    /// filtreyle daraltır ve her cihaza gönderir. Hatalar ana işlemi bloklamaz.</summary>
    private async Task SendToDevicesAsync(
        System.Linq.Expressions.Expression<Func<PushDeviceRegistration, bool>> dbFilter,
        Func<List<PushDeviceRegistration>, IEnumerable<PushDeviceRegistration>> refine,
        string title,
        string body,
        IReadOnlyDictionary<string, string>? data,
        CancellationToken cancellationToken)
    {
        if (!options.Value.IsConfigured) return;
        try
        {
            var candidates = await dbContext.PushDeviceRegistrations
                .Where(dbFilter)
                .OrderByDescending(x => x.LastSeenAtUtc)
                .ToListAsync(cancellationToken);
            var devices = refine(candidates).ToList();
            if (devices.Count == 0) return;

            var bearer = await GetAccessTokenAsync(cancellationToken);
            foreach (var device in devices)
            {
                await SendToDeviceAsync(device, title, body, data, bearer, cancellationToken);
            }
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(ex, "FCM push (by name/role) failed. The main workflow will continue.");
        }
    }

    private async Task SendToDeviceAsync(
        PushDeviceRegistration device,
        string title,
        string body,
        IReadOnlyDictionary<string, string>? data,
        string bearer,
        CancellationToken cancellationToken)
    {
        var projectId = options.Value.ProjectId!;
        var requestBody = new
        {
            message = new
            {
                token = device.Token,
                notification = new
                {
                    title,
                    body,
                },
                data = BuildData(data),
                android = new
                {
                    priority = "high",
                    notification = new
                    {
                        channel_id = "course_intellect_general",
                        sound = "default",
                    },
                },
                apns = new
                {
                    payload = new
                    {
                        aps = new
                        {
                            sound = "default",
                        },
                    },
                },
            },
        };

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://fcm.googleapis.com/v1/projects/{Uri.EscapeDataString(projectId)}/messages:send");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        request.Content = new StringContent(JsonSerializer.Serialize(requestBody, JsonOptions), Encoding.UTF8, "application/json");

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.IsSuccessStatusCode)
        {
            device.LastSeenAtUtc = DateTime.UtcNow;
            device.UpdatedAtUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            return;
        }

        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        logger.LogWarning(
            "FCM push failed for device {DeviceId}. Status: {StatusCode}. Body: {Body}",
            device.Id,
            (int)response.StatusCode,
            responseBody);

        if (ShouldDeactivateToken(responseBody))
        {
            device.IsActive = false;
            device.UpdatedAtUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task<string> GetAccessTokenAsync(CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(accessToken) && accessTokenExpiresAt > DateTimeOffset.UtcNow.AddMinutes(2))
        {
            return accessToken;
        }

        await tokenLock.WaitAsync(cancellationToken);
        try
        {
            if (!string.IsNullOrWhiteSpace(accessToken) && accessTokenExpiresAt > DateTimeOffset.UtcNow.AddMinutes(2))
            {
                return accessToken;
            }

            var assertion = CreateServiceAccountAssertion();
            using var request = new HttpRequestMessage(HttpMethod.Post, options.Value.TokenUri);
            request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "urn:ietf:params:oauth:grant-type:jwt-bearer",
                ["assertion"] = assertion,
            });

            using var response = await httpClient.SendAsync(request, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            response.EnsureSuccessStatusCode();

            using var json = JsonDocument.Parse(body);
            accessToken = json.RootElement.GetProperty("access_token").GetString()
                ?? throw new InvalidOperationException("FCM access_token response is empty.");
            var expiresIn = json.RootElement.TryGetProperty("expires_in", out var expires)
                ? expires.GetInt32()
                : 3600;
            accessTokenExpiresAt = DateTimeOffset.UtcNow.AddSeconds(Math.Max(60, expiresIn - 60));
            return accessToken;
        }
        finally
        {
            tokenLock.Release();
        }
    }

    private string CreateServiceAccountAssertion()
    {
        using var rsa = RSA.Create();
        rsa.ImportFromPem(options.Value.PrivateKey!.AsSpan());
        var credentials = new SigningCredentials(new RsaSecurityKey(rsa), SecurityAlgorithms.RsaSha256);
        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(
            issuer: options.Value.ClientEmail,
            audience: options.Value.TokenUri,
            claims:
            [
                new Claim("scope", "https://www.googleapis.com/auth/firebase.messaging"),
            ],
            notBefore: now.AddMinutes(-1),
            expires: now.AddMinutes(55),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static IReadOnlyDictionary<string, string> BuildData(IReadOnlyDictionary<string, string>? data)
    {
        var payload = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["source"] = "course_intellect",
        };

        if (data is null)
        {
            return payload;
        }

        foreach (var item in data)
        {
            if (!string.IsNullOrWhiteSpace(item.Key) && item.Value is not null)
            {
                payload[item.Key] = item.Value;
            }
        }

        return payload;
    }

    private static bool ShouldDeactivateToken(string responseBody)
    {
        return responseBody.Contains("UNREGISTERED", StringComparison.OrdinalIgnoreCase)
            || responseBody.Contains("Requested entity was not found", StringComparison.OrdinalIgnoreCase)
            || responseBody.Contains("registration-token-not-registered", StringComparison.OrdinalIgnoreCase);
    }
}

public sealed class FcmPushOptions
{
    public string? ProjectId { get; init; }
    public string? ClientEmail { get; init; }
    public string? PrivateKey { get; init; }
    public string TokenUri { get; init; } = "https://oauth2.googleapis.com/token";

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(ProjectId)
        && !string.IsNullOrWhiteSpace(ClientEmail)
        && !string.IsNullOrWhiteSpace(PrivateKey);

    public static FcmPushOptions FromConfiguration(IConfiguration configuration)
    {
        var section = configuration.GetSection("Firebase");
        var rawJson = Environment.GetEnvironmentVariable("COURSE_INTELLECT_FCM_SERVICE_ACCOUNT_JSON")
            ?? section["ServiceAccountJson"];
        var rawBase64 = Environment.GetEnvironmentVariable("COURSE_INTELLECT_FCM_SERVICE_ACCOUNT_BASE64")
            ?? section["ServiceAccountBase64"];
        var path = Environment.GetEnvironmentVariable("COURSE_INTELLECT_FCM_SERVICE_ACCOUNT_PATH")
            ?? section["ServiceAccountPath"];

        if (!string.IsNullOrWhiteSpace(rawBase64))
        {
            rawJson = Encoding.UTF8.GetString(Convert.FromBase64String(rawBase64));
        }

        if (string.IsNullOrWhiteSpace(rawJson) && !string.IsNullOrWhiteSpace(path) && File.Exists(path))
        {
            rawJson = File.ReadAllText(path);
        }

        if (string.IsNullOrWhiteSpace(rawJson))
        {
            return new FcmPushOptions
            {
                ProjectId = Environment.GetEnvironmentVariable("COURSE_INTELLECT_FCM_PROJECT_ID") ?? section["ProjectId"],
            };
        }

        using var json = JsonDocument.Parse(rawJson);
        var root = json.RootElement;
        var projectId = Environment.GetEnvironmentVariable("COURSE_INTELLECT_FCM_PROJECT_ID")
            ?? section["ProjectId"]
            ?? ReadString(root, "project_id");

        return new FcmPushOptions
        {
            ProjectId = projectId,
            ClientEmail = ReadString(root, "client_email"),
            PrivateKey = NormalizePrivateKey(ReadString(root, "private_key")),
            TokenUri = ReadString(root, "token_uri") ?? "https://oauth2.googleapis.com/token",
        };
    }

    private static string? ReadString(JsonElement root, string key)
    {
        return root.TryGetProperty(key, out var value) ? value.GetString() : null;
    }

    private static string? NormalizePrivateKey(string? privateKey)
    {
        return privateKey?.Replace("\\n", "\n", StringComparison.Ordinal);
    }
}
