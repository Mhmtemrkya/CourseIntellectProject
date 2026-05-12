using CourseIntellect.Application.DTOs.Common;
using CourseIntellect.Application.DTOs.Users;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace CourseIntellect.Infrastructure.Services;

public sealed class UserDirectoryService(
    CourseIntellectDbContext dbContext,
    IPasswordHasher passwordHasher,
    IHttpContextAccessor httpContextAccessor) : IUserDirectoryService
{
    public async Task<IReadOnlyList<UserSummaryDto>> GetUsersAsync(CancellationToken cancellationToken = default)
    {
        var users = await ApplyTenantScope(dbContext.Users)
            .OrderBy(x => x.FullName)
            .ToListAsync(cancellationToken);

        return users
            .Select(user => new UserSummaryDto(
                user.Id,
                user.FullName,
                user.Username,
                user.PrimaryRole.ToString(),
                user.ExtraRoles.Select(x => x.ToString()).ToList(),
                user.Status.ToString(),
                user.Campus,
                user.DepartmentOrBranch))
            .ToList();
    }

    public async Task<PagedResult<AdminUserListItemDto>> GetUsersPagedAsync(int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = ApplyTenantScope(dbContext.Users).OrderBy(x => x.FullName);
        var totalItems = await query.CountAsync(cancellationToken);
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = users.Select(ToAdminListItem).ToList();
        return new PagedResult<AdminUserListItemDto>(items, new PaginationInfo(page, pageSize, totalItems, totalPages));
    }

    public async Task<AdminUserListItemDto> CreateUserAsync(AdminCreateUserRequest request, CancellationToken cancellationToken = default)
    {
        if (!Enum.TryParse<UserRole>(request.Role, true, out var role))
            role = UserRole.Student;

        var user = new AppUser
        {
            TenantId = ResolveCurrentTenantId(),
            FullName = request.Name,
            Username = request.Email,
            PasswordHash = passwordHasher.Hash(request.Password),
            PrimaryRole = role,
            Status = request.IsActive ? UserStatus.Active : UserStatus.Passive,
            IsEmailVerified = request.IsEmailVerified,
            CreatedAtUtc = DateTime.UtcNow
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToAdminListItem(user);
    }

    public async Task<AdminUserListItemDto?> UpdateUserAsync(Guid id, AdminUpdateUserRequest request, CancellationToken cancellationToken = default)
    {
        var user = await ApplyTenantScope(dbContext.Users)
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null) return null;

        if (request.Name is not null) user.FullName = request.Name;
        if (request.Email is not null) user.Username = request.Email;
        if (request.Password is not null) user.PasswordHash = passwordHasher.Hash(request.Password);
        if (request.Role is not null && Enum.TryParse<UserRole>(request.Role, true, out var role))
            user.PrimaryRole = role;
        if (request.IsActive.HasValue)
            user.Status = request.IsActive.Value ? UserStatus.Active : UserStatus.Passive;
        if (request.IsEmailVerified.HasValue)
            user.IsEmailVerified = request.IsEmailVerified.Value;

        await dbContext.SaveChangesAsync(cancellationToken);
        return ToAdminListItem(user);
    }

    public async Task<bool> DeleteUserAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await ApplyTenantScope(dbContext.Users)
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null) return false;

        dbContext.Users.Remove(user);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<PagedResult<RegistrationListItemDto>> GetRegistrationsAsync(int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = ApplyTenantScope(dbContext.Users).OrderByDescending(x => x.CreatedAtUtc);
        var totalItems = await query.CountAsync(cancellationToken);
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = users.Select(u => new RegistrationListItemDto(
            u.Id,
            u.Id,
            u.Username,
            u.FullName,
            u.PrimaryRole.ToString(),
            u.CreatedAtUtc,
            u.IsEmailVerified
        )).ToList();

        return new PagedResult<RegistrationListItemDto>(items, new PaginationInfo(page, pageSize, totalItems, totalPages));
    }

    public async Task<IReadOnlyList<RoleSummaryDto>> GetRolesAsync(CancellationToken cancellationToken = default)
    {
        var users = await ApplyTenantScope(dbContext.Users).ToListAsync(cancellationToken);
        var policies = await dbContext.RolePolicies.ToDictionaryAsync(x => x.RoleName, cancellationToken);

        return
        [
            CreateRole(UserRole.Developer, false, "Platform", ["Platform", "Kurumlar", "Icerik", "Ayarlar"], users, policies),
            CreateRole(UserRole.Admin, false, "Tum roller", ["Akademik", "Finans", "Operasyon", "Onaylar"], users, policies),
            CreateRole(UserRole.Teacher, false, "Ogrenci, veli, yonetici", ["Akademik", "Icerik", "Sinavlar"], users, policies),
            CreateRole(UserRole.Accounting, true, "Veli, yonetici", ["Finans", "Tahsilatlar", "Taksitler"], users, policies),
            CreateRole(UserRole.Administrative, false, "Veli, yonetici, muhasebe", ["Kayit", "Evrak", "Duyurular"], users, policies),
            CreateRole(UserRole.Parent, false, "Ogretmen, yonetici", ["Ogrenci", "Odeme", "Raporlar"], users, policies),
            CreateRole(UserRole.Student, false, "Ogretmen", ["Sinavlar", "Icerikler", "Odevler"], users, policies)
        ];
    }

    public async Task UpdateRolePolicyAsync(string roleName, RolePolicyUpdateRequest request, CancellationToken cancellationToken = default)
    {
        if (!Enum.TryParse<UserRole>(roleName, true, out var parsedRole))
        {
            throw new InvalidOperationException("Gecersiz rol bilgisi.");
        }

        var policy = await dbContext.RolePolicies.SingleOrDefaultAsync(x => x.RoleName == parsedRole.ToString(), cancellationToken);
        if (policy is null)
        {
            policy = new RolePolicy { RoleName = parsedRole.ToString() };
            await dbContext.RolePolicies.AddAsync(policy, cancellationToken);
        }

        policy.IsActive = request.IsActive;
        policy.LoginEnabled = request.LoginEnabled;
        policy.RequiresCriticalApproval = request.RequiresCriticalApproval;
        policy.MessagingScope = request.MessagingScope;
        policy.ModuleAccessSerialized = JsonSerializer.Serialize(request.ModuleAccess);

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateUserStatusAsync(string username, UserStatusUpdateRequest request, CancellationToken cancellationToken = default)
    {
        var user = await ApplyTenantScope(dbContext.Users).SingleOrDefaultAsync(x => x.Username == username, cancellationToken)
            ?? throw new InvalidOperationException("Kullanici bulunamadi.");

        user.Status = request.Status.Equals("Passive", StringComparison.OrdinalIgnoreCase) ||
                      request.Status.Equals("Pasif", StringComparison.OrdinalIgnoreCase)
            ? UserStatus.Passive
            : UserStatus.Active;

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task AssignPrimaryRoleAsync(string username, UserRoleAssignmentRequest request, CancellationToken cancellationToken = default)
    {
        var user = await ApplyTenantScope(dbContext.Users).SingleOrDefaultAsync(x => x.Username == username, cancellationToken)
            ?? throw new InvalidOperationException("Kullanici bulunamadi.");
        var staff = await dbContext.Staff.SingleOrDefaultAsync(x => x.UserId == user.Id, cancellationToken);

        if (!Enum.TryParse<UserRole>(request.PrimaryRole, true, out var parsedRole))
        {
            throw new InvalidOperationException("Gecersiz rol bilgisi.");
        }

        var history = user.RoleHistory;
        history.Add($"PRIMARY:{user.PrimaryRole}:{request.PrimaryRole}:{DateTime.UtcNow:O}");
        user.RoleHistory = history;
        user.ExtraRoles = user.ExtraRoles.Where(x => x != parsedRole).ToList();
        user.PrimaryRole = parsedRole;
        user.DepartmentOrBranch = request.DepartmentOrBranch;
        if (staff is not null)
        {
            staff.Role = parsedRole;
            staff.DepartmentOrBranch = request.DepartmentOrBranch;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task AddExtraRoleAsync(string username, UserExtraRoleRequest request, CancellationToken cancellationToken = default)
    {
        var user = await ApplyTenantScope(dbContext.Users).SingleOrDefaultAsync(x => x.Username == username, cancellationToken)
            ?? throw new InvalidOperationException("Kullanici bulunamadi.");
        if (!Enum.TryParse<UserRole>(request.RoleName, true, out var parsedRole))
        {
            throw new InvalidOperationException("Gecersiz ek yetki bilgisi.");
        }

        var roles = user.ExtraRoles;
        if (user.PrimaryRole != parsedRole && !roles.Contains(parsedRole))
        {
            roles.Add(parsedRole);
            user.ExtraRoles = roles;
            var history = user.RoleHistory;
            history.Add($"EXTRA:{parsedRole}:{DateTime.UtcNow:O}");
            user.RoleHistory = history;
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<bool> UndoLastRoleAssignmentAsync(string username, CancellationToken cancellationToken = default)
    {
        var user = await ApplyTenantScope(dbContext.Users).SingleOrDefaultAsync(x => x.Username == username, cancellationToken)
            ?? throw new InvalidOperationException("Kullanici bulunamadi.");
        var staff = await dbContext.Staff.SingleOrDefaultAsync(x => x.UserId == user.Id, cancellationToken);

        if (user.RoleHistory.Count == 0)
        {
            return false;
        }

        var history = user.RoleHistory;
        var last = history[^1];
        history.RemoveAt(history.Count - 1);
        user.RoleHistory = history;

        if (last.StartsWith("EXTRA:", StringComparison.Ordinal))
        {
            var roleName = last.Split(':')[1];
            if (Enum.TryParse<UserRole>(roleName, true, out var extraRole))
            {
                user.ExtraRoles = user.ExtraRoles.Where(x => x != extraRole).ToList();
            }
        }
        else if (last.StartsWith("PRIMARY:", StringComparison.Ordinal))
        {
            var parts = last.Split(':');
            if (parts.Length >= 3 && Enum.TryParse<UserRole>(parts[1], true, out var previousRole))
            {
                user.PrimaryRole = previousRole;
                if (staff is not null)
                {
                    staff.Role = previousRole;
                }
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static AdminUserListItemDto ToAdminListItem(AppUser u) => new(
        u.Id,
        u.FullName,
        u.Username,
        u.Phone,
        u.PrimaryRole.ToString(),
        u.Status == UserStatus.Active,
        u.IsEmailVerified,
        u.CreatedAtUtc,
        u.LastLoginAtUtc
    );

    private static RoleSummaryDto CreateRole(
        UserRole role,
        bool requiresCriticalApproval,
        string messagingScope,
        IReadOnlyList<string> modules,
        IReadOnlyList<AppUser> users,
        IReadOnlyDictionary<string, RolePolicy> policies)
    {
        var count = users.Count(x => x.PrimaryRole == role || x.ExtraRoles.Contains(role));
        if (!policies.TryGetValue(role.ToString(), out var policy))
        {
            return new RoleSummaryDto(role.ToString(), count, true, true, requiresCriticalApproval, messagingScope, modules);
        }

        var policyModules = string.IsNullOrWhiteSpace(policy.ModuleAccessSerialized)
            ? modules
            : JsonSerializer.Deserialize<List<string>>(policy.ModuleAccessSerialized) ?? modules.ToList();

        return new RoleSummaryDto(
            role.ToString(),
            count,
            policy.IsActive,
            policy.LoginEnabled,
            policy.RequiresCriticalApproval,
            policy.MessagingScope,
            policyModules);
    }

    private IQueryable<AppUser> ApplyTenantScope(IQueryable<AppUser> query)
    {
        var tenantId = ResolveCurrentTenantId();
        return tenantId.HasValue ? query.Where(x => x.TenantId == tenantId.Value) : query;
    }

    private Guid? ResolveCurrentTenantId()
    {
        var raw = httpContextAccessor.HttpContext?.User?.FindFirstValue("tenant_id");
        return Guid.TryParse(raw, out var tenantId) ? tenantId : null;
    }
}
