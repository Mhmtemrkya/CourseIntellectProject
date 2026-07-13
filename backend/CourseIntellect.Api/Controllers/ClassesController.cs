using CourseIntellect.Api.Authorization;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/classes")]
public sealed class ClassesController(
    CourseIntellectDbContext dbContext,
    ILogger<ClassesController> logger) : ControllerBase
{
    private const string ClassRegistryConfigurationType = "class-registry";
    private const string ClassManagementConfigurationType = "class-management";
    private const string LegacyScheduleConfigurationType = "class-schedule";
    private const string ScheduleEntryConfigurationType = "class-schedule-entry";
    private static readonly StringComparer ClassNameComparer = CreateClassNameComparer();

    [HttpGet]
    public async Task<ActionResult<List<string>>> GetList(CancellationToken cancellationToken)
    {
        var tenantId = await ResolveTenantIdAsync(cancellationToken);
        if (!tenantId.HasValue)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Kurum bağlamı bulunamadı. Lütfen kurum hesabıyla tekrar giriş yapın." });
        }

        var classes = await LoadClassListAsync(tenantId.Value, cancellationToken);
        return Ok(classes);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("classes", "create")]
    public async Task<ActionResult<object>> Create([FromBody] CreateClassRequest request, CancellationToken cancellationToken)
    {
        var tenantId = await ResolveTenantIdAsync(cancellationToken);
        if (!tenantId.HasValue)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Kurum bağlamı bulunamadı. Lütfen kurum hesabıyla tekrar giriş yapın." });
        }

        var normalized = CompatibilitySnapshotStore.NormalizeClassName(request.Name);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return BadRequest(new { message = "Sınıf adı zorunludur." });
        }

        var existingClasses = await LoadClassListAsync(tenantId.Value, cancellationToken);
        if (existingClasses.Any(item => string.Equals(item, normalized, StringComparison.OrdinalIgnoreCase)))
        {
            return Conflict(new { message = "Bu sınıf zaten kayıtlı." });
        }

        var entity = new CourseIntellect.Domain.Entities.PlatformConfiguration
        {
            TenantId = tenantId.Value,
            ConfigurationType = ClassRegistryConfigurationType,
            ScopeKey = Guid.NewGuid().ToString("N"),
            DisplayName = normalized,
            PayloadJson = JsonSerializer.Serialize(new { name = normalized }),
            UpdatedAtUtc = DateTime.UtcNow,
        };

        await dbContext.PlatformConfigurations.AddAsync(entity, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { name = normalized });
    }

    [HttpPost("create-complete")]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("classes", "create")]
    public async Task<ActionResult<object>> CreateComplete([FromBody] CreateCompleteClassRequest request, CancellationToken cancellationToken)
    {
        var tenantId = await ResolveTenantIdAsync(cancellationToken);
        if (!tenantId.HasValue)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Kurum bağlamı bulunamadı. Lütfen kurum hesabıyla tekrar giriş yapın." });
        }

        var className = CompatibilitySnapshotStore.NormalizeClassName(request.Name);
        if (string.IsNullOrWhiteSpace(className))
        {
            return BadRequest(new { message = "Sınıf adı zorunludur." });
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var existingClasses = await LoadClassListAsync(tenantId.Value, cancellationToken);
            if (!existingClasses.Any(item => string.Equals(item, className, StringComparison.OrdinalIgnoreCase)))
            {
                await dbContext.PlatformConfigurations.AddAsync(new PlatformConfiguration
                {
                    TenantId = tenantId.Value,
                    ConfigurationType = ClassRegistryConfigurationType,
                    ScopeKey = Guid.NewGuid().ToString("N"),
                    DisplayName = className,
                    PayloadJson = JsonSerializer.Serialize(new { name = className }),
                    UpdatedAtUtc = DateTime.UtcNow,
                }, cancellationToken);
            }

            var scopeKey = string.IsNullOrWhiteSpace(request.Code) ? className : request.Code.Trim();
            var management = await dbContext.PlatformConfigurations
                .FirstOrDefaultAsync(item =>
                    item.TenantId == tenantId.Value &&
                    item.ConfigurationType == ClassManagementConfigurationType &&
                    item.ScopeKey == scopeKey,
                    cancellationToken);

            var selectedTeacherIds = request.Teachers
                .Select(item => item.TeacherId)
                .Concat(request.Courses.Select(item => item.TeacherId))
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .ToHashSet();

            if (request.AdvisorTeacherId.HasValue)
            {
                selectedTeacherIds.Add(request.AdvisorTeacherId.Value);
            }

            var selectedStudentIds = request.StudentIds.ToHashSet();
            List<StaffProfile> teachers = selectedTeacherIds.Count == 0
                ? []
                : await dbContext.Staff
                    .Where(item => item.TenantId == tenantId.Value && selectedTeacherIds.Contains(item.Id))
                    .ToListAsync(cancellationToken);
            List<StudentProfile> students = selectedStudentIds.Count == 0
                ? []
                : await dbContext.Students
                    .Where(item => item.TenantId == tenantId.Value && selectedStudentIds.Contains(item.Id))
                    .ToListAsync(cancellationToken);

            foreach (var teacher in teachers)
            {
                if (!teacher.AssignedClasses.Contains(className, StringComparer.OrdinalIgnoreCase))
                {
                    teacher.AssignedClasses = teacher.AssignedClasses.Append(className).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                }

                if (request.AdvisorTeacherId == teacher.Id)
                {
                    teacher.HomeroomClass = className;
                }
            }

            foreach (var student in students)
            {
                student.ClassName = className;
                var user = await dbContext.Users.FirstOrDefaultAsync(item => item.Id == student.UserId && item.TenantId == tenantId.Value, cancellationToken);
                if (user is not null)
                {
                    user.DepartmentOrBranch = className;
                }
            }

            var payload = new
            {
                id = management?.Id ?? Guid.NewGuid(),
                name = className,
                code = scopeKey,
                school = request.School,
                institutionUnit = request.InstitutionUnit,
                grade = request.Grade,
                section = request.Section,
                academicYear = request.AcademicYear,
                advisorTeacherId = request.AdvisorTeacherId,
                description = request.Description,
                themeColor = request.ThemeColor,
                icon = request.Icon,
                modules = request.Modules,
                teachers = request.Teachers,
                courses = request.Courses,
                studentIds = request.StudentIds,
                createdBy = User.Identity?.Name ?? "system",
                updatedAtUtc = DateTime.UtcNow,
            };

            if (management is null)
            {
                management = new PlatformConfiguration
                {
                    TenantId = tenantId.Value,
                    ConfigurationType = ClassManagementConfigurationType,
                    ScopeKey = scopeKey,
                    DisplayName = $"CLASS_MANAGEMENT::{className}",
                    PayloadJson = JsonSerializer.Serialize(payload),
                    UpdatedAtUtc = DateTime.UtcNow,
                };
                await dbContext.PlatformConfigurations.AddAsync(management, cancellationToken);
            }
            else
            {
                management.DisplayName = $"CLASS_MANAGEMENT::{className}";
                management.PayloadJson = JsonSerializer.Serialize(payload);
                management.UpdatedAtUtc = DateTime.UtcNow;
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return Ok(new
            {
                name = className,
                code = scopeKey,
                teacherCount = teachers.Count,
                studentCount = students.Count,
                courseCount = request.Courses.Count,
                modules = request.Modules,
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            logger.LogError(ex, "Complete class creation failed for {ClassName}", className);
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{name}/assignments")]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("classes", "edit")]
    public async Task<ActionResult<object>> UpdateAssignments(string name, [FromBody] UpdateClassAssignmentsRequest request, CancellationToken cancellationToken)
    {
        var tenantId = await ResolveTenantIdAsync(cancellationToken);
        if (!tenantId.HasValue)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Kurum bağlamı bulunamadı. Lütfen kurum hesabıyla tekrar giriş yapın." });
        }

        var className = CompatibilitySnapshotStore.NormalizeClassName(name);
        if (string.IsNullOrWhiteSpace(className))
        {
            return BadRequest(new { message = "Sınıf adı zorunludur." });
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var existingClasses = await LoadClassListAsync(tenantId.Value, cancellationToken);
            if (!existingClasses.Any(item => string.Equals(item, className, StringComparison.OrdinalIgnoreCase)))
            {
                await dbContext.PlatformConfigurations.AddAsync(new PlatformConfiguration
                {
                    TenantId = tenantId.Value,
                    ConfigurationType = ClassRegistryConfigurationType,
                    ScopeKey = Guid.NewGuid().ToString("N"),
                    DisplayName = className,
                    PayloadJson = JsonSerializer.Serialize(new { name = className }),
                    UpdatedAtUtc = DateTime.UtcNow,
                }, cancellationToken);
            }

            var selectedStudentIds = (request.StudentIds ?? [])
                .Where(id => id != Guid.Empty)
                .Distinct()
                .ToHashSet();

            List<StudentProfile> selectedStudents = selectedStudentIds.Count == 0
                ? []
                : await dbContext.Students
                    .Where(item => item.TenantId == tenantId.Value && selectedStudentIds.Contains(item.Id))
                    .ToListAsync(cancellationToken);

            var currentClassStudents = await dbContext.Students
                .Where(item => item.TenantId == tenantId.Value && item.ClassName == className)
                .ToListAsync(cancellationToken);

            var usersToUpdate = selectedStudents
                .Concat(currentClassStudents)
                .Select(item => item.UserId)
                .Distinct()
                .ToHashSet();

            Dictionary<Guid, AppUser> users = usersToUpdate.Count == 0
                ? []
                : await dbContext.Users
                    .Where(item => item.TenantId == tenantId.Value && usersToUpdate.Contains(item.Id))
                    .ToDictionaryAsync(item => item.Id, cancellationToken);

            foreach (var student in currentClassStudents.Where(item => !selectedStudentIds.Contains(item.Id)))
            {
                student.ClassName = string.Empty;
                if (users.TryGetValue(student.UserId, out var user))
                {
                    user.DepartmentOrBranch = student.ClassName;
                }
            }

            foreach (var student in selectedStudents)
            {
                student.ClassName = className;
                if (users.TryGetValue(student.UserId, out var user))
                {
                    user.DepartmentOrBranch = className;
                }
            }

            var currentAdvisors = await dbContext.Staff
                .Where(item => item.TenantId == tenantId.Value && item.HomeroomClass == className)
                .ToListAsync(cancellationToken);

            foreach (var teacher in currentAdvisors)
            {
                teacher.HomeroomClass = string.Empty;
            }

            if (request.AdvisorTeacherId.HasValue)
            {
                var advisor = await dbContext.Staff
                    .FirstOrDefaultAsync(item => item.TenantId == tenantId.Value && item.Id == request.AdvisorTeacherId.Value, cancellationToken);

                if (advisor is null)
                {
                    return BadRequest(new { message = "Seçilen danışman öğretmen bulunamadı." });
                }

                advisor.HomeroomClass = className;
                if (!advisor.AssignedClasses.Contains(className, StringComparer.OrdinalIgnoreCase))
                {
                    advisor.AssignedClasses = advisor.AssignedClasses.Append(className).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                }
            }

            var managementConfigs = await dbContext.PlatformConfigurations
                .Where(item => item.TenantId == tenantId.Value && item.ConfigurationType == ClassManagementConfigurationType)
                .ToListAsync(cancellationToken);

            var management = managementConfigs.FirstOrDefault(item =>
                string.Equals(ReadSavedClassName(item), className, StringComparison.OrdinalIgnoreCase));

            var payload = management is null ? [] : ReadPayloadObject(management.PayloadJson);
            payload["id"] = (management?.Id ?? Guid.NewGuid()).ToString();
            payload["name"] = className;
            payload["code"] = payload.TryGetPropertyValue("code", out var codeNode) && codeNode is not null
                ? codeNode.GetValue<string>()
                : className;
            payload["advisorTeacherId"] = request.AdvisorTeacherId?.ToString();
            var studentIdNodes = new JsonArray();
            foreach (var student in selectedStudents)
            {
                studentIdNodes.Add(student.Id.ToString());
            }
            payload["studentIds"] = studentIdNodes;
            payload["updatedAtUtc"] = DateTime.UtcNow.ToString("O");

            if (management is null)
            {
                management = new PlatformConfiguration
                {
                    TenantId = tenantId.Value,
                    ConfigurationType = ClassManagementConfigurationType,
                    ScopeKey = className,
                    DisplayName = $"CLASS_MANAGEMENT::{className}",
                    PayloadJson = payload.ToJsonString(),
                    UpdatedAtUtc = DateTime.UtcNow,
                };
                await dbContext.PlatformConfigurations.AddAsync(management, cancellationToken);
            }
            else
            {
                management.DisplayName = $"CLASS_MANAGEMENT::{className}";
                management.PayloadJson = payload.ToJsonString();
                management.UpdatedAtUtc = DateTime.UtcNow;
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return Ok(new
            {
                name = className,
                studentCount = selectedStudents.Count,
                advisorTeacherId = request.AdvisorTeacherId,
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            logger.LogError(ex, "Class assignment update failed for {ClassName}", className);
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{name}")]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("classes", "delete")]
    public async Task<ActionResult<object>> Delete(
        string name,
        [FromQuery] string? transferTo,
        CancellationToken cancellationToken)
    {
        var tenantId = await ResolveTenantIdAsync(cancellationToken);
        if (!tenantId.HasValue)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Kurum bağlamı bulunamadı. Lütfen kurum hesabıyla tekrar giriş yapın." });
        }

        var className = CompatibilitySnapshotStore.NormalizeClassName(name);
        if (string.IsNullOrWhiteSpace(className))
        {
            return BadRequest(new { message = "Sınıf adı zorunludur." });
        }

        var existingClasses = await LoadClassListAsync(tenantId.Value, cancellationToken);
        if (!existingClasses.Any(item => string.Equals(item, className, StringComparison.OrdinalIgnoreCase)))
        {
            return NotFound(new { message = "Silinecek sınıf bulunamadı." });
        }

        // Hedef sınıf verilirse öğrenciler oraya taşınır; verilmezse sınıfsız kalıp pasife alınırlar.
        var targetClassName = CompatibilitySnapshotStore.NormalizeClassName(transferTo);
        if (!string.IsNullOrWhiteSpace(targetClassName))
        {
            if (string.Equals(targetClassName, className, StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Öğrenciler silinen sınıfa taşınamaz. Farklı bir sınıf seçin." });
            }

            if (!existingClasses.Any(item => string.Equals(item, targetClassName, StringComparison.OrdinalIgnoreCase)))
            {
                return BadRequest(new { message = "Öğrencilerin taşınacağı sınıf bulunamadı." });
            }
        }
        else
        {
            targetClassName = string.Empty;
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var students = await dbContext.Students
                .Where(item => item.TenantId == tenantId.Value)
                .ToListAsync(cancellationToken);
            var classStudents = students
                .Where(item => string.Equals(item.ClassName, className, StringComparison.OrdinalIgnoreCase))
                .ToList();

            var studentUserIds = classStudents.Select(item => item.UserId).ToHashSet();
            List<AppUser> studentUsers = studentUserIds.Count == 0
                ? []
                : await dbContext.Users
                    .Where(item => item.TenantId == tenantId.Value && studentUserIds.Contains(item.Id))
                    .ToListAsync(cancellationToken);

            var transferred = !string.IsNullOrWhiteSpace(targetClassName);
            foreach (var student in classStudents)
            {
                student.ClassName = targetClassName;
            }

            var deactivatedCount = 0;
            foreach (var user in studentUsers)
            {
                user.DepartmentOrBranch = targetClassName;
                if (transferred || user.Status == UserStatus.Passive)
                {
                    continue;
                }

                // Sınıfsız kalan öğrenci giriş yapamamalı; yeniden aktifleştirilirken sınıf seçilecek.
                user.Status = UserStatus.Passive;
                deactivatedCount += 1;
            }

            if (!transferred && studentUserIds.Count > 0)
            {
                // Pasifleştirilen kullanıcının açık oturumu token süresi bitene dek çalışmaya devam ederdi.
                var activeSessions = await dbContext.RefreshTokenSessions
                    .Where(item => studentUserIds.Contains(item.UserId) && item.RevokedAtUtc == null)
                    .ToListAsync(cancellationToken);
                foreach (var session in activeSessions)
                {
                    session.RevokedAtUtc = DateTime.UtcNow;
                }
            }

            var staff = await dbContext.Staff
                .Where(item => item.TenantId == tenantId.Value)
                .ToListAsync(cancellationToken);
            var affectedStaff = 0;
            foreach (var member in staff)
            {
                var changed = false;
                if (string.Equals(member.HomeroomClass, className, StringComparison.OrdinalIgnoreCase))
                {
                    member.HomeroomClass = string.Empty;
                    changed = true;
                }

                var remainingClasses = member.AssignedClasses
                    .Where(item => !string.Equals(item, className, StringComparison.OrdinalIgnoreCase))
                    .ToList();
                if (remainingClasses.Count != member.AssignedClasses.Count)
                {
                    member.AssignedClasses = remainingClasses;
                    changed = true;
                }

                if (changed)
                {
                    affectedStaff += 1;
                }
            }

            var configurations = await dbContext.PlatformConfigurations
                .IgnoreQueryFilters()
                .Where(item => item.TenantId == tenantId.Value)
                .Where(item =>
                    item.ConfigurationType == ClassManagementConfigurationType ||
                    item.ConfigurationType == ClassRegistryConfigurationType ||
                    item.ConfigurationType == LegacyScheduleConfigurationType ||
                    item.ConfigurationType == ScheduleEntryConfigurationType)
                .ToListAsync(cancellationToken);

            var classConfigurations = configurations
                .Where(item =>
                    (item.ConfigurationType == ClassManagementConfigurationType || item.ConfigurationType == ClassRegistryConfigurationType) &&
                    string.Equals(ReadSavedClassName(item), className, StringComparison.OrdinalIgnoreCase))
                .ToList();
            dbContext.PlatformConfigurations.RemoveRange(classConfigurations);

            var removedScheduleEntries = 0;
            foreach (var schedule in configurations.Where(item => item.ConfigurationType == ScheduleEntryConfigurationType))
            {
                if (!string.Equals(ReadPayloadClassName(schedule.PayloadJson), className, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                dbContext.PlatformConfigurations.Remove(schedule);
                removedScheduleEntries += 1;
            }

            foreach (var legacySchedule in configurations.Where(item => item.ConfigurationType == LegacyScheduleConfigurationType))
            {
                var removed = RemoveClassFromLegacySchedule(legacySchedule.PayloadJson, className, out var updatedPayload);
                if (removed == 0)
                {
                    continue;
                }

                removedScheduleEntries += removed;
                if (string.IsNullOrWhiteSpace(updatedPayload))
                {
                    dbContext.PlatformConfigurations.Remove(legacySchedule);
                }
                else
                {
                    legacySchedule.PayloadJson = updatedPayload;
                    legacySchedule.UpdatedAtUtc = DateTime.UtcNow;
                }
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return Ok(new
            {
                name = className,
                studentCount = classStudents.Count,
                staffCount = affectedStaff,
                scheduleEntryCount = removedScheduleEntries,
                transferredTo = transferred ? targetClassName : null,
                transferredStudentCount = transferred ? classStudents.Count : 0,
                deactivatedStudentCount = deactivatedCount,
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            logger.LogError(ex, "Class deletion failed for {ClassName}", className);
            return BadRequest(new { message = "Sınıf silinemedi. Bağlı kayıtlar temizlenirken bir hata oluştu." });
        }
    }

    private async Task<List<string>> LoadClassListAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var classes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void AddMany(IEnumerable<string?> values)
        {
            foreach (var value in values)
            {
                var normalized = CompatibilitySnapshotStore.NormalizeClassName(value);
                if (!string.IsNullOrWhiteSpace(normalized) && !IsAllClassesLabel(normalized))
                {
                    classes.Add(normalized);
                }
            }
        }

        var savedClassConfigs = await dbContext.PlatformConfigurations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(item => item.TenantId == tenantId)
            .Where(item => item.ConfigurationType == ClassManagementConfigurationType || item.ConfigurationType == ClassRegistryConfigurationType)
            .OrderBy(item => item.ConfigurationType)
            .ThenBy(item => item.ScopeKey)
            .ToListAsync(cancellationToken);

        foreach (var item in savedClassConfigs)
        {
            AddMany([ReadSavedClassName(item)]);
        }

        AddMany(await dbContext.Students
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(item => item.TenantId == tenantId)
            .Select(item => (string?)item.ClassName)
            .ToListAsync(cancellationToken));

        if (classes.Count == 0)
        {
            logger.LogInformation("Class list returned empty for tenant {TenantId}.", tenantId);
        }

        return classes
            .OrderBy(item => item, ClassNameComparer)
            .ToList();
    }

    private async Task<Guid?> ResolveTenantIdAsync(CancellationToken cancellationToken)
    {
        if (dbContext.CurrentTenantId is Guid tenantId)
        {
            return tenantId;
        }

        var userRaw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userRaw, out var userId))
        {
            return null;
        }

        return await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => user.TenantId)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static string? ReadSavedClassName(CourseIntellect.Domain.Entities.PlatformConfiguration item)
    {
        if (string.Equals(item.ConfigurationType, ClassRegistryConfigurationType, StringComparison.OrdinalIgnoreCase))
        {
            return item.DisplayName;
        }

        try
        {
            using var document = JsonDocument.Parse(item.PayloadJson);
            if (document.RootElement.TryGetProperty("name", out var nameProperty))
            {
                return nameProperty.GetString();
            }
        }
        catch
        {
            // Fall back to DisplayName parsing below.
        }

        const string prefix = "CLASS_MANAGEMENT::";
        return item.DisplayName.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            ? item.DisplayName[prefix.Length..]
            : item.ScopeKey;
    }

    private static JsonObject ReadPayloadObject(string payloadJson)
    {
        try
        {
            return JsonNode.Parse(payloadJson)?.AsObject() ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static string? ReadPayloadClassName(string payloadJson)
    {
        try
        {
            using var document = JsonDocument.Parse(payloadJson);
            return document.RootElement.TryGetProperty("className", out var classNameProperty)
                ? classNameProperty.GetString()
                : null;
        }
        catch
        {
            return null;
        }
    }

    private static int RemoveClassFromLegacySchedule(string payloadJson, string className, out string? updatedPayload)
    {
        updatedPayload = null;
        try
        {
            var entries = JsonNode.Parse(payloadJson) as JsonArray;
            if (entries is null)
            {
                return 0;
            }

            var removed = 0;
            for (var index = entries.Count - 1; index >= 0; index -= 1)
            {
                var entryClassName = entries[index]?["className"]?.GetValue<string>();
                if (!string.Equals(entryClassName, className, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                entries.RemoveAt(index);
                removed += 1;
            }

            if (removed > 0 && entries.Count > 0)
            {
                updatedPayload = entries.ToJsonString();
            }
            return removed;
        }
        catch
        {
            return 0;
        }
    }

    private static StringComparer CreateClassNameComparer()
    {
        try
        {
            return StringComparer.Create(CultureInfo.GetCultureInfo("tr-TR"), false);
        }
        catch (CultureNotFoundException)
        {
            return StringComparer.InvariantCultureIgnoreCase;
        }
    }

    private static bool IsAllClassesLabel(string value)
    {
        var folded = value
            .Normalize(NormalizationForm.FormD)
            .Where(ch => CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
            .Select(ch => ch is '\u0131' or '\u0130' ? 'i' : char.ToLowerInvariant(ch));

        var compact = string.Concat(folded)
            .Replace(" ", string.Empty, StringComparison.Ordinal)
            .Replace("-", string.Empty, StringComparison.Ordinal);

        return string.Equals(compact, "tumsiniflar", StringComparison.OrdinalIgnoreCase);
    }

    public sealed record CreateClassRequest(string Name);
    public sealed record UpdateClassAssignmentsRequest(IReadOnlyList<Guid>? StudentIds, Guid? AdvisorTeacherId);
    public sealed record CreateCompleteClassRequest(
        string Name,
        string? Code,
        string? School,
        string? InstitutionUnit,
        string? Grade,
        string? Section,
        string? AcademicYear,
        Guid? AdvisorTeacherId,
        string? Description,
        string? ThemeColor,
        string? Icon,
        IReadOnlyList<ClassTeacherAssignmentRequest> Teachers,
        IReadOnlyList<ClassCourseAssignmentRequest> Courses,
        IReadOnlyList<Guid> StudentIds,
        ClassModuleSettingsRequest Modules);

    public sealed record ClassTeacherAssignmentRequest(Guid? TeacherId, string? Role);
    public sealed record ClassCourseAssignmentRequest(string CourseName, Guid? TeacherId, int WeeklyHours, bool IsRequired);
    public sealed record ClassModuleSettingsRequest(
        bool Attendance,
        bool Grades,
        bool LiveLessons,
        bool Homework,
        bool Study,
        bool Messaging);
}
