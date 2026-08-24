using System.Net;
using System.Net.Mail;
using CourseIntellect.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Hosting;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Düz SMTP ile e-posta gönderimi.
/// </summary>
/// <remarks>
/// Yapılandırma:
/// <code>
/// Email:Smtp:Host      zorunlu (boşsa servis kapalı sayılır)
/// Email:Smtp:Port      varsayılan 587
/// Email:Smtp:User      opsiyonel (kimlik doğrulamasız röle için boş bırakılır)
/// Email:Smtp:Password  opsiyonel  (COURSE_INTELLECT_SMTP_PASSWORD ile de verilebilir)
/// Email:Smtp:UseSsl    varsayılan true (STARTTLS)
/// Email:From           zorunlu — gönderen adres
/// Email:FromName       varsayılan "SchoolAsist"
/// </code>
/// Sağlayıcı seçimi bilinçli olarak yapılmadı: bunlar her SMTP sağlayıcısında
/// bulunan alanlar (bkz. <c>Nvi:Endpoint</c> ve <c>Captcha:Secret</c> ile aynı desen).
/// </remarks>
public sealed class SmtpEmailSender : IEmailSender
{
    private readonly ILogger<SmtpEmailSender> logger;
    private readonly string? host;
    private readonly int port;
    private readonly string? user;
    private readonly string? password;
    private readonly bool useSsl;
    private readonly string? fromAddress;
    private readonly string fromName;

    public SmtpEmailSender(IConfiguration configuration, IHostEnvironment environment, ILogger<SmtpEmailSender> logger)
    {
        this.logger = logger;

        host = Normalize(configuration["Email:Smtp:Host"]);
        port = configuration.GetValue<int?>("Email:Smtp:Port") ?? 587;
        user = Normalize(configuration["Email:Smtp:User"]);

        var configuredPassword = Environment.GetEnvironmentVariable("COURSE_INTELLECT_SMTP_PASSWORD");
        if (string.IsNullOrWhiteSpace(configuredPassword)) configuredPassword = configuration["Email:Smtp:Password"];
        password = Normalize(configuredPassword);

        useSsl = configuration.GetValue<bool?>("Email:Smtp:UseSsl") ?? true;
        fromAddress = Normalize(configuration["Email:From"]);
        fromName = Normalize(configuration["Email:FromName"]) ?? "SchoolAsist";

        if (environment.IsProduction())
        {
            if (host is null || fromAddress is null)
            {
                throw new InvalidOperationException(
                    "Production ortamında Email:Smtp:Host ve Email:From eksiksiz yapılandırılmalıdır.");
            }

            if ((user is null) != (password is null))
            {
                throw new InvalidOperationException(
                    "Production ortamında SMTP kullanıcı adı ve parolası birlikte yapılandırılmalıdır.");
            }

            if (port is < 1 or > 65535)
            {
                throw new InvalidOperationException("SMTP portu 1-65535 aralığında olmalıdır.");
            }

            try
            {
                _ = new MailAddress(fromAddress);
            }
            catch (FormatException exception)
            {
                throw new InvalidOperationException("Email:From geçerli bir e-posta adresi olmalıdır.", exception);
            }

            if (user is not null && !useSsl)
            {
                throw new InvalidOperationException(
                    "Production ortamında kimlik doğrulamalı SMTP bağlantısı TLS olmadan kullanılamaz.");
            }
        }
    }

    public bool IsConfigured => host is not null && fromAddress is not null;

    public async Task<bool> SendAsync(
        string toAddress,
        string subject,
        string htmlBody,
        CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            logger.LogWarning("SMTP yapılandırılmadığı için e-posta gönderilmedi: {Subject}", subject);
            return false;
        }

        try
        {
            using var client = new SmtpClient(host!, port)
            {
                EnableSsl = useSsl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Credentials = user is null ? null : new NetworkCredential(user, password ?? string.Empty),
            };

            using var message = new MailMessage
            {
                From = new MailAddress(fromAddress!, fromName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true,
            };
            message.To.Add(toAddress);

            await client.SendMailAsync(message, cancellationToken);
            return true;
        }
        catch (Exception exception)
        {
            // Çağıran, gönderilemedi bilgisine göre davranışını değiştirir; istisna
            // yayılıp asıl işlemi (kayıt/onay) düşürmemeli.
            logger.LogError(exception, "E-posta gönderilemedi: {Subject}", subject);
            return false;
        }
    }

    private static string? Normalize(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
