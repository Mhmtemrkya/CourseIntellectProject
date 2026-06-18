using CourseIntellect.Api.Security;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Veliye çocuk(lar)ının akademik özetini verir: sınav ortalaması/net trendi,
/// devam oranı ve son sınavlar. Kapsam StudentScope ile sınırlanır.
/// </summary>
[ApiController]
[Authorize(Roles = "Parent,Admin,Administrative")]
[Route("api/parent/academic")]
public sealed class ParentAcademicController(CourseIntellectDbContext dbContext) : ControllerBase
{
    [HttpGet("children")]
    public async Task<IActionResult> GetChildrenAcademic(CancellationToken cancellationToken)
    {
        var allowed = await StudentScope.ResolveAllowedStudentNamesAsync(User, dbContext, cancellationToken);
        if (allowed is null)
        {
            return Ok(Array.Empty<object>());
        }

        var exams = await dbContext.ExamResults.AsNoTracking().ToListAsync(cancellationToken);
        var attendance = await dbContext.AttendanceEntries.AsNoTracking().ToListAsync(cancellationToken);

        var result = new List<object>();
        foreach (var name in allowed)
        {
            if (string.IsNullOrWhiteSpace(name)) continue;
            var normalized = CompatibilitySnapshotStore.NormalizeText(name);

            var studentExams = exams
                .Where(item => CompatibilitySnapshotStore.NormalizeText(item.StudentName) == normalized)
                .OrderByDescending(item => CompatibilitySnapshotStore.ParseDateLabel(item.DateLabel))
                .ToList();
            var studentAttendance = attendance
                .Where(item => CompatibilitySnapshotStore.NormalizeText(item.StudentName) == normalized)
                .ToList();

            var present = studentAttendance.Count(item => item.Status.Contains("Kat", StringComparison.OrdinalIgnoreCase));
            var totalAtt = studentAttendance.Count;

            var avgScore = studentExams.Count > 0 ? Math.Round(studentExams.Average(item => item.Score), 1) : 0;
            var avgNet = studentExams.Count > 0 ? Math.Round(studentExams.Average(item => item.Net), 1) : 0;

            // Trend: en son sınavın neti ile ondan önceki neti karşılaştır.
            var trend = 0;
            if (studentExams.Count >= 2)
            {
                trend = studentExams[0].Net - studentExams[1].Net;
            }

            result.Add(new
            {
                studentName = name,
                examCount = studentExams.Count,
                averageScore = avgScore,
                averageNet = avgNet,
                attendanceRate = totalAtt > 0 ? (int)Math.Round((double)present / totalAtt * 100) : 0,
                netTrend = trend,
                recentExams = studentExams.Take(5).Select(item => new
                {
                    title = item.ExamTitle,
                    subject = item.Subject,
                    score = item.Score,
                    net = item.Net,
                    date = item.DateLabel,
                }).ToList(),
            });
        }

        return Ok(result);
    }
}
