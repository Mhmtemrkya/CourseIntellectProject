using CourseIntellect.Application.DTOs.PlatformOperations;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class PlatformOperationsService(
    CourseIntellectDbContext dbContext,
    IPasswordHasher passwordHasher) : IPlatformOperationsService
{
    public async Task<PlatformOverviewDto> GetOverviewAsync(CancellationToken cancellationToken = default)
    {
        var tenants = await GetTenantsAsync(cancellationToken);
        var tickets = await GetSupportTicketsAsync(cancellationToken);
        var notifications = await dbContext.Notifications.AsNoTracking().ToListAsync(cancellationToken);
        var threads = await dbContext.StudentQuestionThreads.AsNoTracking().ToListAsync(cancellationToken);
        var contents = await dbContext.ContentItems.AsNoTracking().ToListAsync(cancellationToken);
        var homework = await dbContext.HomeworkAssignments.AsNoTracking().ToListAsync(cancellationToken);
        var meetings = await dbContext.MeetingRequests.AsNoTracking().ToListAsync(cancellationToken);
        var invoices = await dbContext.AccountingInvoices.AsNoTracking().ToListAsync(cancellationToken);
        var collections = await dbContext.AccountingCollections.AsNoTracking().ToListAsync(cancellationToken);
        var installments = await dbContext.AccountingInstallments.AsNoTracking().ToListAsync(cancellationToken);

        var totalRequests = notifications.Count * 8 + threads.Count * 12 + contents.Count * 6 + homework.Count * 5;
        var errorCount = installments.Count(x =>
            !string.Equals(x.Status, "paid", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(x.Status, "odendi", StringComparison.OrdinalIgnoreCase)
            && ParseDate(x.Due) < DateTime.Today);

        var aiModels = BuildAiModels(notifications.Count, threads.Count, homework.Count, contents.Count, meetings.Count);
        var aiLogs = BuildAiLogs(notifications, threads);
        var stats = new PlatformOverviewStatsDto(
            tenants.Count,
            tenants.Count(x => string.Equals(x.Status, "active", StringComparison.OrdinalIgnoreCase)),
            tenants.Sum(x => x.Users),
            collections.Sum(x => ParseDecimal(x.Amount)),
            invoices.Where(x => !string.Equals(x.Status, "paid", StringComparison.OrdinalIgnoreCase) && !string.Equals(x.Status, "onaylandi", StringComparison.OrdinalIgnoreCase)).Sum(x => ParseDecimal(x.Amount)),
            installments.Where(x => ParseDate(x.Due) < DateTime.Today && !string.Equals(x.Status, "paid", StringComparison.OrdinalIgnoreCase) && !string.Equals(x.Status, "odendi", StringComparison.OrdinalIgnoreCase)).Sum(x => ParseDecimal(x.Amount)),
            tenants.Sum(x => x.Storage),
            tenants.Sum(x => x.Api),
            tickets.Count(x => string.Equals(x.Status, "open", StringComparison.OrdinalIgnoreCase)),
            invoices.Count,
            totalRequests,
            totalRequests > 0 ? decimal.Round(((decimal)(totalRequests - errorCount) / totalRequests) * 100, 1) : 100,
            decimal.Round(1.2m + Math.Min(1.8m, threads.Count * 0.04m), 1),
            decimal.Round(totalRequests * 0.0065m, 2));

        return new PlatformOverviewDto(
            stats,
            tenants.Take(4).ToList(),
            aiModels,
            aiLogs);
    }

    public async Task<IReadOnlyList<TenantWorkspaceDto>> GetTenantsAsync(CancellationToken cancellationToken = default)
    {
        var storedEntities = await dbContext.Set<TenantWorkspace>()
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        if (storedEntities.Count > 0)
        {
            return await MapTenantDtosAsync(storedEntities, cancellationToken);
        }

        var students = await dbContext.Students.AsNoTracking().ToListAsync(cancellationToken);
        var staff = await dbContext.Staff.AsNoTracking().ToListAsync(cancellationToken);
        var invoices = await dbContext.AccountingInvoices.AsNoTracking().ToListAsync(cancellationToken);
        var collections = await dbContext.AccountingCollections.AsNoTracking().ToListAsync(cancellationToken);
        var campuses = staff.Select(x => string.IsNullOrWhiteSpace(x.DepartmentOrBranch) ? "Merkez Kampus" : x.DepartmentOrBranch)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (campuses.Count == 0)
        {
            campuses.Add("Merkez Kampus");
        }

        return campuses.Select((campus, index) =>
        {
            var campusStaff = staff.Where(x => string.Equals(x.DepartmentOrBranch, campus, StringComparison.OrdinalIgnoreCase)).ToList();
            var classNames = campusStaff
                .SelectMany(x => x.AssignedClasses)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            var campusStudents = classNames.Count > 0
                ? students.Where(x => classNames.Contains(x.ClassName, StringComparer.OrdinalIgnoreCase)).ToList()
                : students;

            var fee = invoices.Where((_, invoiceIndex) => invoiceIndex % campuses.Count == index).Sum(x => ParseDecimal(x.Amount));
            var collected = collections.Where((_, collectionIndex) => collectionIndex % campuses.Count == index).Sum(x => ParseDecimal(x.Amount));
            var slug = NormalizeSlug(campus);

            return new TenantWorkspaceDto(
                Guid.NewGuid(),
                campus,
                $"{slug}@courseintellect.local",
                campusStudents.Count > 300 ? "Enterprise" : campusStudents.Count > 120 ? "Business" : "Starter",
                "active",
                campusStudents.Count + campusStaff.Count,
                Math.Max(1, classNames.Count),
                campusStudents.Count,
                campusStaff.Count,
                fee > 0 ? fee : Math.Max(850, campusStudents.Count * 15),
                collected,
                Math.Max(1, decimal.Round((decimal)(campusStudents.Count * 0.03 + campusStaff.Count * 0.02), 1)),
                (campusStudents.Count + campusStaff.Count) * 180,
                DateTime.UtcNow,
                slug,
                string.Empty,
                string.Empty,
                null,
                null,
                null,
                null);
        }).ToList();
    }

    public async Task<TenantWorkspaceDto> UpsertTenantAsync(Guid? id, UpsertTenantWorkspaceRequest request, CancellationToken cancellationToken = default)
    {
        var entity = id.HasValue
            ? await dbContext.Set<TenantWorkspace>().SingleOrDefaultAsync(x => x.Id == id.Value, cancellationToken)
            : null;

        if (entity is null)
        {
            entity = new TenantWorkspace();
            await dbContext.Set<TenantWorkspace>().AddAsync(entity, cancellationToken);
        }

        entity.Name = request.Name;
        entity.Slug = await GenerateUniqueSlugAsync(request.Name, id, cancellationToken);
        entity.ContactEmail = request.Email;
        entity.Plan = request.Plan;
        entity.Status = request.Status;
        entity.UserCount = request.Users;
        entity.BranchCount = request.Branches;
        entity.StudentCount = request.StudentCount;
        entity.StaffCount = request.StaffCount;
        entity.MonthlyFee = request.MonthlyFee;
        entity.CollectedAmount = request.Collected;
        entity.StorageUsedGb = request.Storage;
        entity.ApiUsage = request.Api;

        await dbContext.SaveChangesAsync(cancellationToken);
        return ToTenantDto(entity);
    }

    public async Task<IReadOnlyList<SupportTicketDto>> GetSupportTicketsAsync(CancellationToken cancellationToken = default)
    {
        var storedEntities = await dbContext.Set<SupportTicket>()
            .AsNoTracking()
            .OrderBy(x => x.Status)
            .ThenByDescending(x => x.UpdatedAtUtc)
            .ToListAsync(cancellationToken);
        var stored = storedEntities.Select(ToTicketDto).ToList();

        if (stored.Count > 0)
        {
            return stored;
        }

        var notifications = await dbContext.Notifications.AsNoTracking().OrderBy(x => x.IsRead).ToListAsync(cancellationToken);
        var tenants = await GetTenantsAsync(cancellationToken);
        return notifications.Select((notification, index) => new SupportTicketDto(
            Guid.NewGuid(),
            $"SUP-{index + 1:000}",
            notification.Title,
            tenants.Count > 0 ? tenants[index % tenants.Count].Name : "Merkez Kampus",
            notification.TargetRole,
            notification.TargetRole,
            string.IsNullOrWhiteSpace(notification.Category) ? "Genel" : notification.Category,
            index % 3 == 0 ? "high" : index % 3 == 1 ? "medium" : "low",
            notification.IsRead ? "resolved" : "open",
            notification.Message,
            notification.Message,
            1,
            DateTime.UtcNow.AddHours(-(index + 1)),
            DateTime.UtcNow.AddHours(-(index + 1))
        )).ToList();
    }

    public async Task<SupportTicketDto> CreateSupportTicketAsync(CreateSupportTicketRequest request, CancellationToken cancellationToken = default)
    {
        var sequence = await dbContext.Set<SupportTicket>().CountAsync(cancellationToken) + 1;
        var entity = new SupportTicket
        {
            TicketNumber = $"SUP-{sequence:000}",
            Subject = request.Subject,
            TenantName = request.Tenant,
            RequestedBy = request.User,
            RequestedRole = request.UserRole,
            Category = request.Category,
            Priority = request.Priority,
            Status = "open",
            Summary = request.Summary,
            LastMessage = request.LastMessage,
            MessageCount = 1,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        await dbContext.Set<SupportTicket>().AddAsync(entity, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToTicketDto(entity);
    }

    public async Task<SupportTicketDto?> UpdateSupportTicketAsync(Guid id, UpdateSupportTicketRequest request, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.Set<SupportTicket>().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            entity.Status = request.Status;
        }

        if (!string.IsNullOrWhiteSpace(request.Priority))
        {
            entity.Priority = request.Priority;
        }

        if (!string.IsNullOrWhiteSpace(request.LastMessage))
        {
            entity.LastMessage = request.LastMessage;
        }

        if (request.Messages.HasValue)
        {
            entity.MessageCount = request.Messages.Value;
        }

        entity.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToTicketDto(entity);
    }

    public async Task<TenantWorkspaceDto> RegisterTenantAsync(RegisterTenantRequest request, CancellationToken cancellationToken = default)
    {
        var entity = new TenantWorkspace
        {
            Name = request.InstitutionName.Trim(),
            Slug = await GenerateUniqueSlugAsync(request.InstitutionName, null, cancellationToken),
            ContactEmail = request.Email.Trim(),
            ContactName = request.ContactName.Trim(),
            ContactPhone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            PendingAdminPasswordHash = passwordHasher.Hash(request.Password),
            Plan = request.Plan,
            Status = "pending",
            UserCount = request.EstimatedStudents,
            BranchCount = 1,
            StudentCount = request.EstimatedStudents,
            StaffCount = 0,
            MonthlyFee = 0,
            CollectedAmount = 0,
            StorageUsedGb = 0,
            ApiUsage = 0,
            CreatedAtUtc = DateTime.UtcNow,
        };

        await dbContext.Set<TenantWorkspace>().AddAsync(entity, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToTenantDto(entity);
    }

    public async Task<TenantWorkspaceDto?> ApproveTenantAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.Set<TenantWorkspace>().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        entity.Status = "active";
        entity.ApprovedAtUtc ??= DateTime.UtcNow;

        AppUser? adminUser = null;
        if (entity.AdminUserId.HasValue)
        {
            adminUser = await dbContext.Users.SingleOrDefaultAsync(x => x.Id == entity.AdminUserId.Value, cancellationToken);
        }

        string? temporaryPassword = null;
        if (adminUser is null)
        {
            var created = await CreateTenantAdminUserAsync(entity, cancellationToken);
            adminUser = created.User;
            temporaryPassword = created.TemporaryPassword;
            entity.AdminUserId = adminUser.Id;
            entity.UserCount = Math.Max(entity.UserCount, 1);
            entity.PendingAdminPasswordHash = null;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return ToTenantDto(entity, adminUser.Username, temporaryPassword);
    }

    public async Task<TenantWorkspaceDto?> RejectTenantAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.Set<TenantWorkspace>().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        entity.Status = "rejected";
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToTenantDto(entity);
    }

    private async Task<IReadOnlyList<TenantWorkspaceDto>> MapTenantDtosAsync(IReadOnlyList<TenantWorkspace> entities, CancellationToken cancellationToken)
    {
        var adminUserIds = entities
            .Where(x => x.AdminUserId.HasValue)
            .Select(x => x.AdminUserId!.Value)
            .Distinct()
            .ToList();

        Dictionary<Guid, string> adminUsernames = [];
        if (adminUserIds.Count > 0)
        {
            adminUsernames = await dbContext.Users
                .AsNoTracking()
                .Where(x => adminUserIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.Username, cancellationToken);
        }

        return entities
            .Select(entity =>
            {
                var adminUsername = entity.AdminUserId.HasValue && adminUsernames.TryGetValue(entity.AdminUserId.Value, out var resolvedUsername)
                    ? resolvedUsername
                    : null;
                return ToTenantDto(entity, adminUsername);
            })
            .ToList();
    }

    private async Task<(AppUser User, string TemporaryPassword)> CreateTenantAdminUserAsync(TenantWorkspace tenant, CancellationToken cancellationToken)
    {
        var username = await GenerateUniqueTenantAdminUsernameAsync(tenant, cancellationToken);
        var temporaryPassword = string.Empty;
        var passwordHash = tenant.PendingAdminPasswordHash;
        if (string.IsNullOrWhiteSpace(passwordHash))
        {
            temporaryPassword = GenerateTemporaryPassword();
            passwordHash = passwordHasher.Hash(temporaryPassword);
        }
        var fullName = string.IsNullOrWhiteSpace(tenant.ContactName)
            ? $"{tenant.Name} Yonetici"
            : tenant.ContactName.Trim();

        var user = new AppUser
        {
            TenantId = tenant.Id,
            FullName = fullName,
            Username = username,
            PasswordHash = passwordHash,
            PrimaryRole = UserRole.Admin,
            Status = UserStatus.Active,
            Phone = tenant.ContactPhone,
            IsEmailVerified = false,
            Campus = tenant.Name,
            DepartmentOrBranch = "Yonetim",
            CreatedAtUtc = DateTime.UtcNow
        };

        await dbContext.Users.AddAsync(user, cancellationToken);
        return (user, temporaryPassword);
    }

    private async Task<string> GenerateUniqueSlugAsync(string value, Guid? currentId, CancellationToken cancellationToken)
    {
        var baseSlug = NormalizeSlug(value);
        var slug = baseSlug;
        var suffix = 2;

        while (await dbContext.Set<TenantWorkspace>()
            .AnyAsync(x => x.Slug == slug && (!currentId.HasValue || x.Id != currentId.Value), cancellationToken))
        {
            slug = $"{baseSlug}.{suffix++}";
        }

        return slug;
    }

    private async Task<string> GenerateUniqueTenantAdminUsernameAsync(TenantWorkspace tenant, CancellationToken cancellationToken)
    {
        var emailCandidate = tenant.ContactEmail.Trim().ToLowerInvariant();
        var baseUsername = string.IsNullOrWhiteSpace(emailCandidate)
            ? $"{tenant.Slug}.admin"
            : emailCandidate;

        if (!await dbContext.Users.AnyAsync(x => x.Username == baseUsername, cancellationToken))
        {
            return baseUsername;
        }

        var atIndex = baseUsername.IndexOf('@');
        var localPart = atIndex > 0 ? baseUsername[..atIndex] : baseUsername;
        var domainPart = atIndex > 0 ? baseUsername[atIndex..] : string.Empty;
        var counter = 2;

        while (true)
        {
            var candidate = $"{localPart}{counter}{domainPart}";
            if (!await dbContext.Users.AnyAsync(x => x.Username == candidate, cancellationToken))
            {
                return candidate;
            }

            counter++;
        }
    }

    private static TenantWorkspaceDto ToTenantDto(TenantWorkspace entity, string? adminUsername = null, string? temporaryPassword = null) => new(
        entity.Id,
        entity.Name,
        entity.ContactEmail,
        entity.Plan,
        entity.Status,
        entity.UserCount,
        entity.BranchCount,
        entity.StudentCount,
        entity.StaffCount,
        entity.MonthlyFee,
        entity.CollectedAmount,
        entity.StorageUsedGb,
        entity.ApiUsage,
        entity.CreatedAtUtc,
        entity.Slug,
        entity.ContactName,
        entity.ContactPhone ?? string.Empty,
        entity.AdminUserId,
        adminUsername,
        temporaryPassword,
        entity.ApprovedAtUtc);

    private static SupportTicketDto ToTicketDto(SupportTicket entity) => new(
        entity.Id,
        entity.TicketNumber,
        entity.Subject,
        entity.TenantName,
        entity.RequestedBy,
        entity.RequestedRole,
        entity.Category,
        entity.Priority,
        entity.Status,
        entity.Summary,
        entity.LastMessage,
        entity.MessageCount,
        entity.CreatedAtUtc,
        entity.UpdatedAtUtc);

    private static IReadOnlyList<PlatformAiModelDto> BuildAiModels(int notifications, int threads, int homework, int contents, int meetings)
    {
        var total = Math.Max(1, notifications + threads + homework + contents + meetings);
        return
        [
            new PlatformAiModelDto("learning-copilot", "Ogrenme Copilot", "OpenAI", threads > 0 ? "active" : "standby", (int)Math.Round((double)threads / total * 100), 0.03m),
            new PlatformAiModelDto("content-insight", "Icerik Analizi", "OpenAI", contents > 0 ? "active" : "standby", (int)Math.Round((double)contents / total * 100), 0.018m),
            new PlatformAiModelDto("ops-summary", "Operasyon Ozetleyici", "Internal", notifications > 0 ? "active" : "standby", (int)Math.Round((double)notifications / total * 100), 0.004m),
            new PlatformAiModelDto("parent-assist", "Veli Destek Asistani", "OpenAI", meetings > 0 || homework > 0 ? "active" : "inactive", (int)Math.Round((double)(meetings + homework) / total * 100), 0.009m),
        ];
    }

    private static IReadOnlyList<PlatformAiLogDto> BuildAiLogs(IReadOnlyList<NotificationItem> notifications, IReadOnlyList<StudentQuestionThread> threads)
    {
        var notificationLogs = notifications.Take(3).Select((item, index) => new PlatformAiLogDto(
            $"N-{index}",
            DateTime.Now.ToString("HH:mm"),
            item.TargetRole,
            "Platform",
            "Operasyon Ozetleyici",
            400 + index * 120,
            "1.1s",
            item.IsRead ? "success" : "queued"));

        var threadLogs = threads.Take(4).Select((item, index) => new PlatformAiLogDto(
            $"Q-{item.Id}",
            DateTime.Now.ToString("HH:mm"),
            item.StudentName,
            item.Subject,
            "Ogrenme Copilot",
            900 + index * 160,
            "1.8s",
            "success"));

        return threadLogs.Concat(notificationLogs).Take(7).ToList();
    }

    private static string GenerateTemporaryPassword()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = new Random();
        return new string(Enumerable.Range(0, 10).Select(_ => chars[random.Next(chars.Length)]).ToArray());
    }

    private static string NormalizeSlug(string value)
    {
        var normalized = new string(value
            .Trim()
            .ToLowerInvariant()
            .Select(ch => ch switch
            {
                '\u00E7' => 'c',
                '\u011F' => 'g',
                '\u0131' => 'i',
                '\u00F6' => 'o',
                '\u015F' => 's',
                '\u00FC' => 'u',
                _ => ch
            })
            .ToArray());

        var parts = normalized
            .Split([' ', '/', '\\', '-', '_'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(part => new string(part.Where(char.IsLetterOrDigit).ToArray()))
            .Where(part => !string.IsNullOrWhiteSpace(part));

        return string.Join('.', parts);
    }

    private static decimal ParseDecimal(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return 0;
        }

        var normalized = raw.Replace("₺", string.Empty).Replace(".", string.Empty).Replace(",", ".").Trim();
        return decimal.TryParse(normalized, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var result)
            ? result
            : 0;
    }

    private static DateTime ParseDate(string? raw)
    {
        if (DateTime.TryParse(raw, out var parsed))
        {
            return parsed;
        }

        return DateTime.MaxValue;
    }
}
