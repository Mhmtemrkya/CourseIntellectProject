using Hangfire;
using Hangfire.Common;
using Hangfire.States;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Hangfire depolaması (DB) yapılandırılmadığında DI'nin çökmemesi için no-op
/// istemci. İşler ÇALIŞTIRILMAZ.
///
/// Eskiden işleri tamamen sessizce yutuyordu: ödev/duyuru bildirim fan-out'u hiç
/// oluşmadığı hâlde ana işlem başarılı görünüyor, kimse bildirimin kaybolduğunu
/// fark etmiyordu. Artık her düşürülen iş HATA seviyesinde loglanır — bu durum
/// beklenen bir çalışma modu değil, yapılandırma arızasıdır ve görünür olmalıdır.
/// </summary>
public sealed class NoOpBackgroundJobClient(ILogger<NoOpBackgroundJobClient> logger) : IBackgroundJobClient
{
    public string Create(Job job, IState state)
    {
        logger.LogError(
            "Background job DROPPED: Hangfire storage is not configured. Job={JobType}.{JobMethod}, State={State}. "
            + "Any notification or deferred work this job carried will never run.",
            job?.Type?.FullName ?? "(unknown)",
            job?.Method?.Name ?? "(unknown)",
            state?.Name ?? "(unknown)");
        return string.Empty;
    }

    public bool ChangeState(string jobId, IState state, string expectedState)
    {
        logger.LogError(
            "Background job state change IGNORED: Hangfire storage is not configured. JobId={JobId}, State={State}.",
            jobId,
            state?.Name ?? "(unknown)");
        return false;
    }
}
