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
    ITenantContext tenantContext) : IStaffManagementService
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
            parsedRole is not UserRole.Teacher and not UserRole.Administrative and not UserRole.Cafeteria and not UserRole.BranchManager)
        {
            throw new InvalidOperationException("Bu endpoint sadece Ogretmen, Administrative, Cafeteria veya BranchManager kaydi icindir.");
        }

        var tenantId = ResolveCurrentTenantId()
            ?? throw new InvalidOperationException("Kurum baglami bulunamadi.");

        // Şube müdürü mutlaka bir şubeye (OrgUnit) atanır; o şubeye kilitli Branch grant üretilir.
        if (parsedRole == UserRole.BranchManager)
        {
            if (request.BranchId is not Guid branchId)
            {
                throw new InvalidOperationException("Şube müdürü için şube seçimi zorunludur.");
            }
            if (!await dbContext.OrgUnits.AnyAsync(x => x.Id == branchId, cancellationToken))
            {
                throw new InvalidOperationException("Seçilen şube bu kuruma ait değil.");
            }
        }
        var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
        var isServiceDriverProfile = string.Equals(request.DepartmentOrBranch?.Trim(), "Servis Şoförü", StringComparison.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(email))
        {
            if (!email.Contains('@') || !email.Contains('.'))
            {
                throw new InvalidOperationException("Geçerli bir e-posta adresi girin.");
            }

            var existingStaff = await dbContext.Staff
                .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Email != null && x.Email.ToLower() == email, cancellationToken);
            if (existingStaff is not null)
            {
                var existingDrivers = await dbContext.ServiceDrivers
                    .Where(x => x.TenantId == tenantId && x.UserId == existingStaff.UserId)
                    .ToListAsync(cancellationToken);
                var existingDriverIds = existingDrivers.Select(x => x.Id).ToList();
                var existingDriverHasRoute = existingDriverIds.Count > 0
                    && await dbContext.ServiceRoutes.AnyAsync(x => existingDriverIds.Contains(x.DriverId), cancellationToken);
                var existingIsServiceDriverProfile = string.Equals(existingStaff.DepartmentOrBranch, "Servis Şoförü", StringComparison.OrdinalIgnoreCase);
                if (isServiceDriverProfile && existingIsServiceDriverProfile && !existingDriverHasRoute)
                {
                    var staleUser = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == existingStaff.UserId && x.TenantId == tenantId, cancellationToken);
                    if (existingDrivers.Count > 0)
                    {
                        dbContext.ServiceDrivers.RemoveRange(existingDrivers);
                    }

                    dbContext.Staff.Remove(existingStaff);
                    if (staleUser is not null)
                    {
                        dbContext.Users.Remove(staleUser);
                    }

                    await dbContext.SaveChangesAsync(cancellationToken);
                }
                else
                {
                    throw new InvalidOperationException("Bu e-posta adresi başka bir personel hesabında kullanılıyor.");
                }
            }
        }

        var primaryHint = parsedRole == UserRole.Teacher
            ? (request.AssignedClasses.FirstOrDefault() ?? string.Empty)
            : string.Empty;
        var roleName = parsedRole switch
        {
            UserRole.Teacher => "Teacher",
            UserRole.Cafeteria => "Cafeteria",
            UserRole.BranchManager => "BranchManager",
            _ => "Administrative"
        };
        var departmentOrBranch = parsedRole == UserRole.Cafeteria
            ? "Yemekhane"
            : (request.DepartmentOrBranch ?? string.Empty);
        var username = await usernameGenerator.GenerateAsync(
            tenantId,
            request.FullName,
            new UsernameContext(
                Role: roleName,
                ClassName: primaryHint,
                Branch: departmentOrBranch),
            cancellationToken);
        var password = PasswordGenerator.Generate();
        var user = new AppUser
        {
            TenantId = tenantId,
            BranchId = request.BranchId,
            FullName = request.FullName,
            Username = username,
            PasswordHash = passwordHasher.Hash(password),
            PrimaryRole = parsedRole,
            Campus = request.Campus,
            DepartmentOrBranch = departmentOrBranch,
            Phone = request.Phone.Trim(),
            MustChangePassword = true
        };

        var staff = new StaffProfile
        {
            TenantId = user.TenantId,
            UserId = user.Id,
            FullName = request.FullName,
            TcNo = request.TcNo,
            Phone = request.Phone,
            Email = email,
            Education = request.Education,
            StartDate = request.StartDate,
            Campus = request.Campus,
            DepartmentOrBranch = departmentOrBranch,
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

    public async Task<bool> DeleteStaffByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var tenantId = ResolveCurrentTenantId()
            ?? throw new InvalidOperationException("Kurum baglami bulunamadi.");

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId && x.TenantId == tenantId, cancellationToken);
        if (user is null)
        {
            return false;
        }

        var staff = await dbContext.Staff.FirstOrDefaultAsync(x => x.UserId == userId && x.TenantId == tenantId, cancellationToken);
        if (staff is not null)
        {
            dbContext.Staff.Remove(staff);
        }

        dbContext.Users.Remove(user);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private Guid? ResolveCurrentTenantId() => tenantContext.CurrentTenantId;
}
