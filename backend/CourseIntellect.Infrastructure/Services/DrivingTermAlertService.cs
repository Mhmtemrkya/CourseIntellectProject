using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <inheritdoc cref="IDrivingTermAlertService"/>
public sealed class DrivingTermAlertService(CourseIntellectDbContext db) : IDrivingTermAlertService
{
    public async Task<DrivingTermAlertSnapshot> GetAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var groups = await db.DrivingStudentGroups.AsNoTracking().Where(x => x.IsActive)
            .OrderBy(x => x.RegistrationDeadlineUtc).ThenBy(x => x.Name).ToListAsync(cancellationToken);
        var groupIds = groups.Select(x => x.Id).ToList();
        var profiles = await db.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.StudentGroupId != null && groupIds.Contains(x.StudentGroupId.Value))
            .Join(db.Students.AsNoTracking(), p => p.StudentId, s => s.Id,
                (p, s) => new { Profile = p, s.FullName, s.TcNo, s.BirthDate })
            .ToListAsync(cancellationToken);
        var profileIds = profiles.Select(x => x.Profile.Id).ToList();
        var documents = await db.StudentDrivingDocuments.AsNoTracking()
            .Where(x => profileIds.Contains(x.StudentDrivingProfileId) && x.IsCurrent)
            .ToListAsync(cancellationToken);
        var documentsByProfile = documents.ToLookup(x => x.StudentDrivingProfileId);
        var workItems = await db.DrivingMebbisWorkItems.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId != null && profileIds.Contains(x.StudentDrivingProfileId.Value)
                && (x.WorkType == DrivingMebbisWorkType.CandidateRegistration || x.WorkType == DrivingMebbisWorkType.TermAssignment))
            .ToListAsync(cancellationToken);
        var itemsByProfile = workItems.ToLookup(x => x.StudentDrivingProfileId!.Value);

        var termRows = new List<DrivingTermAlertGroup>();
        foreach (var group in groups)
        {
            var members = profiles.Where(x => x.Profile.StudentGroupId == group.Id).ToList();
            var missing = 0;
            var healthPending = 0;
            var readyNotEntered = 0;
            var mismatched = 0;
            foreach (var member in members)
            {
                var currentDocs = documentsByProfile[member.Profile.Id].ToList();
                bool Approved(StudentDocumentType type) => currentDocs.Any(x => x.DocumentType == type
                    && DrivingStudentRules.CountsAsSatisfied(x.Status, x.ExpiresAtUtc, now));
                var health = currentDocs.FirstOrDefault(x => x.DocumentType == StudentDocumentType.HealthReport);
                if (!Approved(StudentDocumentType.HealthReport)) healthPending++;
                var identity = member.Profile.IdentityKind == IdentityKind.TurkishId && string.IsNullOrWhiteSpace(member.Profile.IdentityNumber)
                    ? member.TcNo : member.Profile.IdentityNumber;
                var missingFields = DrivingStudentRules.MebbisMissingFields(new DrivingStudentRules.MebbisCandidate(
                    member.Profile.IdentityKind != IdentityKind.TurkishId || DrivingStudentRules.IsValidTurkishId(identity), member.BirthDate,
                    member.Profile.FatherName, member.Profile.MotherName, member.Profile.BirthPlace, member.Profile.EducationLevel,
                    member.Profile.IdentitySerialNo, member.Profile.Phone,
                    Approved(StudentDocumentType.BiometricPhoto) || !string.IsNullOrWhiteSpace(member.Profile.PhotoUrl),
                    Approved(StudentDocumentType.HealthReport), health is not null && !string.IsNullOrWhiteSpace(health.DocumentNumber)
                        && !string.IsNullOrWhiteSpace(health.IssuedBy) && health.IssuedAtUtc.HasValue,
                    Approved(StudentDocumentType.Diploma), Approved(StudentDocumentType.CriminalRecord)));
                var requiredMissing = DrivingStudentRules.RequiredDocumentsFor(member.BirthDate, now).Any(x => !Approved(x));
                var isReady = missingFields.Count == 0 && !requiredMissing;
                if (!isReady) missing++;
                if (isReady && member.Profile.MebbisEnteredAtUtc is null) readyNotEntered++;

                var profileItems = itemsByProfile[member.Profile.Id].ToList();
                var termItem = profileItems.FirstOrDefault(x => x.WorkType == DrivingMebbisWorkType.TermAssignment);
                var termEntered = termItem?.Status is DrivingMebbisWorkStatus.Entered or DrivingMebbisWorkStatus.Verified;
                var candidateEntered = member.Profile.MebbisEnteredAtUtc.HasValue;
                if ((termItem?.StudentGroupId is Guid savedGroup && savedGroup != group.Id)
                    || (candidateEntered && !termEntered)
                    || (!candidateEntered && termEntered))
                    mismatched++;
            }

            var count = members.Count;
            var remaining = group.Quota <= 0 ? 0 : group.Quota - count;
            var days = group.RegistrationDeadlineUtc is DateTime deadline
                ? (int?)Math.Ceiling((deadline - now).TotalDays) : null;
            termRows.Add(new DrivingTermAlertGroup(group.Id, group.Name, group.TermYear, group.TermNumber,
                group.MebbisTermCode, group.Quota, count, remaining, group.Quota > 0 && count > group.Quota,
                group.RegistrationDeadlineUtc, days, missing, healthPending, readyNotEntered, mismatched));
        }

        var alerts = new List<DrivingTermAlertItem>();
        foreach (var term in termRows)
        {
            var path = $"/driving/students?groupId={term.GroupId}";
            if (term.CapacityExceeded)
                alerts.Add(Alert("CapacityExceeded", "Critical", "Dönem kontenjanı aşıldı",
                    $"{term.Name}: {term.StudentCount} kursiyer / {term.Quota} kontenjan. {Math.Abs(term.RemainingCapacity)} kişi kontenjan üstünde.", Math.Abs(term.RemainingCapacity), term.GroupId, path));
            else if (term.Quota > 0 && term.RemainingCapacity is >= 0 and <= 5)
                alerts.Add(Alert("CapacityAlmostFull", term.RemainingCapacity == 0 ? "Critical" : "Warning", "Dönem kontenjanı dolmak üzere",
                    term.RemainingCapacity == 0 ? $"{term.Name} kontenjanı doldu." : $"{term.Name} döneminin dolmasına {term.RemainingCapacity} kişi kaldı.", term.RemainingCapacity, term.GroupId, path));

            if (term.DaysToDeadline is int days && days <= 7)
                alerts.Add(Alert(days < 0 ? "DeadlinePassed" : "DeadlineApproaching", days <= 1 ? "Critical" : "Warning",
                    days < 0 ? "Dönem kayıt tarihi geçti" : "Dönem son kayıt tarihi yaklaşıyor",
                    days < 0 ? $"{term.Name} son kayıt tarihi {Math.Abs(days)} gün önce geçti." : days == 0 ? $"{term.Name} son kayıt tarihi bugün." : $"{term.Name} son kayıt tarihine {days} gün kaldı.", Math.Abs(days), term.GroupId, path));
            if (term.MissingMebbisCount > 0)
                alerts.Add(Alert("MebbisMissing", term.DaysToDeadline is <= 3 ? "Critical" : "Warning", "MEBBİS eksiği bulunan kursiyerler",
                    $"{term.Name}: {term.MissingMebbisCount} kursiyerin bilgi veya evrak eksiği bulunuyor.", term.MissingMebbisCount, term.GroupId, "/driving/mebbis"));
            if (term.HealthReportPendingCount > 0)
                alerts.Add(Alert("HealthReportPending", term.DaysToDeadline is <= 3 ? "Critical" : "Warning", "Sağlık raporu onayı bekleniyor",
                    $"{term.Name}: {term.HealthReportPendingCount} kursiyerin sağlık raporu onaylı değil.", term.HealthReportPendingCount, term.GroupId, "/driving/mebbis/documents"));
            if (term.ReadyNotEnteredCount > 0)
                alerts.Add(Alert("ReadyNotEntered", "Warning", "MEBBİS girişini bekleyen hazır kursiyerler",
                    $"{term.Name}: MEBBİS’e hazır {term.ReadyNotEnteredCount} kursiyerin girişi yapılmamış.", term.ReadyNotEnteredCount, term.GroupId, "/driving/mebbis"));
            if (term.ReconciliationMismatchCount > 0)
                alerts.Add(Alert("ReconciliationMismatch", "Critical", "MEBBİS dönem listesi uyuşmuyor",
                    $"{term.Name}: {term.ReconciliationMismatchCount} kursiyerin MEBBİS giriş/dönem durumu sistem atamasıyla uyuşmuyor.", term.ReconciliationMismatchCount, term.GroupId, "/driving/mebbis"));
        }

        // Döneme bağlanmadan "MEBBİS'e girildi" işaretlenmiş kayıtlar hiçbir dönem satırında görünmez.
        var ungroupedEntered = await db.StudentDrivingProfiles.AsNoTracking()
            .CountAsync(x => x.StudentGroupId == null && x.MebbisEnteredAtUtc != null, cancellationToken);
        if (ungroupedEntered > 0)
            alerts.Add(Alert("UngroupedEntered", "Critical", "Dönemsiz MEBBİS kayıtları",
                $"MEBBİS’e girildiği işaretli {ungroupedEntered} kursiyer sistemde bir döneme bağlı değil.", ungroupedEntered, null, "/driving/mebbis"));

        alerts = alerts.OrderBy(x => x.Severity == "Critical" ? 0 : 1).ThenByDescending(x => x.Count).ThenBy(x => x.Title).ToList();
        return new DrivingTermAlertSnapshot(now, groups.Count, alerts.Count(x => x.Severity == "Critical"),
            alerts.Count(x => x.Severity == "Warning"), termRows.Sum(x => x.MissingMebbisCount),
            termRows.Sum(x => x.HealthReportPendingCount), termRows.Sum(x => x.ReadyNotEnteredCount),
            termRows.Sum(x => x.ReconciliationMismatchCount) + ungroupedEntered, alerts, termRows);
    }

    private static DrivingTermAlertItem Alert(string code, string severity, string title, string message, int count, Guid? groupId, string actionPath)
        => new(code, severity, title, message, count, groupId, actionPath);
}
