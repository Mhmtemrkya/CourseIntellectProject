using System.Globalization;
using System.Text.RegularExpressions;
using CourseIntellect.Application.DTOs.Visitors;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed partial class VisitorService(
    CourseIntellectDbContext dbContext,
    IAuditLogService auditLogService) : IVisitorService
{
    /// <summary>Kayıtların saklama süresi (KVKK: amaç için gerekli süre). Sonrasında otomatik silinir.</summary>
    public const int RetentionDays = 365;

    /// <summary>Bu süreyi aşan ve çıkış yapmamış ziyaretçi "uzun süredir içeride" sayılır.</summary>
    public const int OverstayMinutes = 180;

    private const string AuditCategory = "Operations";
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    public static readonly IReadOnlySet<string> VisitorTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Parent", "Guest", "Supplier", "Official", "JobCandidate", "Maintenance", "Other",
    };

    [GeneratedRegex(@"\D")]
    private static partial Regex NonDigit();

    public async Task<VisitorListDto> ListAsync(DateTime? fromUtc, DateTime? toUtc, string? search, string? status, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var todayStart = FinanceDates.TodayUtcDate(now).AddHours(-3);
        var from = fromUtc ?? todayStart;
        var to = toUtc ?? todayStart.AddDays(1);
        if (to <= from) throw new ArgumentException("Bitiş tarihi başlangıçtan sonra olmalı.");
        if ((to - from).TotalDays > 400) throw new ArgumentException("En fazla 400 günlük aralık listelenebilir.");

        var query = dbContext.Visitors.AsNoTracking();
        query = (status ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            // İçeridekiler tarih aralığından bağımsızdır: dün girip çıkışı unutulan da görünmeli.
            "inside" => query.Where(item => item.CheckOutAtUtc == null),
            "left" => query.Where(item => item.CheckOutAtUtc != null && item.CheckInAtUtc >= from && item.CheckInAtUtc < to),
            _ => query.Where(item => (item.CheckInAtUtc >= from && item.CheckInAtUtc < to) || item.CheckOutAtUtc == null),
        };
        var rows = await query.OrderByDescending(item => item.CheckInAtUtc).Take(2000).ToListAsync(cancellationToken);
        var text = (search ?? string.Empty).Trim().ToLower(Tr);
        if (text.Length > 0)
        {
            var digits = NonDigit().Replace(text, string.Empty);
            rows = rows.Where(item => item.FullName.ToLower(Tr).Contains(text)
                || item.HostName.ToLower(Tr).Contains(text)
                || item.Purpose.ToLower(Tr).Contains(text)
                || item.StudentName.ToLower(Tr).Contains(text)
                || item.BadgeNo.ToLower(Tr).Contains(text)
                || (digits.Length >= 3 && NonDigit().Replace(item.Phone, string.Empty).Contains(digits))).ToList();
        }

        var today = await dbContext.Visitors.AsNoTracking()
            .Where(item => item.CheckInAtUtc >= todayStart || item.CheckOutAtUtc == null)
            .Select(item => new { item.CheckInAtUtc, item.CheckOutAtUtc, item.VisitorType })
            .ToListAsync(cancellationToken);
        var todayRows = today.Where(item => item.CheckInAtUtc >= todayStart).ToList();
        var finished = todayRows.Where(item => item.CheckOutAtUtc != null).ToList();
        var summary = new VisitorDaySummaryDto(
            todayRows.Count,
            today.Count(item => item.CheckOutAtUtc == null),
            finished.Count == 0 ? 0 : (int)Math.Round(finished.Average(item => (item.CheckOutAtUtc!.Value - item.CheckInAtUtc).TotalMinutes)),
            today.Count(item => item.CheckOutAtUtc == null && (now - item.CheckInAtUtc).TotalMinutes > OverstayMinutes),
            todayRows.GroupBy(item => item.VisitorType)
                .Select(group => new VisitorTypeCountDto(group.Key, group.Count()))
                .OrderByDescending(item => item.Count)
                .ToList());

        return new VisitorListDto(summary, rows.Select(item => ToDto(item, now)).ToList(), RetentionDays);
    }

    public async Task<IReadOnlyList<VisitorHostOptionDto>> GetHostsAsync(CancellationToken cancellationToken = default)
    {
        var staff = await dbContext.Users.AsNoTracking()
            .Where(user => user.Status == UserStatus.Active
                && user.PrimaryRole != UserRole.Student
                && user.PrimaryRole != UserRole.Parent
                && user.PrimaryRole != UserRole.Developer)
            .Select(user => new { user.Id, user.FullName, user.PrimaryRole, user.DepartmentOrBranch })
            .ToListAsync(cancellationToken);
        return staff
            .OrderBy(user => user.FullName, StringComparer.Create(Tr, true))
            .Select(user => new VisitorHostOptionDto(user.Id, user.FullName, RoleLabel(user.PrimaryRole, user.DepartmentOrBranch)))
            .ToList();
    }

    public async Task<IReadOnlyList<VisitorStudentOptionDto>> SearchStudentsAsync(string? search, CancellationToken cancellationToken = default)
    {
        var text = (search ?? string.Empty).Trim().ToLower(Tr);
        if (text.Length < 2) return [];
        var activeIds = dbContext.Users.AsNoTracking()
            .Where(user => user.PrimaryRole == UserRole.Student && user.Status == UserStatus.Active)
            .Select(user => user.Id);
        var students = await dbContext.Students.AsNoTracking()
            .Where(student => activeIds.Contains(student.UserId))
            .Select(student => new { student.UserId, student.FullName, student.ClassName })
            .ToListAsync(cancellationToken);
        return students
            .Where(student => student.FullName.ToLower(Tr).Contains(text) || student.ClassName.ToLower(Tr).Contains(text))
            .OrderBy(student => student.FullName, StringComparer.Create(Tr, true))
            .Take(20)
            .Select(student => new VisitorStudentOptionDto(student.UserId, student.FullName, student.ClassName))
            .ToList();
    }

    public async Task<IReadOnlyList<VisitorLookupDto>> LookupAsync(string? query, CancellationToken cancellationToken = default)
    {
        var text = (query ?? string.Empty).Trim().ToLower(Tr);
        if (text.Length < 2) return [];
        var digits = NonDigit().Replace(text, string.Empty);
        var rows = await dbContext.Visitors.AsNoTracking()
            .OrderByDescending(item => item.CheckInAtUtc)
            .Take(3000)
            .Select(item => new { item.FullName, item.Phone, item.VisitorType, item.Purpose, item.CheckInAtUtc })
            .ToListAsync(cancellationToken);
        return rows
            .Where(item => item.FullName.ToLower(Tr).Contains(text)
                || (digits.Length >= 4 && NonDigit().Replace(item.Phone, string.Empty).Contains(digits)))
            .GroupBy(item => $"{item.FullName.ToLower(Tr)}|{NonDigit().Replace(item.Phone, string.Empty)}")
            .Select(group =>
            {
                var last = group.First();
                return new VisitorLookupDto(last.FullName, last.Phone, last.VisitorType, last.Purpose, last.CheckInAtUtc, group.Count());
            })
            .Take(8)
            .ToList();
    }

    public async Task<VisitorDto> CheckInAsync(CheckInVisitorRequest request, Guid? actorUserId, string actorName, CancellationToken cancellationToken = default)
    {
        if (!request.PrivacyNoticeShown)
        {
            throw new ArgumentException("Ziyaretçiye KVKK aydınlatma metni bildirilmeden kayıt açılamaz.");
        }
        var entry = new VisitorEntry
        {
            CreatedByUserId = actorUserId,
            CreatedByName = Clip(actorName, 150),
            PrivacyNoticeShown = true,
            CheckInAtUtc = DateTime.UtcNow,
            IdentityLast4 = MaskIdentity(request.Identity),
        };
        await ApplyAsync(entry, request.FullName, request.Phone, request.VisitorType, request.Purpose, request.HostUserId,
            request.HostName, request.StudentUserId, request.BadgeNo, request.VehiclePlate, request.CompanionCount, request.Note, cancellationToken);

        if (entry.BadgeNo.Length > 0
            && await dbContext.Visitors.AnyAsync(item => item.CheckOutAtUtc == null && item.BadgeNo == entry.BadgeNo, cancellationToken))
        {
            throw new InvalidOperationException($"{entry.BadgeNo} numaralı ziyaretçi kartı şu an başka bir ziyaretçide.");
        }

        await dbContext.Visitors.AddAsync(entry, cancellationToken);
        if (entry.HostUserId is Guid hostId)
        {
            await dbContext.Notifications.AddAsync(new NotificationItem
            {
                Title = "Ziyaretçiniz geldi",
                Message = $"{entry.FullName} sizi görmek için geldi. Konu: {entry.Purpose}",
                TimeLabel = "Şimdi",
                Category = "visitor",
                TargetUserId = hostId,
                RelatedEntityType = "Visitor",
                RelatedEntityId = entry.Id.ToString(),
            }, cancellationToken);
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync("Ziyaretçi girişi", AuditCategory, nameof(VisitorEntry), entry.Id.ToString(),
            $"{entry.FullName} → {entry.HostName} ({entry.Purpose}).", cancellationToken);
        return ToDto(entry, DateTime.UtcNow);
    }

    public async Task<VisitorDto> CheckOutAsync(Guid id, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        var entry = await dbContext.Visitors.FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException("Ziyaretçi kaydı bulunamadı.");
        if (entry.CheckOutAtUtc is not null) throw new InvalidOperationException("Bu ziyaretçinin çıkışı zaten yapıldı.");
        entry.CheckOutAtUtc = DateTime.UtcNow;
        entry.CheckedOutByUserId = actorUserId;
        entry.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(entry, DateTime.UtcNow);
    }

    public async Task<VisitorDto> UpdateAsync(Guid id, UpdateVisitorRequest request, CancellationToken cancellationToken = default)
    {
        var entry = await dbContext.Visitors.FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException("Ziyaretçi kaydı bulunamadı.");
        await ApplyAsync(entry, request.FullName, request.Phone, request.VisitorType, request.Purpose, request.HostUserId,
            request.HostName, request.StudentUserId, request.BadgeNo, request.VehiclePlate, request.CompanionCount, request.Note, cancellationToken);
        entry.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync("Ziyaretçi kaydı düzeltildi", AuditCategory, nameof(VisitorEntry), entry.Id.ToString(),
            $"{entry.FullName} → {entry.HostName}.", cancellationToken);
        return ToDto(entry, DateTime.UtcNow);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entry = await dbContext.Visitors.FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException("Ziyaretçi kaydı bulunamadı.");
        dbContext.Visitors.Remove(entry);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync("Ziyaretçi kaydı silindi", AuditCategory, nameof(VisitorEntry), id.ToString(),
            $"{entry.FullName} ({entry.CheckInAtUtc:dd.MM.yyyy HH:mm} UTC).", cancellationToken);
    }

    public async Task<int> PurgeExpiredAsync(DateTime nowUtc, CancellationToken cancellationToken = default)
    {
        var threshold = nowUtc.AddDays(-RetentionDays);
        return await dbContext.Visitors
            .Where(item => item.CheckInAtUtc < threshold)
            .ExecuteDeleteAsync(cancellationToken);
    }

    /// <summary>Kimlik numarasının yalnız son 4 hanesi (rakam) saklanır; tamamı hiçbir yerde tutulmaz.</summary>
    public static string MaskIdentity(string? identity)
    {
        var digits = NonDigit().Replace(identity ?? string.Empty, string.Empty);
        return digits.Length >= 4 ? digits[^4..] : string.Empty;
    }

    private async Task ApplyAsync(VisitorEntry entry, string fullName, string? phone, string? visitorType, string purpose,
        Guid? hostUserId, string? hostName, Guid? studentUserId, string? badgeNo, string? vehiclePlate, int? companionCount,
        string? note, CancellationToken cancellationToken)
    {
        var name = Regex.Replace((fullName ?? string.Empty).Trim(), @"\s+", " ");
        if (name.Length is < 3 or > 150) throw new ArgumentException("Ziyaretçi adı soyadı 3-150 karakter olmalı.");
        var reason = (purpose ?? string.Empty).Trim();
        if (reason.Length is < 2 or > 300) throw new ArgumentException("Ziyaret amacını yazın.");
        var type = (visitorType ?? "Guest").Trim();
        if (!VisitorTypes.Contains(type)) throw new ArgumentException("Geçersiz ziyaretçi türü.");
        var phoneText = (phone ?? string.Empty).Trim();
        if (phoneText.Length > 0 && NonDigit().Replace(phoneText, string.Empty).Length is < 10 or > 15)
        {
            throw new ArgumentException("Telefon numarası geçerli değil.");
        }
        if (companionCount is < 0 or > 50) throw new ArgumentException("Refakatçi sayısı 0-50 arasında olmalı.");

        string host;
        if (hostUserId is Guid hostId)
        {
            host = await dbContext.Users.AsNoTracking()
                .Where(user => user.Id == hostId && user.Status == UserStatus.Active
                    && user.PrimaryRole != UserRole.Student && user.PrimaryRole != UserRole.Parent)
                .Select(user => user.FullName)
                .FirstOrDefaultAsync(cancellationToken)
                ?? throw new ArgumentException("Ziyaret edilen kişi bu kurumun aktif personeli değil.");
        }
        else
        {
            host = (hostName ?? string.Empty).Trim();
            if (host.Length < 2) throw new ArgumentException("Ziyaret edilen kişiyi ya da birimi seçin.");
        }

        var studentName = string.Empty;
        if (studentUserId is Guid studentId)
        {
            studentName = await dbContext.Students.AsNoTracking()
                .Where(student => student.UserId == studentId)
                .Select(student => student.FullName + " (" + student.ClassName + ")")
                .FirstOrDefaultAsync(cancellationToken)
                ?? throw new ArgumentException("Seçilen öğrenci bulunamadı.");
        }

        entry.FullName = name;
        entry.Phone = Clip(phoneText, 30);
        entry.VisitorType = VisitorTypes.First(item => item.Equals(type, StringComparison.OrdinalIgnoreCase));
        entry.Purpose = reason;
        entry.HostUserId = hostUserId;
        entry.HostName = Clip(host, 150);
        entry.StudentUserId = studentUserId;
        entry.StudentName = Clip(studentName, 150);
        entry.BadgeNo = Clip((badgeNo ?? string.Empty).Trim().ToUpperInvariant(), 30);
        entry.VehiclePlate = Clip(Regex.Replace((vehiclePlate ?? string.Empty).ToUpperInvariant(), @"\s+", " ").Trim(), 20);
        entry.CompanionCount = companionCount ?? 0;
        entry.Note = Clip(note, 1000);
    }

    private static VisitorDto ToDto(VisitorEntry entry, DateTime nowUtc) => new(
        entry.Id, entry.FullName, entry.Phone, entry.IdentityLast4, entry.VisitorType, entry.Purpose, entry.HostUserId,
        entry.HostName, entry.StudentUserId, entry.StudentName, entry.BadgeNo, entry.VehiclePlate, entry.CompanionCount,
        entry.Note, entry.CheckInAtUtc, entry.CheckOutAtUtc,
        (int)Math.Max(0, Math.Round(((entry.CheckOutAtUtc ?? nowUtc) - entry.CheckInAtUtc).TotalMinutes)),
        entry.CreatedByName);

    private static string RoleLabel(UserRole role, string branch) => role switch
    {
        UserRole.Admin => "Yönetici",
        UserRole.BranchManager => "Şube Müdürü",
        UserRole.Teacher => string.IsNullOrWhiteSpace(branch) ? "Öğretmen" : $"Öğretmen • {branch}",
        UserRole.Accounting => "Muhasebe",
        UserRole.Administrative => "İdari Personel",
        UserRole.Cafeteria => "Yemekhane",
        _ => role.ToString(),
    };

    private static string Clip(string? value, int max)
    {
        var text = (value ?? string.Empty).Trim();
        return text.Length > max ? text[..max] : text;
    }
}
