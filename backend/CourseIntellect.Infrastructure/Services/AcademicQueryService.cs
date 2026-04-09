using CourseIntellect.Application.DTOs.ExamResults;
using CourseIntellect.Application.DTOs.Students;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AcademicQueryService(
    CourseIntellectDbContext dbContext,
    IPasswordHasher passwordHasher) : IAcademicQueryService
{
    public async Task<IReadOnlyList<StudentSummaryDto>> GetStudentsAsync(CancellationToken cancellationToken = default)
    {
        var users = await dbContext.Users.ToDictionaryAsync(x => x.Id, cancellationToken);
        var students = await dbContext.Students
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
                users[student.UserId].Status.ToString()))
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
        var username = await GenerateUniqueUsernameAsync(request.FullName, request.ClassName, cancellationToken);
        var password = GeneratePassword();

        var user = new AppUser
        {
            FullName = request.FullName,
            Username = username,
            PasswordHash = passwordHasher.Hash(password),
            PrimaryRole = UserRole.Student,
            Campus = "Merkez Kampus",
            DepartmentOrBranch = request.ClassName
        };

        var student = new StudentProfile
        {
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
            Address = request.Address,
            Note = request.Note
        };

        await dbContext.Users.AddAsync(user, cancellationToken);
        await dbContext.Students.AddAsync(student, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new StudentCredentialsDto(user.Id, user.FullName, user.Username, password, student.ClassName);
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
}
