using CourseIntellect.Application.DTOs.Staff;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class StaffManagementService(
    CourseIntellectDbContext dbContext,
    IPasswordHasher passwordHasher) : IStaffManagementService
{
    public async Task<IReadOnlyList<StaffSummaryDto>> GetStaffAsync(string? role, CancellationToken cancellationToken = default)
    {
        var query = dbContext.Staff.AsQueryable();

        if (!string.IsNullOrWhiteSpace(role) && Enum.TryParse<UserRole>(role, true, out var parsedRole))
        {
            query = query.Where(x => x.Role == parsedRole);
        }

        var users = await dbContext.Users.ToDictionaryAsync(x => x.Id, cancellationToken);
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
                users[staff.UserId].RoleHistory.Count > 0))
            .ToList();
    }

    public async Task<StaffCredentialsDto> CreateStaffAsync(CreateStaffRequest request, CancellationToken cancellationToken = default)
    {
        if (!Enum.TryParse<UserRole>(request.Role, true, out var parsedRole) ||
            parsedRole is not UserRole.Teacher and not UserRole.Administrative)
        {
            throw new InvalidOperationException("Bu endpoint sadece Ogretmen veya Administrative kaydi icindir.");
        }

        var username = await GenerateUniqueUsernameAsync(
            request.FullName,
            parsedRole == UserRole.Teacher ? "ogrt" : "idari",
            cancellationToken);
        var password = GeneratePassword();
        var user = new AppUser
        {
            FullName = request.FullName,
            Username = username,
            PasswordHash = passwordHasher.Hash(password),
            PrimaryRole = parsedRole,
            Campus = request.Campus,
            DepartmentOrBranch = request.DepartmentOrBranch
        };

        var staff = new StaffProfile
        {
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
        var username = await GenerateUniqueUsernameAsync(request.FullName, "mhs", cancellationToken);
        var password = GeneratePassword();
        var user = new AppUser
        {
            FullName = request.FullName,
            Username = username,
            PasswordHash = passwordHasher.Hash(password),
            PrimaryRole = UserRole.Accounting,
            Campus = request.Campus,
            DepartmentOrBranch = "Muhasebe"
        };

        var staff = new StaffProfile
        {
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
}
