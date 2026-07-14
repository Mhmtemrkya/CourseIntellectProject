using CourseIntellect.Api.Authorization;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Zamanlanmış hatırlatmaların elle tetiklenmesi. Normalde Hangfire çalıştırır;
/// bu uçlar kurulum sonrası doğrulama ve acil durum içindir.
///
/// <para>İşler idempotenttir (dedupe anahtarlı), bu yüzden elle tetiklemek
/// kimseye ikinci bir bildirim göndermez.</para>
/// </summary>
[ApiController]
[Authorize]
[Route("api/driving-school/reminders")]
public sealed class DrivingRemindersController(IDrivingReminderJobService reminderService) : ControllerBase
{
    [HttpPost("vehicle-compliance")]
    [RequireDrivingPermission(DrivingPermissions.SettingsManage)]
    public async Task<IActionResult> RunVehicleCompliance(CancellationToken ct)
        => Ok(new { notified = await reminderService.RunVehicleComplianceRemindersAsync(ct) });

    [HttpPost("appointments")]
    [RequireDrivingPermission(DrivingPermissions.SettingsManage)]
    public async Task<IActionResult> RunAppointments(CancellationToken ct)
        => Ok(new { notified = await reminderService.RunAppointmentRemindersAsync(ct) });

    [HttpPost("students")]
    [RequireDrivingPermission(DrivingPermissions.SettingsManage)]
    public async Task<IActionResult> RunStudents(CancellationToken ct)
        => Ok(new { notified = await reminderService.RunStudentRemindersAsync(ct) });

    [HttpPost("daily-summary")]
    [RequireDrivingPermission(DrivingPermissions.SettingsManage)]
    public async Task<IActionResult> RunDailySummary(CancellationToken ct)
        => Ok(new { notified = await reminderService.RunDailyOperationsSummaryAsync(ct) });
}
