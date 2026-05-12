using CourseIntellect.Application.DTOs.ExamResults;
using CourseIntellect.Application.DTOs.Parents;
using CourseIntellect.Application.DTOs.Students;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Auth;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AcademicQueryService(
    CourseIntellectDbContext dbContext,
    IPasswordHasher passwordHasher,
    UsernameGenerator usernameGenerator,
    IHttpContextAccessor httpContextAccessor) : IAcademicQueryService
{
    public async Task<IReadOnlyList<StudentSummaryDto>> GetStudentsAsync(CancellationToken cancellationToken = default)
    {
        var currentTenantId = ResolveCurrentTenantId();
        var usersQuery = dbContext.Users.AsQueryable();
        if (currentTenantId.HasValue)
        {
            usersQuery = usersQuery.Where(x => x.TenantId == currentTenantId.Value);
        }

        var users = await usersQuery.ToDictionaryAsync(x => x.Id, cancellationToken);
        var userIds = users.Keys.ToList();
        var studentsQuery = dbContext.Students.AsQueryable();
        if (currentTenantId.HasValue)
        {
            studentsQuery = studentsQuery.Where(x => userIds.Contains(x.UserId));
        }

        var students = await studentsQuery
            .OrderBy(x => x.FullName)
            .ToListAsync(cancellationToken);

        return students
            .Select(student => new StudentSummaryDto(
                student.Id,
                student.FullName,
                student.TcNo,
                student.ClassName,
                student.CurrentSchool,
                student.SchoolNumber,
                student.BirthDate,
                student.ProgramType,
                student.ParentName,
                student.ParentPhone,
                student.ParentEmail,
                student.Address,
                student.Note,
                users[student.UserId].Username,
                users[student.UserId].Status.ToString(),
                users[student.UserId].ExtraRoles.Select(r => r.ToString()).ToList()))
            .ToList();
    }

    public async Task<IReadOnlyList<ExamResultDto>> GetExamResultsAsync(string? studentName, string? className, CancellationToken cancellationToken = default)
    {
        var query = dbContext.ExamResults.AsQueryable();

        if (!string.IsNullOrWhiteSpace(studentName))
        {
            query = query.Where(x => EF.Functions.ILike(x.StudentName, $"%{studentName}%"));
        }

        if (!string.IsNullOrWhiteSpace(className))
        {
            query = query.Where(x => x.ClassName == className);
        }

        return await query
            .OrderByDescending(x => x.DateLabel)
            .Select(result => new ExamResultDto(
                result.Id,
                result.ExamTitle,
                result.Type.ToString(),
                result.Subject,
                result.DateLabel,
                result.StudentName,
                result.ClassName,
                result.Score,
                result.Net))
            .ToListAsync(cancellationToken);
    }

    public async Task<ExamResultDto> CreateExamResultAsync(CreateExamResultRequest request, CancellationToken cancellationToken = default)
    {
        var result = new ExamResult
        {
            ExamTitle = request.ExamTitle.Trim(),
            Type = ParseExamType(request.Type),
            Subject = request.Subject.Trim(),
            DateLabel = string.IsNullOrWhiteSpace(request.DateLabel)
                ? DateTime.UtcNow.AddHours(3).ToString("dd MMMM yyyy")
                : request.DateLabel.Trim(),
            StudentName = request.StudentName.Trim(),
            ClassName = request.ClassName.Trim(),
            Score = request.Score,
            Net = request.Net
        };

        await dbContext.ExamResults.AddAsync(result, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new ExamResultDto(
            result.Id,
            result.ExamTitle,
            result.Type.ToString(),
            result.Subject,
            result.DateLabel,
            result.StudentName,
            result.ClassName,
            result.Score,
            result.Net);
    }

    public async Task<StudentCredentialsDto> CreateStudentAsync(CreateStudentRequest request, CancellationToken cancellationToken = default)
    {
        var tenantId = ResolveCurrentTenantId()
            ?? throw new InvalidOperationException("Kurum baglami bulunamadi.");
        var username = await usernameGenerator.GenerateAsync(
            tenantId,
            request.FullName,
            new UsernameContext(Role: "Student", ClassName: request.ClassName),
            cancellationToken);
        var password = PasswordGenerator.Generate();

        var user = new AppUser
        {
            TenantId = tenantId,
            FullName = request.FullName,
            Username = username,
            PasswordHash = passwordHasher.Hash(password),
            PrimaryRole = UserRole.Student,
            Campus = "Merkez Kampus",
            DepartmentOrBranch = request.ClassName,
            MustChangePassword = true
        };

        // Veli bilgileri girildiyse veli için de otomatik AppUser oluştur.
        AppUser? parentUser = null;
        string? parentPlainPassword = null;
        var parentName = (request.ParentName ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(parentName))
        {
            var parentUsername = await usernameGenerator.GenerateAsync(
                tenantId,
                parentName,
                new UsernameContext(Role: "Parent", StudentClassName: request.ClassName),
                cancellationToken);
            parentPlainPassword = PasswordGenerator.Generate();
            parentUser = new AppUser
            {
                TenantId = tenantId,
                FullName = parentName,
                Username = parentUsername,
                PasswordHash = passwordHasher.Hash(parentPlainPassword),
                PrimaryRole = UserRole.Parent,
                Campus = "Merkez Kampus",
                DepartmentOrBranch = string.Empty,
                Phone = (request.ParentPhone ?? string.Empty).Trim(),
                MustChangePassword = true
            };
        }

        var student = new StudentProfile
        {
            TenantId = user.TenantId,
            UserId = user.Id,
            FullName = request.FullName,
            TcNo = request.TcNo,
            ClassName = request.ClassName,
            CurrentSchool = request.CurrentSchool,
            SchoolNumber = request.SchoolNumber,
            BirthDate = request.BirthDate,
            ProgramType = request.ProgramType,
            ParentName = request.ParentName,
            ParentPhone = request.ParentPhone,
            ParentEmail = request.ParentEmail,
            ParentUserId = parentUser?.Id,
            Address = request.Address,
            Note = request.Note
        };

        await dbContext.Users.AddAsync(user, cancellationToken);
        if (parentUser is not null)
        {
            await dbContext.Users.AddAsync(parentUser, cancellationToken);
        }
        await dbContext.Students.AddAsync(student, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        ParentCredentialsDto? parentCreds = null;
        if (parentUser is not null && parentPlainPassword is not null)
        {
            parentCreds = new ParentCredentialsDto(
                parentUser.Id,
                parentUser.FullName,
                parentUser.Username,
                parentPlainPassword);
        }

        return new StudentCredentialsDto(user.Id, user.FullName, user.Username, password, student.ClassName, parentCreds);
    }

    public async Task<StudentSummaryDto?> UpdateStudentAsync(Guid studentId, UpdateStudentRequest request, CancellationToken cancellationToken = default)
    {
        var student = await dbContext.Students.FirstOrDefaultAsync(x => x.Id == studentId, cancellationToken);
        if (student is null) return null;

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == student.UserId, cancellationToken);
        if (user is null) return null;

        var currentTenantId = ResolveCurrentTenantId();
        if (currentTenantId.HasValue && user.TenantId != currentTenantId.Value) return null;

        student.FullName = request.FullName;
        student.TcNo = request.TcNo;
        student.ClassName = request.ClassName;
        student.CurrentSchool = request.CurrentSchool;
        student.SchoolNumber = request.SchoolNumber;
        student.BirthDate = request.BirthDate;
        student.ProgramType = request.ProgramType;
        student.ParentName = request.ParentName;
        student.ParentPhone = request.ParentPhone;
        student.ParentEmail = request.ParentEmail;
        student.Address = request.Address;
        student.Note = request.Note;

        user.FullName = request.FullName;
        user.DepartmentOrBranch = request.ClassName;

        await dbContext.SaveChangesAsync(cancellationToken);

        return new StudentSummaryDto(
            student.Id,
            student.FullName,
            student.TcNo,
            student.ClassName,
            student.CurrentSchool,
            student.SchoolNumber,
            student.BirthDate,
            student.ProgramType,
            student.ParentName,
            student.ParentPhone,
            student.ParentEmail,
            student.Address,
            student.Note,
            user.Username,
            user.Status.ToString(),
            user.ExtraRoles.Select(r => r.ToString()).ToList());
    }

    public async Task<bool> DeleteStudentAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var student = await dbContext.Students.FirstOrDefaultAsync(x => x.Id == studentId, cancellationToken);
        if (student is null) return false;

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == student.UserId, cancellationToken);
        if (user is null) return false;

        var currentTenantId = ResolveCurrentTenantId();
        if (currentTenantId.HasValue && user.TenantId != currentTenantId.Value) return false;

        dbContext.Students.Remove(student);
        dbContext.Users.Remove(user);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<ParentCredentialsDto> CreateParentAsync(CreateParentRequest request, CancellationToken cancellationToken = default)
    {
        var tenantId = ResolveCurrentTenantId()
            ?? throw new InvalidOperationException("Kurum baglami bulunamadi.");
        var username = await usernameGenerator.GenerateAsync(
            tenantId,
            request.FullName,
            new UsernameContext(Role: "Parent"),
            cancellationToken);
        var password = PasswordGenerator.Generate();

        var user = new AppUser
        {
            TenantId = tenantId,
            FullName = request.FullName.Trim(),
            Username = username,
            PasswordHash = passwordHasher.Hash(password),
            PrimaryRole = UserRole.Parent,
            Campus = "Merkez Kampus",
            DepartmentOrBranch = string.Empty,
            MustChangePassword = true
        };

        await dbContext.Users.AddAsync(user, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new ParentCredentialsDto(user.Id, user.FullName, user.Username, password);
    }

    private async Task<string> GenerateUniqueUsernameAsync(string fullName, string className, CancellationToken cancellationToken)
    {
        var normalized = Normalize(fullName);
        var normalizedClass = Normalize(className).Replace(" ", string.Empty);
        var random = new Random();
        var username = $"{normalized[..Math.Min(normalized.Length, 8)]}{normalizedClass}{random.Next(100, 999)}";

        while (await dbContext.Users.AnyAsync(x => x.Username == username, cancellationToken))
        {
            username = $"{normalized[..Math.Min(normalized.Length, 8)]}{normalizedClass}{random.Next(100, 999)}";
        }

        return username;
    }

    private static string GeneratePassword()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = new Random();
        return new string(Enumerable.Range(0, 8).Select(_ => chars[random.Next(chars.Length)]).ToArray());
    }

    private static string Normalize(string value)
    {
        return value.ToLowerInvariant()
            .Replace("ç", "c")
            .Replace("ğ", "g")
            .Replace("ı", "i")
            .Replace("ö", "o")
            .Replace("ş", "s")
            .Replace("ü", "u")
            .Replace(" ", string.Empty);
    }

    private static ExamType ParseExamType(string type)
    {
        return type.Trim() switch
        {
            "Deneme" or "MockExam" => ExamType.MockExam,
            "Yazili" or "Yazılı" or "Written" => ExamType.Written,
            "Sozlu" or "Sözlü" or "Oral" => ExamType.Oral,
            "Quiz" => ExamType.Quiz,
            _ => ExamType.Written
        };
    }

    private Guid? ResolveCurrentTenantId()
    {
        var raw = httpContextAccessor.HttpContext?.User?.FindFirstValue("tenant_id");
        return Guid.TryParse(raw, out var tenantId) ? tenantId : null;
    }
}
