using System.Security.Claims;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <inheritdoc cref="IDrivingLedgerService"/>
public sealed class DrivingLedgerService(
    CourseIntellectDbContext dbContext,
    IHttpContextAccessor httpContextAccessor) : IDrivingLedgerService
{
    public async Task<DrivingLessonBalanceSummary> GetBalanceAsync(Guid studentDrivingProfileId, CancellationToken cancellationToken = default)
    {
        var movements = await dbContext.DrivingLessonLedgerEntries.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == studentDrivingProfileId)
            .Select(x => new { x.EntryType, x.MinutesDelta })
            .ToListAsync(cancellationToken);

        return DrivingLessonBalance.Compute(movements.Select(x => new LedgerMovement(x.EntryType, x.MinutesDelta)));
    }

    public async Task AddAsync(
        Guid studentDrivingProfileId,
        DrivingLedgerEntryType type,
        int minutesDelta,
        string description,
        Guid? appointmentId = null,
        Guid? drivingLessonId = null,
        string? reason = null,
        CancellationToken cancellationToken = default)
    {
        await dbContext.DrivingLessonLedgerEntries.AddAsync(new DrivingLessonLedgerEntry
        {
            StudentDrivingProfileId = studentDrivingProfileId,
            EntryType = type,
            MinutesDelta = minutesDelta,
            Description = description.Trim(),
            AppointmentId = appointmentId,
            DrivingLessonId = drivingLessonId,
            Reason = reason?.Trim() ?? string.Empty,
            CreatedByUserId = CurrentUserId(),
        }, cancellationToken);
    }

    public async Task SyncProfileCacheAsync(Guid studentDrivingProfileId, CancellationToken cancellationToken = default)
    {
        var profile = await dbContext.StudentDrivingProfiles
            .SingleOrDefaultAsync(x => x.Id == studentDrivingProfileId, cancellationToken);
        if (profile is null) return;

        var balance = await GetBalanceAsync(studentDrivingProfileId, cancellationToken);

        // Eski ekranlar bu iki alanı okuyor; defterle aynı sayıyı görmeleri için eşitliyoruz.
        // Ceza da harcanmış haktır — öğrencinin gözünde "yanan" dakikadır.
        profile.PurchasedDrivingMinutes = balance.TotalGrantedMinutes;
        profile.UsedDrivingMinutes = balance.ConsumedMinutes;
    }

    public async Task<LedgerReconciliation> ReconcileAsync(Guid studentDrivingProfileId, CancellationToken cancellationToken = default)
    {
        var balance = await GetBalanceAsync(studentDrivingProfileId, cancellationToken);

        var blocking = DrivingAppointmentStatuses.Blocking.ToArray();
        var appointments = await dbContext.DrivingAppointments.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == studentDrivingProfileId && blocking.Contains(x.Status))
            .Select(x => new { x.StartsAtUtc, x.EndsAtUtc })
            .ToListAsync(cancellationToken);

        // Ders sürerken rezervasyon hâlâ açıktır; tamamlanınca kullanıma döner.
        var activeMinutes = appointments.Sum(x => (int)(x.EndsAtUtc - x.StartsAtUtc).TotalMinutes);

        return new LedgerReconciliation(
            studentDrivingProfileId,
            balance.PlannedMinutes,
            activeMinutes,
            DrivingLessonBalance.ReservationMatches(balance, activeMinutes));
    }

    private Guid? CurrentUserId()
    {
        var user = httpContextAccessor.HttpContext?.User;
        var raw = user?.FindFirstValue("nameid") ?? user?.FindFirstValue("sub") ?? user?.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var parsed) ? parsed : null;
    }
}
