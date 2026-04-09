using CourseIntellect.Application.DTOs.LoginAttempts;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class LoginAttemptService(CourseIntellectDbContext dbContext) : ILoginAttemptService
{
    public async Task<IReadOnlyList<LoginAttemptDto>> GetAllAsync(string? search, string? role, bool? success, CancellationToken cancellationToken = default)
    {
        var query = dbContext.LoginAttempts.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                EF.Functions.ILike(x.Email, $"%{search}%") ||
                EF.Functions.ILike(x.IpAddress, $"%{search}%"));
        }

        if (!string.IsNullOrWhiteSpace(role))
        {
            query = query.Where(x => x.Role == role.Trim());
        }

        if (success.HasValue)
        {
            query = query.Where(x => x.Success == success.Value);
        }

        return await query
            .OrderByDescending(x => x.Timestamp)
            .Select(x => new LoginAttemptDto(
                x.Id,
                x.UserId,
                x.Email,
                x.Role,
                x.Success,
                x.IpAddress,
                x.UserAgent,
                x.DeviceId,
                x.Timestamp))
            .ToListAsync(cancellationToken);
    }

    public async Task<LoginAttemptStatsDto> GetStatsAsync(CancellationToken cancellationToken = default)
    {
        var total = await dbContext.LoginAttempts.CountAsync(cancellationToken);
        var successCount = await dbContext.LoginAttempts.CountAsync(x => x.Success, cancellationToken);
        var failedCount = total - successCount;
        var successRate = total > 0 ? (double)successCount / total * 100.0 : 0.0;

        return new LoginAttemptStatsDto(total, successCount, failedCount, successRate);
    }

    public async Task<LoginAttemptDto> CreateAsync(CreateLoginAttemptRequest request, CancellationToken cancellationToken = default)
    {
        var entity = new LoginAttemptItem
        {
            UserId = request.UserId,
            Email = request.Email.Trim(),
            Role = request.Role.Trim(),
            Success = request.Success,
            IpAddress = request.IpAddress.Trim(),
            UserAgent = request.UserAgent.Trim(),
            DeviceId = request.DeviceId.Trim(),
            Timestamp = DateTimeOffset.UtcNow
        };

        await dbContext.LoginAttempts.AddAsync(entity, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new LoginAttemptDto(
            entity.Id,
            entity.UserId,
            entity.Email,
            entity.Role,
            entity.Success,
            entity.IpAddress,
            entity.UserAgent,
            entity.DeviceId,
            entity.Timestamp);
    }
}
