using System.Globalization;
using System.Text.RegularExpressions;
using CourseIntellect.Application.DTOs.SubjectGroups;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed partial class SubjectGroupService(
    CourseIntellectDbContext dbContext,
    IAuditLogService auditLogService) : ISubjectGroupService
{
    private const string AuditCategory = "Academic";
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    /// <summary>Öğretim yılı Eylül'de başlar: Eylül 2026 → "2026-2027", Mart 2027 → "2026-2027".</summary>
    public static string CurrentAcademicYear(DateTime nowUtc)
    {
        var local = nowUtc.AddHours(3);
        var start = local.Month >= 9 ? local.Year : local.Year - 1;
        return $"{start}-{start + 1}";
    }

    [GeneratedRegex(@"^\d{4}-\d{4}$")]
    private static partial Regex AcademicYearPattern();

    [GeneratedRegex(@"^#[0-9A-Fa-f]{6}$")]
    private static partial Regex ColorPattern();

    private static string NormalizeYear(string? value)
    {
        var year = (value ?? string.Empty).Trim();
        if (year.Length == 0) return CurrentAcademicYear(DateTime.UtcNow);
        if (!AcademicYearPattern().IsMatch(year)
            || int.Parse(year[..4], CultureInfo.InvariantCulture) + 1 != int.Parse(year[5..], CultureInfo.InvariantCulture))
        {
            throw new ArgumentException("Öğretim yılı \"2026-2027\" biçiminde olmalı.");
        }
        return year;
    }

    /// <summary>Ders adını tek biçime getirir: "  matematik " → "Matematik".</summary>
    private static string NormalizeSubject(string? value)
    {
        var text = Regex.Replace((value ?? string.Empty).Trim(), @"\s+", " ");
        if (text.Length == 0) return text;
        return Tr.TextInfo.ToTitleCase(text.ToLower(Tr));
    }

    private static string Key(string value) => value.Trim().ToLower(Tr);

    private sealed record TeacherRow(Guid UserId, string FullName, string Branch);

    /// <summary>Kurumun (şube filtresiyle) aktif öğretmenleri ve personel kartındaki branşları.</summary>
    private async Task<List<TeacherRow>> LoadTeachersAsync(CancellationToken cancellationToken)
    {
        var users = await dbContext.Users.AsNoTracking()
            .Where(user => user.PrimaryRole == UserRole.Teacher && user.Status == UserStatus.Active)
            .Select(user => new { user.Id, user.FullName, user.DepartmentOrBranch })
            .ToListAsync(cancellationToken);
        var userIds = users.Select(user => user.Id).ToList();
        var profileBranches = await dbContext.Staff.AsNoTracking()
            .Where(profile => userIds.Contains(profile.UserId))
            .Select(profile => new { profile.UserId, profile.DepartmentOrBranch })
            .ToListAsync(cancellationToken);
        var branchByUser = profileBranches
            .GroupBy(profile => profile.UserId)
            .ToDictionary(group => group.Key, group => group.First().DepartmentOrBranch);
        return users
            .Select(user => new TeacherRow(
                user.Id,
                user.FullName,
                NormalizeSubject(branchByUser.GetValueOrDefault(user.Id) is { Length: > 0 } branch ? branch : user.DepartmentOrBranch)))
            .OrderBy(teacher => teacher.FullName, StringComparer.Create(Tr, true))
            .ToList();
    }

    private async Task<List<SubjectGroupDto>> MapAsync(
        IReadOnlyList<SubjectGroup> groups,
        IReadOnlyDictionary<Guid, string> branchByUser,
        CancellationToken cancellationToken)
    {
        var ids = groups.Select(group => group.Id).ToList();
        var members = await dbContext.SubjectGroupMembers.AsNoTracking()
            .Where(member => ids.Contains(member.SubjectGroupId))
            .ToListAsync(cancellationToken);
        var byGroup = members.GroupBy(member => member.SubjectGroupId).ToDictionary(group => group.Key, group => group.ToList());
        var comparer = StringComparer.Create(Tr, true);
        return groups.Select(group => new SubjectGroupDto(
                group.Id,
                group.Subject,
                group.Name,
                group.AcademicYear,
                group.HeadTeacherUserId,
                group.HeadTeacherName,
                group.Description,
                group.Color,
                (byGroup.GetValueOrDefault(group.Id) ?? [])
                    .Select(member => new SubjectGroupMemberDto(
                        member.TeacherUserId,
                        member.TeacherName,
                        branchByUser.GetValueOrDefault(member.TeacherUserId) ?? string.Empty,
                        member.TeacherUserId == group.HeadTeacherUserId,
                        member.JoinedAtUtc))
                    // Başkan en üstte, sonra ada göre.
                    .OrderByDescending(member => member.IsHead)
                    .ThenBy(member => member.TeacherName, comparer)
                    .ToList(),
                group.CreatedAtUtc,
                group.UpdatedAtUtc))
            .OrderBy(group => group.Subject, comparer)
            .ToList();
    }

    public async Task<SubjectGroupOverviewDto> GetOverviewAsync(string? academicYear, CancellationToken cancellationToken = default)
    {
        var year = NormalizeYear(academicYear);
        var groups = await dbContext.SubjectGroups.AsNoTracking()
            .Where(group => group.AcademicYear == year)
            .ToListAsync(cancellationToken);
        var teachers = await LoadTeachersAsync(cancellationToken);
        var branchByUser = teachers.ToDictionary(teacher => teacher.UserId, teacher => teacher.Branch);
        var dtos = await MapAsync(groups, branchByUser, cancellationToken);

        var groupedTeacherIds = dtos.SelectMany(group => group.Members).Select(member => member.TeacherUserId).ToHashSet();
        var groupSubjects = dtos.Select(group => Key(group.Subject)).ToHashSet();
        var suggestions = teachers
            .Where(teacher => teacher.Branch.Length > 0)
            .GroupBy(teacher => Key(teacher.Branch))
            .Select(group => new SubjectSuggestionDto(group.First().Branch, group.Count(), groupSubjects.Contains(group.Key)))
            .OrderBy(item => item.HasGroup)
            .ThenByDescending(item => item.TeacherCount)
            .ThenBy(item => item.Subject, StringComparer.Create(Tr, true))
            .ToList();

        return new SubjectGroupOverviewDto(
            year,
            dtos.Count,
            teachers.Count,
            teachers.Count(teacher => !groupedTeacherIds.Contains(teacher.UserId)),
            dtos.Count(group => group.HeadTeacherUserId is null),
            dtos,
            suggestions);
    }

    public async Task<IReadOnlyList<SubjectGroupDto>> GetForTeacherAsync(Guid teacherUserId, CancellationToken cancellationToken = default)
    {
        var groupIds = await dbContext.SubjectGroupMembers.AsNoTracking()
            .Where(member => member.TeacherUserId == teacherUserId)
            .Select(member => member.SubjectGroupId)
            .ToListAsync(cancellationToken);
        var groups = await dbContext.SubjectGroups.AsNoTracking()
            .Where(group => groupIds.Contains(group.Id))
            .OrderByDescending(group => group.AcademicYear)
            .ToListAsync(cancellationToken);
        var teachers = await LoadTeachersAsync(cancellationToken);
        return await MapAsync(groups, teachers.ToDictionary(teacher => teacher.UserId, teacher => teacher.Branch), cancellationToken);
    }

    public async Task<IReadOnlyList<SubjectGroupTeacherOptionDto>> GetTeacherOptionsAsync(string? academicYear, CancellationToken cancellationToken = default)
    {
        var year = NormalizeYear(academicYear);
        var teachers = await LoadTeachersAsync(cancellationToken);
        var memberships = await (
                from member in dbContext.SubjectGroupMembers.AsNoTracking()
                join subjectGroup in dbContext.SubjectGroups.AsNoTracking() on member.SubjectGroupId equals subjectGroup.Id
                where subjectGroup.AcademicYear == year
                select new { member.TeacherUserId, subjectGroup.Subject })
            .ToListAsync(cancellationToken);
        var groupsByTeacher = memberships
            .GroupBy(item => item.TeacherUserId)
            .ToDictionary(group => group.Key, group => (IReadOnlyList<string>)group.Select(item => item.Subject).Distinct().ToList());
        return teachers
            .Select(teacher => new SubjectGroupTeacherOptionDto(
                teacher.UserId,
                teacher.FullName,
                teacher.Branch,
                groupsByTeacher.GetValueOrDefault(teacher.UserId) ?? []))
            .ToList();
    }

    public async Task<SubjectGroupDto> CreateAsync(SaveSubjectGroupRequest request, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        var group = new SubjectGroup { CreatedByUserId = actorUserId };
        await ApplyAsync(group, request, isNew: true, cancellationToken);
        await dbContext.SubjectGroups.AddAsync(group, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync("Zümre oluşturuldu", AuditCategory, nameof(SubjectGroup), group.Id.ToString(),
            $"{group.Name} ({group.AcademicYear}) — başkan: {(group.HeadTeacherName.Length == 0 ? "atanmadı" : group.HeadTeacherName)}.", cancellationToken);
        return (await GetByIdAsync(group.Id, cancellationToken))!;
    }

    public async Task<SubjectGroupDto> UpdateAsync(Guid id, SaveSubjectGroupRequest request, CancellationToken cancellationToken = default)
    {
        var group = await dbContext.SubjectGroups.FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException("Zümre bulunamadı.");
        var previousHead = group.HeadTeacherName;
        await ApplyAsync(group, request, isNew: false, cancellationToken);
        group.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        var headChange = previousHead == group.HeadTeacherName ? string.Empty : $" Başkan: {previousHead} → {group.HeadTeacherName}.";
        await auditLogService.LogAsync("Zümre güncellendi", AuditCategory, nameof(SubjectGroup), group.Id.ToString(),
            $"{group.Name} ({group.AcademicYear}).{headChange}", cancellationToken);
        return (await GetByIdAsync(group.Id, cancellationToken))!;
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var group = await dbContext.SubjectGroups.FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException("Zümre bulunamadı.");
        var members = await dbContext.SubjectGroupMembers.Where(member => member.SubjectGroupId == id).ToListAsync(cancellationToken);
        dbContext.SubjectGroupMembers.RemoveRange(members);
        dbContext.SubjectGroups.Remove(group);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync("Zümre silindi", AuditCategory, nameof(SubjectGroup), id.ToString(),
            $"{group.Name} ({group.AcademicYear}), {members.Count} üye.", cancellationToken);
    }

    private async Task<SubjectGroupDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var group = await dbContext.SubjectGroups.AsNoTracking().FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (group is null) return null;
        var teachers = await LoadTeachersAsync(cancellationToken);
        return (await MapAsync([group], teachers.ToDictionary(teacher => teacher.UserId, teacher => teacher.Branch), cancellationToken))[0];
    }

    private async Task ApplyAsync(SubjectGroup group, SaveSubjectGroupRequest request, bool isNew, CancellationToken cancellationToken)
    {
        var subject = NormalizeSubject(request.Subject);
        if (subject.Length is < 2 or > 120) throw new ArgumentException("Ders adı 2-120 karakter olmalı.");
        var year = NormalizeYear(request.AcademicYear);
        var color = (request.Color ?? string.Empty).Trim();
        if (color.Length > 0 && !ColorPattern().IsMatch(color)) throw new ArgumentException("Renk #RRGGBB biçiminde olmalı.");
        var description = (request.Description ?? string.Empty).Trim();
        if (description.Length > 1000) throw new ArgumentException("Açıklama en fazla 1000 karakter olabilir.");

        // Aynı şubede aynı ders için aynı yılda tek zümre (sorgu şube filtresiyle çalışır).
        var subjectKey = Key(subject);
        var duplicates = await dbContext.SubjectGroups.AsNoTracking()
            .Where(item => item.AcademicYear == year && item.Id != group.Id)
            .Select(item => item.Subject)
            .ToListAsync(cancellationToken);
        if (duplicates.Any(item => Key(item) == subjectKey))
        {
            throw new InvalidOperationException($"{year} öğretim yılı için {subject} zümresi zaten var.");
        }

        var teachers = (await LoadTeachersAsync(cancellationToken)).ToDictionary(teacher => teacher.UserId);
        var memberIds = (request.MemberUserIds ?? []).Where(id => id != Guid.Empty).Distinct().ToList();
        if (request.HeadTeacherUserId is Guid headId && !memberIds.Contains(headId)) memberIds.Add(headId);
        var unknown = memberIds.Where(id => !teachers.ContainsKey(id)).ToList();
        if (unknown.Count > 0)
        {
            // Pasif, başka kurumdan ya da öğretmen olmayan kullanıcı zümreye eklenemez.
            throw new ArgumentException("Seçilen kişilerden biri bu kurumun aktif öğretmeni değil.");
        }

        group.Subject = subject;
        group.Name = string.IsNullOrWhiteSpace(request.Name) ? $"{subject} Zümresi" : request.Name.Trim()[..Math.Min(request.Name.Trim().Length, 160)];
        group.AcademicYear = year;
        group.Description = description;
        if (color.Length > 0) group.Color = color.ToUpperInvariant();
        group.HeadTeacherUserId = request.HeadTeacherUserId;
        group.HeadTeacherName = request.HeadTeacherUserId is Guid head ? teachers[head].FullName : string.Empty;

        var existing = isNew
            ? []
            : await dbContext.SubjectGroupMembers.Where(member => member.SubjectGroupId == group.Id).ToListAsync(cancellationToken);
        dbContext.SubjectGroupMembers.RemoveRange(existing.Where(member => !memberIds.Contains(member.TeacherUserId)));
        var existingIds = existing.Select(member => member.TeacherUserId).ToHashSet();
        foreach (var memberId in memberIds.Where(id => !existingIds.Contains(id)))
        {
            await dbContext.SubjectGroupMembers.AddAsync(new SubjectGroupMember
            {
                SubjectGroupId = group.Id,
                TeacherUserId = memberId,
                TeacherName = teachers[memberId].FullName,
                // Üye kaydı zümrenin şubesinde durur (şube filtresi tutarlı kalsın).
                BranchId = group.BranchId,
            }, cancellationToken);
        }
    }
}
