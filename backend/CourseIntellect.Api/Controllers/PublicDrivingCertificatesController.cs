using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[AllowAnonymous]
[EnableRateLimiting("certificate-verification")]
[Route("api/public/driving-certificates")]
public sealed class PublicDrivingCertificatesController(CourseIntellectDbContext db) : ControllerBase
{
    [HttpGet("{documentNumber}/verify")]
    public async Task<IActionResult> Verify(string documentNumber, [FromQuery] string? token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 100) return NotFound(new { valid = false, message = "Belge doğrulanamadı." });
        var certificate = await db.DrivingCertificates.IgnoreQueryFilters().AsNoTracking()
            .SingleOrDefaultAsync(x => x.DocumentNumber == documentNumber, ct);
        if (certificate is null || string.IsNullOrWhiteSpace(certificate.VerificationTokenHash)) return NotFound(new { valid = false, message = "Belge doğrulanamadı." });
        var supplied = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        byte[] expected;
        try { expected = Convert.FromHexString(certificate.VerificationTokenHash); } catch { return NotFound(new { valid = false, message = "Belge doğrulanamadı." }); }
        if (!CryptographicOperations.FixedTimeEquals(supplied, expected)) return NotFound(new { valid = false, message = "Belge doğrulanamadı." });
        CertificateSnapshot? snapshot = null;
        try { snapshot = JsonSerializer.Deserialize<CertificateSnapshot>(certificate.SnapshotJson); } catch { }
        var valid = certificate.Status == DrivingCertificateStatus.Active;
        return Ok(new { valid, status = certificate.Status.ToString(), certificate.DocumentNumber, type = certificate.CertificateType.ToString(), certificate.Version,
            certificate.IssuedAtUtc, snapshot?.InstitutionName, snapshot?.StudentName, snapshot?.LicenseClass,
            mebbisCertificateNo = string.IsNullOrWhiteSpace(certificate.MebbisCertificateNo) ? null : certificate.MebbisCertificateNo,
            certificate.RevokedAtUtc, revocationReason = valid ? null : certificate.RevocationReason });
    }
}
