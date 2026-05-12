using CourseIntellect.Application.DTOs.Staff;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Auth;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CourseIntellect.Infrastructure.Services;

public sealed class StaffManagementService(
    CourseIntellectDbContext dbContext,
    IPasswordHasher passwordHasher,
    UsernameGenerator usernameGenerator,
    IHttpContextAccessor httpContextAccessor) : IStaffManagementService
{
    public async Task<IReadOnlyList<StaffSummaryDto>> GetStaffAsync(string? role, CancellationToken cancellationToken = default)
    {
        var currentTenantId = ResolveCurrentTenantId();
        var query = dbContext.Staff.AsQueryable();

        if (!string.IsNullOrWhiteSpace(role) && Enum.TryParse<UserRole>(role, true, out var parsedRole))
        {
            query = query.Where(x => x.Role == parsedRole);
        }

        var usersQuery = dbContext.Users.AsQueryable();
        if (currentTenantId.HasValue)
        {
            usersQuery = usersQuery.Where(x => x.TenantId == currentTenantId.Value);
        }

        var users = await usersQuery.ToDictionaryAsync(x => x.Id, cancellationToken);
        var userIds = users.Keys.ToList();
        if (currentTenantId.HasValue)
        {
            query = query.Where(x => userIds.Contains(x.UserId));
        }

        var staffList = await query
            .OrderBy(x => x.FullName)
            .ToListAsync(cancellationToken);

        return staffList
            .Select(staff => new StaffSummaryDto(
                staff.Id,
                staff.FullName,
                users[staff.UserId].Username,
                staff.Role.ToString(),
                staff.DepartmentOrBranch,
                staff.Campus,
                users[staff.UserId].Status.ToString(),
                users[staff.UserId].ExtraRoles.Select(x => x.ToString()).ToList(),
                users[staff.UserId].RoleHistory.Count > 0,
                staff.AssignedClasses,
                staff.Email,
                staff.Phone,
                staff.HomeroomClass,
                staff.Education,
                staff.TcNo,
                staff.MaritalStatus,
                staff.ChildCount,
                staff.Note,
                staff.StartDate))
            .ToList();
    }

    public async Task<StaffCredentialsDto> CreateStaffAsync(CreateStaffRequest request, CancellationToken cancellationToken = default)
    {
        if (!Enum.TryParse<UserRole>(request.Role, true, out var parsedRole) ||
            parsedRole is not UserRole.Teacher and not UserRole.Administrative)
        {
            throw new InvalidOperationException("Bu endpoint sadece Ogretmen veya Administrative kaydi icindir.");
        }

        var tenantId = ResolveCurrentTenantId()
            ?? throw new InvalidOperationException("Kurum baglami bulunamadi.");
        var primaryHint = parsedRole == UserRole.Teacher
            ? (request.AssignedClasses.FirstOrDefault() ?? string.Empty)
            : string.Empty;
        var username = await usernameGenerator.GenerateAsync(
            tenantId,
            request.FullName,
            new UsernameContext(
                Role: parsedRole == UserRole.Teacher ? "Teacher" : "Administrative",
                ClassName: primaryHint,
                Branch: request.DepartmentOrBranch),
            cancellationToken);
        var password = PasswordGenerator.Generate();
        var user = new AppUser
        {
            TenantId = tenantId,
            FullName = request.FullName,
            Username = username,
            PasswordHash = passwordHasher.Hash(password),
            PrimaryRole = parsedRole,
            Campus = request.Campus,
            DepartmentOrBranch = request.DepartmentOrBranch,
            MustChangePassword = true
        };

        var staff = new StaffProfile
        {
            TenantId = user.TenantId,
            UserId = user.Id,
            FullName = request.FullName,
            TcNo = request.TcNo,
            Phone = request.Phone,
            Email = request.Email,
            Education = request.Education,
            StartDate = request.StartDate,
            Campus = request.Campus,
            DepartmentOrBranch = request.DepartmentOrBranch,
            HomeroomClass = parsedRole == UserRole.Teacher ? request.HomeroomClass : "Sinif ogretmenligi yok",
            AssignedClasses = parsedRole == UserRole.Teacher ? request.AssignedClasses.ToList() : [],
            MaritalStatus = request.MaritalStatus,
            ChildCount = request.ChildCount,
            Note = request.Note,
            Role = parsedRole
        };

        await dbContext.Users.AddAsync(user, cancellationToken);
        await dbContext.Staff.AddAsync(staff, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new StaffCredentialsDto(user.Id, user.FullName, user.Username, password, parsedRole.ToString());
    }

    public async Task<StaffCredentialsDto> CreateAccountingStaffAsync(CreateAccountingStaffRequest request, CancellationToken cancellationToken = default)
    {
        var tenantId = ResolveCurrentTenantId()
            ?? throw new InvalidOperationException("Kurum baglami bulunamadi.");
        var username = await usernameGenerator.GenerateAsync(
            tenantId,
            request.FullName,
            new UsernameContext(Role: "Accounting"),
            cancellationToken);
        var password = PasswordGenerator.Generate();
        var user = new AppUser
        {
            TenantId = tenantId,
            FullName = request.FullName,
            Username = username,
            PasswordHash = passwordHasher.Hash(password),
            PrimaryRole = UserRole.Accounting,
            Campus = request.Campus,
            DepartmentOrBranch = "Muhasebe",
            MustChangePassword = true
        };

        var staff = new StaffProfile
        {
            TenantId = user.TenantId,
            UserId = user.Id,
            FullName = request.FullName,
            TcNo = request.TcNo,
            Phone = request.Phone,
            Email = request.Email,
            Education = request.Education,
            StartDate = request.StartDate,
            Campus = request.Campus,
            DepartmentOrBranch = "Muhasebe",
            HomeroomClass = "Sinif ogretmenligi yok",
            AssignedClasses = [],
            MaritalStatus = request.MaritalStatus,
            ChildCount = request.ChildCount,
            Note = request.Note,
            Role = UserRole.Accounting
        };

        await dbContext.Users.AddAsync(user, cancellationToken);
        await dbContext.Staff.AddAsync(staff, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new StaffCredentialsDto(user.Id, user.FullName, user.Username, password, UserRole.Accounting.ToString());
    }

    private async Task<string> GenerateUniqueUsernameAsync(string fullName, string prefix, CancellationToken cancellationToken)
    {
        var normalized = fullName.ToLowerInvariant()
            .Replace("ç", "c")
            .Replace("ğ", "g")
            .Replace("ı", "i")
            .Replace("ö", "o")
            .Replace("ş", "s")
            .Replace("ü", "u");
        var compact = new string(normalized.Where(char.IsLetterOrDigit).ToArray());
        var baseValue = compact[..Math.Min(compact.Length, 10)];
        var random = new Random();
        var username = $"{prefix}.{baseValue}{random.Next(100, 999)}";

        while (await dbContext.Users.AnyAsync(x => x.Username == username, cancellationToken))
        {
            username = $"{prefix}.{baseValue}{random.Next(100, 999)}";
        }

        return username;
    }

    private static string GeneratePassword()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = new Random();
        return new string(Enumerable.Range(0, 8).Select(_ => chars[random.Next(chars.Length)]).ToArray());
    }

    public async Task<StaffSummaryDto> UpdateStaffAsync(Guid staffId, UpdateStaffRequest request, CancellationToken cancellationToken = default)
    {
        var staff = await dbContext.Staff.FirstOrDefaultAsync(x => x.Id == staffId, cancellationToken)
            ?? throw new InvalidOperationException("Personel bulunamadı.");

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == staff.UserId, cancellationToken)
            ?? throw new InvalidOperationException("Kullanıcı bulunamadı.");

        staff.FullName = request.FullName;
        staff.DepartmentOrBranch = request.DepartmentOrBranch;
        staff.Phone = request.Phone;
        staff.Email = request.Email;
        staff.Education = request.Education;
        staff.Campus = request.Campus;
        staff.HomeroomClass = request.HomeroomClass;
        staff.AssignedClasses = request.AssignedClasses.ToList();
        staff.MaritalStatus = request.MaritalStatus;
        staff.ChildCount = request.ChildCount;
        staff.Note = request.Note;

        user.FullName = request.FullName;
        user.Campus = request.Campus;
        user.DepartmentOrBranch = request.DepartmentOrBranch;

        await dbContext.SaveChangesAsync(cancellationToken);

        return new StaffSummaryDto(
            staff.Id,
            staff.FullName,
            user.Username,
            staff.Role.ToString(),
            staff.DepartmentOrBranch,
            staff.Campus,
            user.Status.ToString(),
            user.ExtraRoles.Select(x => x.ToString()).ToList(),
            user.RoleHistory.Count > 0,
            staff.AssignedClasses,
            staff.Email,
            staff.Phone,
            staff.HomeroomClass,
            staff.Education,
            staff.TcNo,
            staff.MaritalStatus,
            staff.ChildCount,
            staff.Note,
            staff.StartDate);
    }

    private Guid? ResolveCurrentTenantId()
    {
        var raw = httpContextAccessor.HttpContext?.User?.FindFirstValue("tenant_id");
        return Guid.TryParse(raw, out var tenantId) ? tenantId : null;
    }
}
