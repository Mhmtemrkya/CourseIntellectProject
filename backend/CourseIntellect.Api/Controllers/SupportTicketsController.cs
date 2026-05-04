using System.Security.Claims;
using CourseIntellect.Application.DTOs.PlatformOperations;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Kurum tarafı destek talepleri:
/// - SADECE kurum sahibi (Admin role + bağlı bir tenant) ticket açabilir.
/// - Tenant adı ve kullanıcı bilgileri JWT'den alınır, body'den alınmaz (güvenlik).
/// - Platform admin tarafı için /api/platformops/support-tickets kullanılır.
/// </summary>
[ApiController]
[Authorize]
[Route("api/support-tickets")]
public sealed class SupportTicketsController(
    IPlatformOperationsService platformOperationsService,
    CourseIntellectDbContext dbContext) : ControllerBase
{
    [HttpGet("mine")]
    public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
    {
        var (_, tenantId, _) = ReadClaims();
        if (tenantId == Guid.Empty)
        {
            return Ok(Array.Empty<SupportTicketDto>());
        }

        var tenantName = await dbContext.TenantWorkspaces
            .Where(t => t.Id == tenantId)
            .Select(t => t.Name)
            .FirstOrDefaultAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(tenantName))
        {
            return Ok(Array.Empty<SupportTicketDto>());
        }

        var list = await platformOperationsService.GetSupportTicketsByTenantAsync(tenantName, cancellationToken);
        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateSupportTicketBody body,
        CancellationToken cancellationToken)
    {
        var (userId, tenantId, role) = ReadClaims();
        if (userId == Guid.Empty || tenantId == Guid.Empty)
        {
            return Unauthorized(new { code = "AUTH_REQUIRED", message = "Oturum bulunamadı." });
        }

        // Sadece kurum sahibi (Admin role + bağlı tenant) ticket açabilir
        if (!string.Equals(role, UserRole.Admin.ToString(), StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                code = "TENANT_ADMIN_REQUIRED",
                message = "Yalnızca kurum yöneticisi destek talebi oluşturabilir.",
            });
        }

        if (string.IsNullOrWhiteSpace(body.Subject) || string.IsNullOrWhiteSpace(body.Summary))
        {
            return BadRequest(new { message = "Konu ve içerik zorunludur." });
        }

        // Tenant + user bilgisini DB'den al (body güvenilmez)
        var user = await dbContext.Users
            .Where(u => u.Id == userId)
            .Select(u => new { u.FullName, u.Username, u.TenantId })
            .FirstOrDefaultAsync(cancellationToken);
        if (user is null || user.TenantId is null)
        {
            return Unauthorized(new { message = "Kurum bilgisi bulunamadı." });
        }

        var tenantName = await dbContext.TenantWorkspaces
            .Where(t => t.Id == user.TenantId.Value)
            .Select(t => t.Name)
            .FirstOrDefaultAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(tenantName))
        {
            return Unauthorized(new { message = "Kurum bilgisi bulunamadı." });
        }

        var request = new CreateSupportTicketRequest(
            Subject: body.Subject.Trim(),
            Tenant: tenantName,
            User: user.FullName,
            UserRole: "Kurum Yöneticisi",
            Category: string.IsNullOrWhiteSpace(body.Category) ? "Genel" : body.Category.Trim(),
            Priority: NormalizePriority(body.Priority),
            Summary: body.Summary.Trim(),
            LastMessage: body.Summary.Trim());

        var ticket = await platformOperationsService.CreateSupportTicketAsync(request, cancellationToken);
        return Ok(ticket);
    }

    private (Guid userId, Guid tenantId, string role) ReadClaims()
    {
        var actorRaw = User.FindFirstValue("nameid")
            ?? User.FindFirstValue("sub")
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        var tenantRaw = User.FindFirstValue("tenant_id");
        var role = User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? string.Empty;
        Guid.TryParse(actorRaw, out var userId);
        Guid.TryParse(tenantRaw, out var tenantId);
        return (userId, tenantId, role);
    }

    private static string NormalizePriority(string? raw)
    {
        var v = (raw ?? "normal").Trim().ToLowerInvariant();
        return v switch
        {
            "low" or "düşük" or "dusuk" => "low",
            "high" or "yüksek" or "yuksek" => "high",
            "urgent" or "acil" or "kritik" => "urgent",
            _ => "normal",
        };
    }
}

public sealed record CreateSupportTicketBody(
    string Subject,
    string Summary,
    string? Category,
    string? Priority
);
