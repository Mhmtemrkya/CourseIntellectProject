using System.Globalization;
using System.Text.RegularExpressions;
using CourseIntellect.Application.DTOs.Clubs;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed partial class ClubService(
    CourseIntellectDbContext dbContext,
    IAuditLogService auditLogService) : IClubService
{
    private const string AuditCategory = "Academic";
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    public static readonly IReadOnlySet<string> Categories = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Science", "Technology", "Sports", "Arts", "Music", "Literature", "Language", "SocialResponsibility", "Culture", "Other",
    };

    public static readonly IReadOnlySet<string> Roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "President", "VicePresident", "Secretary", "Member",
    };

    /// <summary>Kulüp başına tek kişiye verilen görevler.</summary>
    private static readonly HashSet<string> SingleSeatRoles = new(StringComparer.OrdinalIgnoreCase) { "President", "VicePresident", "Secretary" };

    [GeneratedRegex(@"^#[0-9A-Fa-f]{6}$")]
    private static partial Regex ColorPattern();

    // ─── Okuma ───────────────────────────────────────────────────────────────

    public async Task<ClubOverviewDto> GetOverviewAsync(ClubViewer viewer, string? academicYear, CancellationToken cancellationToken = default)
    {
        var year = NormalizeYear(academicYear);
        var query = dbContext.Clubs.AsNoTracking().Where(club => club.AcademicYear == year);
        // Öğrenci/veli/öğretmen yalnız aktif kulüpleri görür; arşivi yönetim görür.
        if (viewer.Kind is not (ClubViewerKind.Manager or ClubViewerKind.Staff))
        {
            query = query.Where(club => club.Status == "Active");
        }
        var clubs = await query.ToListAsync(cancellationToken);
        var summaries = await SummarizeAsync(viewer, clubs, cancellationToken);
        var clubIds = clubs.Select(club => club.Id).ToList();
        var members = await dbContext.ClubMembers.AsNoTracking()
            .Where(member => clubIds.Contains(member.ClubId) && member.Status == "Active")
            .Select(member => member.StudentUserId)
            .ToListAsync(cancellationToken);
        var now = DateTime.UtcNow;
        var upcoming = await dbContext.ClubActivities.AsNoTracking()
            .CountAsync(activity => clubIds.Contains(activity.ClubId) && activity.Status == "Planned" && activity.StartsAtUtc >= now, cancellationToken);
        return new ClubOverviewDto(
            year,
            summaries.Count,
            members.Count,
            summaries.Sum(club => club.PendingCount),
            members.Distinct().Count(),
            upcoming,
            summaries);
    }

    public async Task<ClubDetailDto> GetDetailAsync(ClubViewer viewer, Guid clubId, CancellationToken cancellationToken = default)
    {
        var club = await dbContext.Clubs.AsNoTracking().FirstOrDefaultAsync(item => item.Id == clubId, cancellationToken)
            ?? throw new KeyNotFoundException("Kulüp bulunamadı.");
        var canManage = CanManage(viewer, club);
        if (club.Status != "Active" && !canManage && viewer.Kind != ClubViewerKind.Staff)
        {
            throw new KeyNotFoundException("Kulüp bulunamadı.");
        }
        var summary = (await SummarizeAsync(viewer, [club], cancellationToken))[0];
        var members = await dbContext.ClubMembers.AsNoTracking()
            .Where(member => member.ClubId == clubId)
            .ToListAsync(cancellationToken);
        // Yönetenler istekler dahil herkesi görür; diğerleri yalnız aktif üyeleri,
        // istek notları ve karar notları olmadan (öğrenci gizliliği).
        var visible = canManage || viewer.Kind == ClubViewerKind.Staff
            ? members
            : members.Where(member => member.Status == "Active").ToList();
        var memberDtos = visible
            .OrderBy(member => RoleOrder(member.Role))
            .ThenBy(member => member.StudentName, StringComparer.Create(Tr, true))
            .Select(member => canManage || viewer.Kind == ClubViewerKind.Staff || member.StudentUserId == viewer.UserId
                ? ToDto(member)
                : ToDto(member) with { RequestNote = string.Empty, DecisionNote = string.Empty })
            .ToList();
        var activities = await dbContext.ClubActivities.AsNoTracking()
            .Where(activity => activity.ClubId == clubId)
            .OrderByDescending(activity => activity.StartsAtUtc)
            .ToListAsync(cancellationToken);
        return new ClubDetailDto(summary, memberDtos, activities.Select(activity => ToDto(activity, club.Name)).ToList());
    }

    public async Task<IReadOnlyList<ClubSummaryDto>> GetMineAsync(ClubViewer viewer, CancellationToken cancellationToken = default)
    {
        List<Club> clubs;
        switch (viewer.Kind)
        {
            case ClubViewerKind.Teacher:
                clubs = await dbContext.Clubs.AsNoTracking()
                    .Where(club => club.AdvisorTeacherUserId == viewer.UserId)
                    .ToListAsync(cancellationToken);
                break;
            case ClubViewerKind.Student:
            case ClubViewerKind.Parent:
                var students = StudentIds(viewer);
                var clubIds = await dbContext.ClubMembers.AsNoTracking()
                    .Where(member => students.Contains(member.StudentUserId) && (member.Status == "Active" || member.Status == "Pending"))
                    .Select(member => member.ClubId)
                    .Distinct()
                    .ToListAsync(cancellationToken);
                clubs = await dbContext.Clubs.AsNoTracking().Where(club => clubIds.Contains(club.Id)).ToListAsync(cancellationToken);
                break;
            default:
                return [];
        }
        return (await SummarizeAsync(viewer, clubs, cancellationToken))
            .OrderByDescending(club => club.AcademicYear)
            .ThenBy(club => club.Name, StringComparer.Create(Tr, true))
            .ToList();
    }

    public async Task<IReadOnlyList<ClubActivityDto>> GetUpcomingActivitiesAsync(ClubViewer viewer, CancellationToken cancellationToken = default)
    {
        var mine = await GetMineAsync(viewer, cancellationToken);
        var clubIds = mine.Where(club => club.MyStatus is null or "Active").Select(club => club.Id).ToList();
        var names = mine.ToDictionary(club => club.Id, club => club.Name);
        var since = DateTime.UtcNow.AddHours(-3);
        var activities = await dbContext.ClubActivities.AsNoTracking()
            .Where(activity => clubIds.Contains(activity.ClubId) && activity.Status == "Planned" && activity.StartsAtUtc >= since)
            .OrderBy(activity => activity.StartsAtUtc)
            .Take(50)
            .ToListAsync(cancellationToken);
        return activities.Select(activity => ToDto(activity, names.GetValueOrDefault(activity.ClubId) ?? string.Empty)).ToList();
    }

    public async Task<IReadOnlyList<ClubPersonOptionDto>> GetTeacherOptionsAsync(CancellationToken cancellationToken = default)
    {
        var teachers = await dbContext.Users.AsNoTracking()
            .Where(user => user.PrimaryRole == UserRole.Teacher && user.Status == UserStatus.Active)
            .Select(user => new { user.Id, user.FullName, user.DepartmentOrBranch })
            .ToListAsync(cancellationToken);
        return teachers
            .OrderBy(teacher => teacher.FullName, StringComparer.Create(Tr, true))
            .Select(teacher => new ClubPersonOptionDto(teacher.Id, teacher.FullName, teacher.DepartmentOrBranch))
            .ToList();
    }

    public async Task<IReadOnlyList<ClubPersonOptionDto>> SearchStudentsAsync(ClubViewer viewer, Guid clubId, string? search, CancellationToken cancellationToken = default)
    {
        var club = await LoadManagedClubAsync(viewer, clubId, cancellationToken);
        var existing = await dbContext.ClubMembers.AsNoTracking()
            .Where(member => member.ClubId == club.Id && (member.Status == "Active" || member.Status == "Pending"))
            .Select(member => member.StudentUserId)
            .ToListAsync(cancellationToken);
        var students = await ActiveStudentsAsync(cancellationToken);
        var query = (search ?? string.Empty).Trim().ToLower(Tr);
        return students
            .Where(student => !existing.Contains(student.UserId))
            .Where(student => query.Length == 0
                || student.FullName.ToLower(Tr).Contains(query)
                || student.ClassName.ToLower(Tr).Contains(query))
            .OrderBy(student => student.ClassName, StringComparer.Create(Tr, true))
            .ThenBy(student => student.FullName, StringComparer.Create(Tr, true))
            .Take(50)
            .Select(student => new ClubPersonOptionDto(student.UserId, student.FullName, student.ClassName))
            .ToList();
    }

    // ─── Kulüp yönetimi (yönetici) ───────────────────────────────────────────

    public async Task<ClubSummaryDto> CreateAsync(ClubViewer viewer, SaveClubRequest request, CancellationToken cancellationToken = default)
    {
        RequireManager(viewer);
        var club = new Club { CreatedByUserId = viewer.UserId };
        await ApplyAsync(club, request, cancellationToken);
        await dbContext.Clubs.AddAsync(club, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync("Kulüp oluşturuldu", AuditCategory, nameof(Club), club.Id.ToString(),
            $"{club.Name} ({club.AcademicYear}) — danışman: {(club.AdvisorTeacherName.Length == 0 ? "atanmadı" : club.AdvisorTeacherName)}.", cancellationToken);
        return (await SummarizeAsync(viewer, [club], cancellationToken))[0];
    }

    public async Task<ClubSummaryDto> UpdateAsync(ClubViewer viewer, Guid clubId, SaveClubRequest request, CancellationToken cancellationToken = default)
    {
        RequireManager(viewer);
        var club = await dbContext.Clubs.FirstOrDefaultAsync(item => item.Id == clubId, cancellationToken)
            ?? throw new KeyNotFoundException("Kulüp bulunamadı.");
        await ApplyAsync(club, request, cancellationToken);
        if (club.Capacity > 0)
        {
            var active = await dbContext.ClubMembers.CountAsync(member => member.ClubId == clubId && member.Status == "Active", cancellationToken);
            if (active > club.Capacity)
            {
                throw new InvalidOperationException($"Kulüpte {active} aktif üye var; kontenjan bundan az olamaz.");
            }
        }
        club.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync("Kulüp güncellendi", AuditCategory, nameof(Club), club.Id.ToString(), $"{club.Name} ({club.AcademicYear}).", cancellationToken);
        return (await SummarizeAsync(viewer, [club], cancellationToken))[0];
    }

    public async Task DeleteAsync(ClubViewer viewer, Guid clubId, CancellationToken cancellationToken = default)
    {
        RequireManager(viewer);
        var club = await dbContext.Clubs.FirstOrDefaultAsync(item => item.Id == clubId, cancellationToken)
            ?? throw new KeyNotFoundException("Kulüp bulunamadı.");
        var members = await dbContext.ClubMembers.Where(member => member.ClubId == clubId).ToListAsync(cancellationToken);
        var activities = await dbContext.ClubActivities.Where(activity => activity.ClubId == clubId).ToListAsync(cancellationToken);
        dbContext.ClubMembers.RemoveRange(members);
        dbContext.ClubActivities.RemoveRange(activities);
        dbContext.Clubs.Remove(club);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync("Kulüp silindi", AuditCategory, nameof(Club), clubId.ToString(),
            $"{club.Name} ({club.AcademicYear}), {members.Count} üyelik ve {activities.Count} etkinlik kaydıyla.", cancellationToken);
    }

    // ─── Üyelik ──────────────────────────────────────────────────────────────

    public async Task<ClubMemberDto> AddMemberAsync(ClubViewer viewer, Guid clubId, AddClubMemberRequest request, CancellationToken cancellationToken = default)
    {
        var club = await LoadManagedClubAsync(viewer, clubId, cancellationToken);
        var role = NormalizeRole(request.Role);
        var student = (await ActiveStudentsAsync(cancellationToken)).FirstOrDefault(item => item.UserId == request.StudentUserId)
            ?? throw new ArgumentException("Seçilen kişi bu kurumun aktif öğrencisi değil.");
        await EnsureCapacityAsync(club, cancellationToken);
        var member = await dbContext.ClubMembers.FirstOrDefaultAsync(item => item.ClubId == clubId && item.StudentUserId == student.UserId, cancellationToken);
        if (member is { Status: "Active" }) throw new InvalidOperationException($"{student.FullName} zaten bu kulübün üyesi.");
        await EnsureRoleSeatAsync(clubId, role, null, cancellationToken);
        if (member is null)
        {
            member = new ClubMember { ClubId = clubId, StudentUserId = student.UserId, BranchId = club.BranchId };
            await dbContext.ClubMembers.AddAsync(member, cancellationToken);
        }
        member.StudentName = student.FullName;
        member.ClassName = student.ClassName;
        member.Role = role;
        member.Status = "Active";
        member.JoinedAtUtc = DateTime.UtcNow;
        member.UpdatedAtUtc = DateTime.UtcNow;
        await NotifyAsync(student.UserId, "Kulübe eklendiniz", $"{club.Name} kulübüne üye olarak eklendiniz.", club.Id, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync("Kulübe üye eklendi", AuditCategory, nameof(ClubMember), member.Id.ToString(), $"{club.Name}: {student.FullName} ({RoleLabel(role)}).", cancellationToken);
        return ToDto(member);
    }

    public async Task<ClubMemberDto?> UpdateMemberAsync(ClubViewer viewer, Guid clubId, Guid memberId, UpdateClubMemberRequest request, CancellationToken cancellationToken = default)
    {
        var club = await LoadManagedClubAsync(viewer, clubId, cancellationToken);
        var member = await dbContext.ClubMembers.FirstOrDefaultAsync(item => item.Id == memberId && item.ClubId == clubId, cancellationToken)
            ?? throw new KeyNotFoundException("Üyelik bulunamadı.");
        var note = Clip(request.Note, 500);
        switch ((request.Action ?? string.Empty).Trim().ToLowerInvariant())
        {
            case "approve":
                if (member.Status != "Pending") throw new InvalidOperationException("Yalnız bekleyen istekler onaylanabilir.");
                await EnsureCapacityAsync(club, cancellationToken);
                var approveRole = NormalizeRole(request.Role);
                await EnsureRoleSeatAsync(clubId, approveRole, member.Id, cancellationToken);
                member.Status = "Active";
                member.Role = approveRole;
                member.JoinedAtUtc = DateTime.UtcNow;
                member.DecisionNote = note;
                await NotifyAsync(member.StudentUserId, "Kulüp isteğiniz onaylandı", $"{club.Name} kulübüne katılma isteğiniz onaylandı.", club.Id, cancellationToken);
                break;
            case "reject":
                if (member.Status != "Pending") throw new InvalidOperationException("Yalnız bekleyen istekler reddedilebilir.");
                member.Status = "Rejected";
                member.DecisionNote = note;
                await NotifyAsync(member.StudentUserId, "Kulüp isteğiniz sonuçlandı",
                    $"{club.Name} kulübüne katılma isteğiniz kabul edilmedi.{(note.Length > 0 ? $" Not: {note}" : string.Empty)}", club.Id, cancellationToken);
                break;
            case "setrole":
                if (member.Status != "Active") throw new InvalidOperationException("Görev yalnız aktif üyeye verilir.");
                var role = NormalizeRole(request.Role);
                await EnsureRoleSeatAsync(clubId, role, member.Id, cancellationToken);
                member.Role = role;
                break;
            case "remove":
                dbContext.ClubMembers.Remove(member);
                await dbContext.SaveChangesAsync(cancellationToken);
                await auditLogService.LogAsync("Kulüpten üye çıkarıldı", AuditCategory, nameof(ClubMember), member.Id.ToString(), $"{club.Name}: {member.StudentName}.", cancellationToken);
                return null;
            default:
                throw new ArgumentException("Geçersiz işlem (approve, reject, setRole, remove).");
        }
        member.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync("Kulüp üyeliği güncellendi", AuditCategory, nameof(ClubMember), member.Id.ToString(),
            $"{club.Name}: {member.StudentName} → {member.Status}, {RoleLabel(member.Role)}.", cancellationToken);
        return ToDto(member);
    }

    public async Task<ClubMemberDto> RequestJoinAsync(ClubViewer viewer, Guid clubId, JoinClubRequest request, CancellationToken cancellationToken = default)
    {
        if (viewer.Kind != ClubViewerKind.Student || viewer.UserId is not Guid studentId)
        {
            throw new UnauthorizedAccessException("Kulübe katılma isteğini öğrenci gönderir.");
        }
        var club = await dbContext.Clubs.FirstOrDefaultAsync(item => item.Id == clubId && item.Status == "Active", cancellationToken)
            ?? throw new KeyNotFoundException("Kulüp bulunamadı.");
        if (!club.AcceptsRequests) throw new InvalidOperationException("Bu kulüp katılma isteği kabul etmiyor; üyeleri danışman öğretmen belirler.");
        var student = (await ActiveStudentsAsync(cancellationToken)).FirstOrDefault(item => item.UserId == studentId)
            ?? throw new InvalidOperationException("Öğrenci kaydınız bulunamadı.");
        var member = await dbContext.ClubMembers.FirstOrDefaultAsync(item => item.ClubId == clubId && item.StudentUserId == studentId, cancellationToken);
        if (member is { Status: "Active" }) throw new InvalidOperationException("Zaten bu kulübün üyesisiniz.");
        if (member is { Status: "Pending" }) throw new InvalidOperationException("İsteğiniz zaten danışman öğretmenin onayını bekliyor.");
        await EnsureCapacityAsync(club, cancellationToken);
        if (member is null)
        {
            member = new ClubMember { ClubId = clubId, StudentUserId = studentId, BranchId = club.BranchId };
            await dbContext.ClubMembers.AddAsync(member, cancellationToken);
        }
        member.StudentName = student.FullName;
        member.ClassName = student.ClassName;
        member.Role = "Member";
        member.Status = "Pending";
        member.RequestNote = Clip(request.Note, 500);
        member.DecisionNote = string.Empty;
        member.RequestedAtUtc = DateTime.UtcNow;
        member.UpdatedAtUtc = DateTime.UtcNow;
        if (club.AdvisorTeacherUserId is Guid advisorId)
        {
            await NotifyAsync(advisorId, "Yeni kulüp katılma isteği", $"{student.FullName} ({student.ClassName}) {club.Name} kulübüne katılmak istiyor.", club.Id, cancellationToken);
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(member);
    }

    public async Task LeaveAsync(ClubViewer viewer, Guid clubId, CancellationToken cancellationToken = default)
    {
        if (viewer.Kind != ClubViewerKind.Student || viewer.UserId is not Guid studentId)
        {
            throw new UnauthorizedAccessException("Bu işlemi öğrenci yapar.");
        }
        var member = await dbContext.ClubMembers.FirstOrDefaultAsync(item => item.ClubId == clubId && item.StudentUserId == studentId, cancellationToken)
            ?? throw new KeyNotFoundException("Bu kulüpte kaydınız yok.");
        if (member.Status == "Pending")
        {
            // Bekleyen isteği geri çekmek kaydı tamamen siler.
            dbContext.ClubMembers.Remove(member);
        }
        else if (member.Status == "Active")
        {
            member.Status = "Left";
            member.Role = "Member";
            member.UpdatedAtUtc = DateTime.UtcNow;
        }
        else
        {
            throw new InvalidOperationException("Bu kulüpte aktif üyeliğiniz yok.");
        }
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    // ─── Etkinlikler ─────────────────────────────────────────────────────────

    public async Task<ClubActivityDto> SaveActivityAsync(ClubViewer viewer, Guid clubId, Guid? activityId, SaveClubActivityRequest request, CancellationToken cancellationToken = default)
    {
        var club = await LoadManagedClubAsync(viewer, clubId, cancellationToken);
        var title = (request.Title ?? string.Empty).Trim();
        if (title.Length is < 2 or > 160) throw new ArgumentException("Etkinlik başlığı 2-160 karakter olmalı.");
        var status = (request.Status ?? "Planned").Trim();
        if (status is not ("Planned" or "Completed" or "Cancelled")) throw new ArgumentException("Geçersiz etkinlik durumu.");
        if (request.AttendeeCount is < 0 or > 10000) throw new ArgumentException("Katılımcı sayısı geçersiz.");

        ClubActivity activity;
        var isNew = activityId is null;
        if (activityId is Guid id)
        {
            activity = await dbContext.ClubActivities.FirstOrDefaultAsync(item => item.Id == id && item.ClubId == clubId, cancellationToken)
                ?? throw new KeyNotFoundException("Etkinlik bulunamadı.");
            activity.UpdatedAtUtc = DateTime.UtcNow;
        }
        else
        {
            activity = new ClubActivity { ClubId = clubId, BranchId = club.BranchId, CreatedByUserId = viewer.UserId };
            await dbContext.ClubActivities.AddAsync(activity, cancellationToken);
        }
        activity.Title = title;
        activity.Description = Clip(request.Description, 2000);
        activity.StartsAtUtc = DateTime.SpecifyKind(request.StartsAtUtc, DateTimeKind.Utc);
        activity.Location = Clip(request.Location, 120);
        activity.Status = status;
        activity.AttendeeCount = status == "Completed" ? request.AttendeeCount : null;
        activity.Outcome = status == "Completed" ? Clip(request.Outcome, 2000) : string.Empty;

        if (isNew && status == "Planned")
        {
            // Yeni planlanan etkinlik aktif üyelere duyurulur.
            var memberIds = await dbContext.ClubMembers.AsNoTracking()
                .Where(member => member.ClubId == clubId && member.Status == "Active")
                .Select(member => member.StudentUserId)
                .ToListAsync(cancellationToken);
            var when = activity.StartsAtUtc.AddHours(3).ToString("dd.MM.yyyy HH:mm", Tr);
            foreach (var memberId in memberIds)
            {
                await NotifyAsync(memberId, $"{club.Name}: yeni etkinlik", $"{title} — {when}{(activity.Location.Length > 0 ? $", {activity.Location}" : string.Empty)}", club.Id, cancellationToken);
            }
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(activity, club.Name);
    }

    public async Task DeleteActivityAsync(ClubViewer viewer, Guid clubId, Guid activityId, CancellationToken cancellationToken = default)
    {
        await LoadManagedClubAsync(viewer, clubId, cancellationToken);
        var activity = await dbContext.ClubActivities.FirstOrDefaultAsync(item => item.Id == activityId && item.ClubId == clubId, cancellationToken)
            ?? throw new KeyNotFoundException("Etkinlik bulunamadı.");
        dbContext.ClubActivities.Remove(activity);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    // ─── Yardımcılar ─────────────────────────────────────────────────────────

    private sealed record StudentRow(Guid UserId, string FullName, string ClassName);

    private async Task<List<StudentRow>> ActiveStudentsAsync(CancellationToken cancellationToken)
    {
        var activeUserIds = dbContext.Users.AsNoTracking()
            .Where(user => user.PrimaryRole == UserRole.Student && user.Status == UserStatus.Active)
            .Select(user => user.Id);
        return await dbContext.Students.AsNoTracking()
            .Where(student => activeUserIds.Contains(student.UserId))
            .Select(student => new StudentRow(student.UserId, student.FullName, student.ClassName))
            .ToListAsync(cancellationToken);
    }

    private static IReadOnlyList<Guid> StudentIds(ClubViewer viewer) => viewer.Kind == ClubViewerKind.Parent
        ? viewer.ChildUserIds
        : viewer.UserId is Guid id ? [id] : [];

    private static bool CanManage(ClubViewer viewer, Club club) =>
        viewer.Kind == ClubViewerKind.Manager
        || (viewer.Kind == ClubViewerKind.Teacher && viewer.UserId is Guid id && club.AdvisorTeacherUserId == id);

    private static void RequireManager(ClubViewer viewer)
    {
        if (viewer.Kind != ClubViewerKind.Manager) throw new UnauthorizedAccessException("Kulüpleri kurum yöneticisi ya da şube müdürü yönetir.");
    }

    private async Task<Club> LoadManagedClubAsync(ClubViewer viewer, Guid clubId, CancellationToken cancellationToken)
    {
        var club = await dbContext.Clubs.FirstOrDefaultAsync(item => item.Id == clubId, cancellationToken)
            ?? throw new KeyNotFoundException("Kulüp bulunamadı.");
        if (!CanManage(viewer, club)) throw new UnauthorizedAccessException("Bu kulübü yalnız danışman öğretmen ve yönetici yönetebilir.");
        return club;
    }

    private async Task EnsureCapacityAsync(Club club, CancellationToken cancellationToken)
    {
        if (club.Capacity <= 0) return;
        var active = await dbContext.ClubMembers.CountAsync(member => member.ClubId == club.Id && member.Status == "Active", cancellationToken);
        if (active >= club.Capacity) throw new InvalidOperationException($"Kulüp kontenjanı dolu ({club.Capacity}).");
    }

    private async Task EnsureRoleSeatAsync(Guid clubId, string role, Guid? exceptMemberId, CancellationToken cancellationToken)
    {
        if (!SingleSeatRoles.Contains(role)) return;
        var taken = await dbContext.ClubMembers.AsNoTracking()
            .Where(member => member.ClubId == clubId && member.Status == "Active" && member.Role == role && member.Id != exceptMemberId)
            .Select(member => member.StudentName)
            .FirstOrDefaultAsync(cancellationToken);
        if (taken is not null) throw new InvalidOperationException($"{RoleLabel(role)} görevi zaten {taken} öğrencisinde.");
    }

    private async Task NotifyAsync(Guid userId, string title, string message, Guid clubId, CancellationToken cancellationToken)
    {
        await dbContext.Notifications.AddAsync(new NotificationItem
        {
            Title = title,
            Message = message,
            TimeLabel = "Şimdi",
            Category = "club",
            TargetUserId = userId,
            RelatedEntityType = "Club",
            RelatedEntityId = clubId.ToString(),
        }, cancellationToken);
    }

    private async Task ApplyAsync(Club club, SaveClubRequest request, CancellationToken cancellationToken)
    {
        var name = Regex.Replace((request.Name ?? string.Empty).Trim(), @"\s+", " ");
        if (name.Length is < 2 or > 120) throw new ArgumentException("Kulüp adı 2-120 karakter olmalı.");
        var category = (request.Category ?? "Other").Trim();
        if (!Categories.Contains(category)) throw new ArgumentException("Geçersiz kulüp kategorisi.");
        var year = NormalizeYear(request.AcademicYear);
        var capacity = request.Capacity ?? 0;
        if (capacity is < 0 or > 1000) throw new ArgumentException("Kontenjan 0-1000 arasında olmalı (0 = sınırsız).");
        var color = (request.Color ?? string.Empty).Trim();
        if (color.Length > 0 && !ColorPattern().IsMatch(color)) throw new ArgumentException("Renk #RRGGBB biçiminde olmalı.");
        var status = (request.Status ?? club.Status).Trim();
        if (status is not ("Active" or "Archived")) throw new ArgumentException("Geçersiz kulüp durumu.");

        var nameKey = name.ToLower(Tr);
        var sameYear = await dbContext.Clubs.AsNoTracking()
            .Where(item => item.AcademicYear == year && item.Id != club.Id)
            .Select(item => item.Name)
            .ToListAsync(cancellationToken);
        if (sameYear.Any(item => item.ToLower(Tr) == nameKey))
        {
            throw new InvalidOperationException($"{year} öğretim yılında \"{name}\" adlı kulüp zaten var.");
        }

        string advisorName = string.Empty;
        if (request.AdvisorTeacherUserId is Guid advisorId)
        {
            advisorName = await dbContext.Users.AsNoTracking()
                .Where(user => user.Id == advisorId && user.PrimaryRole == UserRole.Teacher && user.Status == UserStatus.Active)
                .Select(user => user.FullName)
                .FirstOrDefaultAsync(cancellationToken)
                ?? throw new ArgumentException("Danışman bu kurumun aktif öğretmeni olmalı.");
        }

        club.Name = name;
        club.Category = Categories.First(item => item.Equals(category, StringComparison.OrdinalIgnoreCase));
        club.Description = Clip(request.Description, 2000);
        club.AcademicYear = year;
        club.AdvisorTeacherUserId = request.AdvisorTeacherUserId;
        club.AdvisorTeacherName = advisorName;
        club.Capacity = capacity;
        club.MeetingSchedule = Clip(request.MeetingSchedule, 120);
        club.Location = Clip(request.Location, 120);
        if (color.Length > 0) club.Color = color.ToUpperInvariant();
        club.AcceptsRequests = request.AcceptsRequests ?? club.AcceptsRequests;
        club.Status = status;
    }

    private async Task<List<ClubSummaryDto>> SummarizeAsync(ClubViewer viewer, IReadOnlyList<Club> clubs, CancellationToken cancellationToken)
    {
        var ids = clubs.Select(club => club.Id).ToList();
        var counts = await dbContext.ClubMembers.AsNoTracking()
            .Where(member => ids.Contains(member.ClubId) && (member.Status == "Active" || member.Status == "Pending"))
            .GroupBy(member => new { member.ClubId, member.Status })
            .Select(group => new { group.Key.ClubId, group.Key.Status, Count = group.Count() })
            .ToListAsync(cancellationToken);
        var students = StudentIds(viewer);
        var mine = students.Count == 0
            ? []
            : await dbContext.ClubMembers.AsNoTracking()
                .Where(member => ids.Contains(member.ClubId) && students.Contains(member.StudentUserId))
                .Select(member => new { member.ClubId, member.Status, member.Role })
                .ToListAsync(cancellationToken);
        var now = DateTime.UtcNow;
        var next = await dbContext.ClubActivities.AsNoTracking()
            .Where(activity => ids.Contains(activity.ClubId) && activity.Status == "Planned" && activity.StartsAtUtc >= now)
            .GroupBy(activity => activity.ClubId)
            .Select(group => new { ClubId = group.Key, Next = group.Min(activity => activity.StartsAtUtc) })
            .ToListAsync(cancellationToken);
        var comparer = StringComparer.Create(Tr, true);
        return clubs
            .Select(club =>
            {
                var my = mine.Where(item => item.ClubId == club.Id).OrderBy(item => item.Status == "Active" ? 0 : 1).FirstOrDefault();
                var canManage = CanManage(viewer, club);
                return new ClubSummaryDto(
                    club.Id,
                    club.Name,
                    club.Category,
                    club.Description,
                    club.AcademicYear,
                    club.AdvisorTeacherUserId,
                    club.AdvisorTeacherName,
                    club.Capacity,
                    counts.Where(item => item.ClubId == club.Id && item.Status == "Active").Sum(item => item.Count),
                    // Bekleyen istek sayısı yalnız yönetene gösterilir.
                    canManage || viewer.Kind == ClubViewerKind.Staff
                        ? counts.Where(item => item.ClubId == club.Id && item.Status == "Pending").Sum(item => item.Count)
                        : 0,
                    club.MeetingSchedule,
                    club.Location,
                    club.Color,
                    club.AcceptsRequests,
                    club.Status,
                    my?.Status,
                    my?.Role,
                    canManage,
                    next.FirstOrDefault(item => item.ClubId == club.Id)?.Next);
            })
            .OrderBy(club => club.Status == "Active" ? 0 : 1)
            .ThenBy(club => club.Name, comparer)
            .ToList();
    }

    private static ClubMemberDto ToDto(ClubMember member) => new(
        member.Id, member.StudentUserId, member.StudentName, member.ClassName, member.Role, member.Status,
        member.RequestNote, member.DecisionNote, member.RequestedAtUtc, member.JoinedAtUtc);

    private static ClubActivityDto ToDto(ClubActivity activity, string clubName) => new(
        activity.Id, activity.ClubId, clubName, activity.Title, activity.Description, activity.StartsAtUtc,
        activity.Location, activity.Status, activity.AttendeeCount, activity.Outcome);

    private static int RoleOrder(string role) => role switch
    {
        "President" => 0,
        "VicePresident" => 1,
        "Secretary" => 2,
        _ => 3,
    };

    private static string RoleLabel(string role) => role switch
    {
        "President" => "Kulüp başkanı",
        "VicePresident" => "Başkan yardımcısı",
        "Secretary" => "Sekreter",
        _ => "Üye",
    };

    private static string NormalizeRole(string? role)
    {
        var value = (role ?? "Member").Trim();
        if (value.Length == 0) value = "Member";
        return Roles.FirstOrDefault(item => item.Equals(value, StringComparison.OrdinalIgnoreCase))
            ?? throw new ArgumentException("Geçersiz kulüp görevi.");
    }

    private static string NormalizeYear(string? value)
    {
        var year = (value ?? string.Empty).Trim();
        if (year.Length == 0) return SubjectGroupService.CurrentAcademicYear(DateTime.UtcNow);
        if (!Regex.IsMatch(year, @"^\d{4}-\d{4}$")
            || int.Parse(year[..4], CultureInfo.InvariantCulture) + 1 != int.Parse(year[5..], CultureInfo.InvariantCulture))
        {
            throw new ArgumentException("Öğretim yılı \"2026-2027\" biçiminde olmalı.");
        }
        return year;
    }

    private static string Clip(string? value, int max)
    {
        var text = (value ?? string.Empty).Trim();
        return text.Length > max ? text[..max] : text;
    }
}
