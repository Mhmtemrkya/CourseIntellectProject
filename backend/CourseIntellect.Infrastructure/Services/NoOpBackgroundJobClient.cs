using Hangfire;
using Hangfire.Common;
using Hangfire.States;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>Hangfire depolaması (DB) yapılandırılmadığında DI'nin çökmemesi için
/// no-op istemci. İşleri sessizce yutar — pratikte prod'da DB hep var olduğundan
/// kullanılmaz; yalnız güvenlik ağıdır.</summary>
public sealed class NoOpBackgroundJobClient : IBackgroundJobClient
{
    public string Create(Job job, IState state) => string.Empty;
    public bool ChangeState(string jobId, IState state, string expectedState) => false;
}
