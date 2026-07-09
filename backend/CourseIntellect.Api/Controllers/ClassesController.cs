using CourseIntellect.Api.Authorization;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

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
